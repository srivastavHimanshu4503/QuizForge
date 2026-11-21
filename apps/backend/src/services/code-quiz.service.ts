import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { codeQuizzes, codeQuestions, codeAttempts, codeAnswers } from '../db/schema/index';
import { gitHubService } from './github.service';
import { llmRegistry } from './llm/provider-registry';
import {
  buildCodeQuizSystemPrompt,
  buildCodeQuizUserPrompt,
} from './llm/prompts/code-quiz.prompt';
import {
  GenerateCodeQuizInput,
  generatedCodeQuizResponseSchema,
  ActiveCodeAttempt,
  ActiveCodeQuestion,
} from '@quiz-forge/shared';
import { LLMProviderError } from './llm/llm.interface';

export class CodeQuizError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CodeQuizError';
  }
}

export class CodeQuizService {
  async generateAndSaveCodeQuiz(
    userId: string,
    input: GenerateCodeQuizInput,
    database = db
  ): Promise<{
    codeQuizId: string;
    attemptId: string;
    totalQuestions: number;
    status: 'in_progress';
  }> {
    // 1. Fetch Repository Source Files with Smart Prioritization
    // Keep total content size under ~15KB (~3,800 tokens) to respect rate limits on on-demand LLM tiers (e.g. Groq 8,000 TPM)
    const repoContext = await gitHubService.fetchRepoContext(input.repoUrl, {
      subfolder: input.subfolder,
      maxFiles: 6,
      maxTotalBytes: 15000,
    });

    // 2. Select LLM Provider
    let provider = llmRegistry.get(input.llmProvider);
    if (!provider.isAvailable) {
      // Fallback to default available provider
      provider = llmRegistry.getDefaultProvider();
    }

    // 3. Assemble Prompts
    const systemPrompt = buildCodeQuizSystemPrompt();
    const userPrompt = buildCodeQuizUserPrompt({
      repoUrl: repoContext.repoUrl,
      files: repoContext.files,
      questionCount: input.questionCount,
      focusAreas: input.focusAreas,
    });

    // 4. Request Question Generation from LLM
    let rawContent = '';
    try {
      const completion = await provider.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          responseFormat: { type: 'json_object' },
          temperature: 0.2, // Lower temperature for faithful code quotes
        }
      );
      rawContent = completion.content;
    } catch (err: unknown) {
      if (err instanceof LLMProviderError) {
        throw new CodeQuizError(
          `LLM Generation Failed: ${err.message}`,
          err.statusCode,
          err.code,
          err.details
        );
      }
      throw new CodeQuizError(
        `Failed to generate code quiz questions: ${err instanceof Error ? err.message : String(err)}`,
        502,
        'LLM_ERROR',
        err
      );
    }

    // 5. Strict Data Contract Validation
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch (jsonErr) {
      throw new CodeQuizError(
        'LLM failed to return valid JSON format.',
        502,
        'INVALID_LLM_RESPONSE',
        jsonErr
      );
    }

    const validationResult = generatedCodeQuizResponseSchema.safeParse(parsedJson);
    if (!validationResult.success) {
      throw new CodeQuizError(
        'Generated code quiz failed schema validation contract.',
        502,
        'SCHEMA_VALIDATION_ERROR',
        validationResult.error.format()
      );
    }

    const generatedQuestions = validationResult.data.questions;
    const codeQuizId = crypto.randomUUID();
    const attemptId = crypto.randomUUID();

    // 6. Persist in Database (Transaction)
    database.transaction((tx) => {
      tx.insert(codeQuizzes)
        .values({
          id: codeQuizId,
          userId,
          repoUrl: repoContext.repoUrl,
          repoOwner: repoContext.owner,
          repoName: repoContext.repo,
          branch: repoContext.branch,
          questionCount: generatedQuestions.length,
          llmProvider: provider.name,
          llmModel: provider.defaultModel,
          filesAnalyzed: repoContext.selectedFilesCount,
        })
        .run();

      generatedQuestions.forEach((q, idx) => {
        const questionId = crypto.randomUUID();
        tx.insert(codeQuestions)
          .values({
            id: questionId,
            codeQuizId,
            questionOrder: idx + 1,
            questionText: q.question,
            codeSnippetPath: q.code_snippet.file_path,
            codeSnippetContent: q.code_snippet.code,
            codeSnippetStartLine: q.code_snippet.start_line ?? null,
            codeSnippetEndLine: q.code_snippet.end_line ?? null,
            difficulty: q.difficulty,
            expectedConcepts: q.expected_concepts,
          })
          .run();
      });

      tx.insert(codeAttempts)
        .values({
          id: attemptId,
          codeQuizId,
          userId,
          status: 'in_progress',
          totalScore: null,
          maxPossibleScore: generatedQuestions.length * 10,
        })
        .run();
    });

    return {
      codeQuizId,
      attemptId,
      totalQuestions: generatedQuestions.length,
      status: 'in_progress',
    };
  }

  async getActiveCodeAttempt(
    userId: string,
    attemptId: string,
    database = db
  ): Promise<ActiveCodeAttempt> {
    const attempt = database
      .select()
      .from(codeAttempts)
      .where(and(eq(codeAttempts.id, attemptId), eq(codeAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new CodeQuizError(
        'Code quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    const quiz = database
      .select()
      .from(codeQuizzes)
      .where(eq(codeQuizzes.id, attempt.codeQuizId))
      .get();

    if (!quiz) {
      throw new CodeQuizError('Associated code quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    const questionsList = database
      .select()
      .from(codeQuestions)
      .where(eq(codeQuestions.codeQuizId, quiz.id))
      .orderBy(codeQuestions.questionOrder)
      .all();

    const answersList = database
      .select()
      .from(codeAnswers)
      .where(eq(codeAnswers.codeAttemptId, attemptId))
      .all();

    const answersMap = new Map(answersList.map((a) => [a.codeQuestionId, a]));

    const questions: ActiveCodeQuestion[] = questionsList.map((q) => {
      const ans = answersMap.get(q.id);
      return {
        id: q.id,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        codeSnippetPath: q.codeSnippetPath,
        codeSnippetContent: q.codeSnippetContent,
        codeSnippetStartLine: q.codeSnippetStartLine,
        codeSnippetEndLine: q.codeSnippetEndLine,
        difficulty: q.difficulty,
        userAnswer: ans?.userAnswer ?? null,
        score: ans?.score ?? null,
        feedback: ans?.feedback ?? null,
        evaluatedAt: ans?.evaluatedAt ?? null,
      };
    });

    const answeredCount = answersList.filter((a) => a.userAnswer && a.userAnswer.trim().length > 0).length;

    return {
      attemptId: attempt.id,
      codeQuizId: quiz.id,
      repoUrl: quiz.repoUrl,
      repoOwner: quiz.repoOwner,
      repoName: quiz.repoName,
      status: attempt.status,
      totalQuestions: questionsList.length,
      answeredQuestions: answeredCount,
      totalScore: attempt.totalScore,
      maxPossibleScore: attempt.maxPossibleScore,
      questions,
    };
  }

  async restartCodeQuiz(
    userId: string,
    codeQuizId: string,
    database = db
  ): Promise<{
    codeQuizId: string;
    attemptId: string;
    totalQuestions: number;
    status: 'in_progress';
  }> {
    const quiz = database
      .select()
      .from(codeQuizzes)
      .where(and(eq(codeQuizzes.id, codeQuizId), eq(codeQuizzes.userId, userId)))
      .get();

    if (!quiz) {
      throw new CodeQuizError('Code quiz not found or unauthorized.', 404, 'QUIZ_NOT_FOUND');
    }

    const questionsList = database
      .select({ id: codeQuestions.id })
      .from(codeQuestions)
      .where(eq(codeQuestions.codeQuizId, codeQuizId))
      .all();

    if (questionsList.length === 0) {
      throw new CodeQuizError('No questions found for this code quiz.', 404, 'QUESTIONS_NOT_FOUND');
    }

    const newAttemptId = crypto.randomUUID();

    database
      .insert(codeAttempts)
      .values({
        id: newAttemptId,
        codeQuizId,
        userId,
        status: 'in_progress',
        totalScore: null,
        maxPossibleScore: questionsList.length * 10,
      })
      .run();

    return {
      codeQuizId,
      attemptId: newAttemptId,
      totalQuestions: questionsList.length,
      status: 'in_progress',
    };
  }
}

export const codeQuizService = new CodeQuizService();
