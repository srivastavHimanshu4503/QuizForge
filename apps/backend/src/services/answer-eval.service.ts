import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { codeAttempts, codeQuizzes, codeQuestions, codeAnswers } from '../db/schema/index';
import { llmRegistry } from './llm/provider-registry';
import {
  buildAnswerEvaluationSystemPrompt,
  buildAnswerEvaluationUserPrompt,
} from './llm/prompts/answer-eval.prompt';
import { answerEvaluationSchema, AnswerEvaluation } from '@quiz-forge/shared';
import { LLMProviderError } from './llm/llm.interface';

export class AnswerEvaluationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AnswerEvaluationError';
  }
}

export class AnswerEvaluationService {
  async evaluateAndSaveAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    userAnswerText: string,
    database = db
  ): Promise<{
    questionId: string;
    evaluation: AnswerEvaluation;
    evaluatedAt: string;
  }> {
    // 1. Verify Attempt ownership and active status
    const attempt = database
      .select()
      .from(codeAttempts)
      .where(and(eq(codeAttempts.id, attemptId), eq(codeAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AnswerEvaluationError(
        'Code quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    if (attempt.status !== 'in_progress') {
      throw new AnswerEvaluationError(
        'Cannot modify answers on a completed attempt.',
        400,
        'ATTEMPT_ALREADY_COMPLETED'
      );
    }

    // 2. Fetch Quiz and Question
    const quiz = database
      .select()
      .from(codeQuizzes)
      .where(eq(codeQuizzes.id, attempt.codeQuizId))
      .get();

    const question = database
      .select()
      .from(codeQuestions)
      .where(and(eq(codeQuestions.id, questionId), eq(codeQuestions.codeQuizId, attempt.codeQuizId)))
      .get();

    if (!question || !quiz) {
      throw new AnswerEvaluationError(
        'Question does not belong to this code quiz attempt.',
        400,
        'INVALID_QUESTION'
      );
    }

    // 3. Choose LLM Provider
    let provider = llmRegistry.get(quiz.llmProvider);
    if (!provider.isAvailable) {
      provider = llmRegistry.getDefaultProvider();
    }

    // 4. Construct Evaluation Prompts
    const systemPrompt = buildAnswerEvaluationSystemPrompt();
    const userPrompt = buildAnswerEvaluationUserPrompt({
      question: question.questionText,
      codeSnippet: question.codeSnippetContent,
      filePath: question.codeSnippetPath,
      expectedConcepts: question.expectedConcepts,
      userAnswer: userAnswerText,
    });

    // 5. Evaluate via LLM
    let evaluation: AnswerEvaluation;
    try {
      const completion = await provider.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          responseFormat: { type: 'json_object' },
          temperature: 0.1, // Near deterministic evaluation
        }
      );

      let parsed: unknown;
      try {
        parsed = JSON.parse(completion.content);
      } catch (parseErr) {
        throw new AnswerEvaluationError(
          'LLM evaluation did not return valid JSON.',
          502,
          'INVALID_EVALUATION_FORMAT',
          parseErr
        );
      }

      const validated = answerEvaluationSchema.safeParse(parsed);
      if (!validated.success) {
        throw new AnswerEvaluationError(
          'Evaluation response failed schema validation.',
          502,
          'SCHEMA_VALIDATION_ERROR',
          validated.error.format()
        );
      }

      evaluation = validated.data;
    } catch (err: unknown) {
      if (err instanceof AnswerEvaluationError) throw err;
      if (err instanceof LLMProviderError) {
        throw new AnswerEvaluationError(
          `LLM Evaluation Failed: ${err.message}`,
          err.statusCode,
          err.code,
          err.details
        );
      }
      throw new AnswerEvaluationError(
        `Failed to evaluate answer: ${err instanceof Error ? err.message : String(err)}`,
        502,
        'EVALUATION_ERROR',
        err
      );
    }

    // 6. Idempotent Upsert in code_answers
    const now = new Date().toISOString();
    const existing = database
      .select()
      .from(codeAnswers)
      .where(
        and(
          eq(codeAnswers.codeAttemptId, attemptId),
          eq(codeAnswers.codeQuestionId, questionId)
        )
      )
      .get();

    if (existing) {
      database
        .update(codeAnswers)
        .set({
          userAnswer: userAnswerText,
          score: evaluation.score,
          accuracyScore: evaluation.accuracy_score,
          depthScore: evaluation.depth_score,
          completenessScore: evaluation.completeness_score,
          feedback: evaluation.feedback,
          evaluatedAt: now,
          evaluationProvider: provider.name,
        })
        .where(eq(codeAnswers.id, existing.id))
        .run();
    } else {
      database
        .insert(codeAnswers)
        .values({
          id: crypto.randomUUID(),
          codeAttemptId: attemptId,
          codeQuestionId: questionId,
          userAnswer: userAnswerText,
          score: evaluation.score,
          accuracyScore: evaluation.accuracy_score,
          depthScore: evaluation.depth_score,
          completenessScore: evaluation.completeness_score,
          feedback: evaluation.feedback,
          evaluatedAt: now,
          evaluationProvider: provider.name,
        })
        .run();
    }

    return {
      questionId,
      evaluation,
      evaluatedAt: now,
    };
  }

  async submitCodeAttempt(
    userId: string,
    attemptId: string,
    database = db
  ) {
    const attempt = database
      .select()
      .from(codeAttempts)
      .where(and(eq(codeAttempts.id, attemptId), eq(codeAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AnswerEvaluationError(
        'Code quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    if (attempt.status === 'completed') {
      throw new AnswerEvaluationError(
        'Attempt has already been submitted.',
        400,
        'ATTEMPT_ALREADY_SUBMITTED'
      );
    }

    // Calculate total score from answers
    const answers = database
      .select()
      .from(codeAnswers)
      .where(eq(codeAnswers.codeAttemptId, attemptId))
      .all();

    const totalScore = answers.reduce((sum, a) => sum + (a.score || 0), 0);
    const accuracyPercentage =
      attempt.maxPossibleScore > 0
        ? Math.round((totalScore / attempt.maxPossibleScore) * 10000) / 100
        : 0;

    const now = new Date().toISOString();

    database
      .update(codeAttempts)
      .set({
        status: 'completed',
        totalScore,
        accuracyPercentage,
        completedAt: now,
      })
      .where(eq(codeAttempts.id, attemptId))
      .run();

    return this.getCompletedCodeResults(userId, attemptId, database);
  }

  async getCompletedCodeResults(
    userId: string,
    attemptId: string,
    database = db
  ) {
    const attempt = database
      .select()
      .from(codeAttempts)
      .where(and(eq(codeAttempts.id, attemptId), eq(codeAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AnswerEvaluationError(
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
      throw new AnswerEvaluationError('Associated code quiz not found.', 404, 'QUIZ_NOT_FOUND');
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

    const reviews = questionsList.map((q) => {
      const ans = answersMap.get(q.id);
      return {
        questionId: q.id,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        codeSnippetPath: q.codeSnippetPath,
        codeSnippetContent: q.codeSnippetContent,
        codeSnippetStartLine: q.codeSnippetStartLine,
        codeSnippetEndLine: q.codeSnippetEndLine,
        difficulty: q.difficulty,
        expectedConcepts: q.expectedConcepts,
        userAnswer: ans?.userAnswer ?? null,
        score: ans?.score ?? 0,
        accuracyScore: ans?.accuracyScore ?? 0,
        depthScore: ans?.depthScore ?? 0,
        completenessScore: ans?.completenessScore ?? 0,
        feedback: ans?.feedback ?? 'No answer provided.',
        evaluatedAt: ans?.evaluatedAt ?? null,
      };
    });

    return {
      attemptId: attempt.id,
      codeQuizId: quiz.id,
      repoUrl: quiz.repoUrl,
      repoOwner: quiz.repoOwner,
      repoName: quiz.repoName,
      branch: quiz.branch,
      status: attempt.status,
      totalScore: attempt.totalScore ?? 0,
      maxPossibleScore: attempt.maxPossibleScore,
      accuracyPercentage: attempt.accuracyPercentage ?? 0,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      reviews,
    };
  }
}

export const answerEvaluationService = new AnswerEvaluationService();
