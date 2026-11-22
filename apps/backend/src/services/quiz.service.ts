import { eq, and, inArray, desc } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index';
import { quizzes, questions, choices, quizAttempts, codeQuizzes, quizAssignments } from '../db/schema/index';
import { aiService } from './ai/ai.service';
import { shuffleArray } from '../utils/shuffle';
import {
  ChoiceId,
  ClientQuestion,
  CreatedQuizSummaryDto,
  GenerateQuizInput,
  QuizMetadata,
  QuizStudioPayload,
  StudioChoice,
  StudioQuestion,
  UpdateQuizStudioInput,
  updateQuizStudioSchema,
} from '@quiz-forge/shared';
import { env } from '../config/env';

export class QuizError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'QuizError';
  }
}

export class QuizService {
  async generateAndSaveQuiz(
    userId: string,
    input: GenerateQuizInput,
    database = db
  ): Promise<{
    quizId: string;
    attemptId: string;
    totalQuestions: number;
    status: 'in_progress';
  }> {
    // 1. Generate questions via AI Provider (supporting multi-provider selection)
    const generatedQuestions = await aiService.generateQuizQuestions(input, input.provider);

    const quizId = crypto.randomUUID();
    const attemptId = crypto.randomUUID();
    const createdQuestionIds: string[] = [];

    // 2. Persist in database
    database.transaction((tx) => {
      // Insert Quiz
      tx.insert(quizzes)
        .values({
          id: quizId,
          userId,
          topic: input.topic.trim(),
          difficulty: input.difficulty,
          questionCount: generatedQuestions.length,
          aiModel: input.provider || env.GEMINI_MODEL,
        })
        .run();

      // Insert Questions & Choices
      generatedQuestions.forEach((q, index) => {
        const questionId = crypto.randomUUID();
        createdQuestionIds.push(questionId);

        tx.insert(questions)
          .values({
            id: questionId,
            quizId,
            questionOrder: index + 1,
            questionText: q.question,
            correctChoiceId: q.correct_answer_id,
            explanation: q.explanation,
          })
          .run();

        const choiceRecords = q.choices.map((c) => ({
          id: crypto.randomUUID(),
          questionId,
          choiceId: c.choice_id,
          optionText: c.option_text,
        }));

        tx.insert(choices).values(choiceRecords).run();
      });

      // 3. Initialize Attempt #1 with shuffled question sequence
      const shuffledOrder = shuffleArray(createdQuestionIds);

      tx.insert(quizAttempts)
        .values({
          id: attemptId,
          quizId,
          userId,
          attemptNumber: 1,
          status: 'in_progress',
          shuffledOrder,
          totalQuestions: generatedQuestions.length,
        })
        .run();
    });

    return {
      quizId,
      attemptId,
      totalQuestions: generatedQuestions.length,
      status: 'in_progress',
    };
  }

  async restartQuiz(
    userId: string,
    quizId: string,
    database = db
  ): Promise<{
    quizId: string;
    attemptId: string;
    attemptNumber: number;
    totalQuestions: number;
    status: 'in_progress';
  }> {
    // 1. Verify Quiz ownership
    const quiz = database
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .get();

    if (!quiz) {
      throw new QuizError(
        'Quiz not found or you do not have permission to access it.',
        404,
        'QUIZ_NOT_FOUND'
      );
    }

    // 2. Fetch existing questions (Zero Gemini API calls)
    const existingQuestions = database
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .all();

    if (existingQuestions.length === 0) {
      throw new QuizError(
        'No questions found for this quiz.',
        404,
        'QUESTIONS_NOT_FOUND'
      );
    }

    const questionIds = existingQuestions.map((q) => q.id);

    // 3. Determine next attempt number
    const existingAttempts = database
      .select({ attemptNumber: quizAttempts.attemptNumber })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId))
      .all();

    const maxAttemptNumber = existingAttempts.reduce(
      (max, a) => Math.max(max, a.attemptNumber),
      0
    );
    const nextAttemptNumber = maxAttemptNumber + 1;

    // 4. Create fresh attempt with new shuffled order
    const newAttemptId = crypto.randomUUID();
    const newShuffledOrder = shuffleArray(questionIds);

    database
      .insert(quizAttempts)
      .values({
        id: newAttemptId,
        quizId,
        userId,
        attemptNumber: nextAttemptNumber,
        status: 'in_progress',
        shuffledOrder: newShuffledOrder,
        totalQuestions: questionIds.length,
      })
      .run();

    return {
      quizId,
      attemptId: newAttemptId,
      attemptNumber: nextAttemptNumber,
      totalQuestions: questionIds.length,
      status: 'in_progress',
    };
  }

  async getQuizMetadata(userId: string, quizId: string, database = db) {
    const quiz = database
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .get();

    if (!quiz) {
      throw new QuizError(
        'Quiz not found or unauthorized.',
        404,
        'QUIZ_NOT_FOUND'
      );
    }

    return quiz;
  }

  async getQuizStudioPayload(
    userId: string,
    quizId: string,
    database = db
  ): Promise<QuizStudioPayload> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      throw new QuizError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.userId !== userId) {
      throw new QuizError(
        'Unauthorized. Only the quiz creator can access the Review Studio.',
        403,
        'FORBIDDEN'
      );
    }

    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .all();

    quizQuestions.sort((a, b) => a.questionOrder - b.questionOrder);

    const questionIds = quizQuestions.map((q) => q.id);
    const quizChoices =
      questionIds.length > 0
        ? database.select().from(choices).where(inArray(choices.questionId, questionIds)).all()
        : [];

    const choicesMap = new Map<string, StudioChoice[]>();
    for (const c of quizChoices) {
      const list = choicesMap.get(c.questionId) || [];
      list.push({
        choice_id: c.choiceId as ChoiceId,
        option_text: c.optionText,
      });
      choicesMap.set(c.questionId, list);
    }

    const studioQuestions: StudioQuestion[] = quizQuestions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      choices: (choicesMap.get(q.id) || []).sort((a, b) => a.choice_id.localeCompare(b.choice_id)),
      correctChoiceId: q.correctChoiceId as ChoiceId,
      explanation: q.explanation,
    }));

    return {
      id: quiz.id,
      userId: quiz.userId,
      topic: quiz.topic,
      difficulty: quiz.difficulty as any,
      questionCount: quiz.questionCount,
      aiModel: quiz.aiModel,
      status: quiz.status as any,
      isPublic: Boolean(quiz.isPublic),
      shareCode: quiz.shareCode,
      createdAt: quiz.createdAt,
      questions: studioQuestions,
    };
  }

  async updateQuizStudio(
    userId: string,
    quizId: string,
    input: UpdateQuizStudioInput,
    database = db
  ): Promise<QuizStudioPayload> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      throw new QuizError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.userId !== userId) {
      throw new QuizError(
        'Unauthorized. Only the quiz creator can modify questions in the Review Studio.',
        403,
        'FORBIDDEN'
      );
    }

    const data = updateQuizStudioSchema.parse(input);

    database.transaction((tx) => {
      // 1. Update quiz table metadata
      tx.update(quizzes)
        .set({
          topic: data.topic ? data.topic.trim() : quiz.topic,
          difficulty: data.difficulty ?? quiz.difficulty,
          questionCount: data.questions.length,
          isPublic: data.isPublic !== undefined ? (data.isPublic ? 1 : 0) : quiz.isPublic,
        })
        .where(eq(quizzes.id, quizId))
        .run();

      // 2. Clear existing questions and choices for this quiz
      const existingQuestions = tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.quizId, quizId))
        .all();

      const existingQIds = existingQuestions.map((q) => q.id);
      if (existingQIds.length > 0) {
        tx.delete(choices).where(inArray(choices.questionId, existingQIds)).run();
      }
      tx.delete(questions).where(eq(questions.quizId, quizId)).run();

      // 3. Insert updated questions and choices
      data.questions.forEach((q, index) => {
        const questionId = q.id || crypto.randomUUID();
        tx.insert(questions)
          .values({
            id: questionId,
            quizId,
            questionOrder: index + 1,
            questionText: q.questionText,
            correctChoiceId: q.correctChoiceId,
            explanation: q.explanation,
          })
          .run();

        const choiceRows = q.choices.map((c) => ({
          id: crypto.randomUUID(),
          questionId,
          choiceId: c.choice_id,
          optionText: c.option_text,
        }));
        tx.insert(choices).values(choiceRows).run();
      });
    });

    return this.getQuizStudioPayload(userId, quizId, database);
  }

  async publishQuiz(
    userId: string,
    quizId: string,
    database = db
  ): Promise<{ status: 'published'; shareCode: string }> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      throw new QuizError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.userId !== userId) {
      throw new QuizError('Unauthorized.', 403, 'FORBIDDEN');
    }

    const shareCode = quiz.shareCode || crypto.randomBytes(4).toString('hex');

    database
      .update(quizzes)
      .set({
        status: 'published',
        isPublic: 1,
        shareCode,
      })
      .where(eq(quizzes.id, quizId))
      .run();

    return {
      status: 'published',
      shareCode,
    };
  }

  async unpublishQuiz(
    userId: string,
    quizId: string,
    database = db
  ): Promise<{ status: 'draft' }> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      throw new QuizError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    if (quiz.userId !== userId) {
      throw new QuizError('Unauthorized.', 403, 'FORBIDDEN');
    }

    database
      .update(quizzes)
      .set({
        status: 'draft',
      })
      .where(eq(quizzes.id, quizId))
      .run();

    return {
      status: 'draft',
    };
  }

  async getPublicQuizByShareCode(
    shareCode: string,
    database = db
  ): Promise<{ quiz: QuizMetadata; questions: ClientQuestion[] }> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.shareCode, shareCode), eq(quizzes.status, 'published')))
      .get();

    if (!quiz) {
      throw new QuizError(
        'Shared quiz not found or is currently private.',
        404,
        'QUIZ_NOT_FOUND'
      );
    }

    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .all();

    quizQuestions.sort((a, b) => a.questionOrder - b.questionOrder);
    const questionIds = quizQuestions.map((q) => q.id);

    const questionChoices =
      questionIds.length > 0
        ? database.select().from(choices).where(inArray(choices.questionId, questionIds)).all()
        : [];

    const choicesMap = new Map<string, Array<{ choice_id: ChoiceId; option_text: string }>>();
    for (const c of questionChoices) {
      const list = choicesMap.get(c.questionId) || [];
      list.push({
        choice_id: c.choiceId as ChoiceId,
        option_text: c.optionText,
      });
      choicesMap.set(c.questionId, list);
    }

    const sanitizedQuestions: ClientQuestion[] = quizQuestions.map((q) => ({
      question_id: q.id,
      question: q.questionText,
      choices: (choicesMap.get(q.id) || []).sort((a, b) => a.choice_id.localeCompare(b.choice_id)),
    }));

    return {
      quiz: {
        id: quiz.id,
        userId: quiz.userId,
        topic: quiz.topic,
        difficulty: quiz.difficulty as any,
        questionCount: quiz.questionCount,
        aiModel: quiz.aiModel,
        status: quiz.status as any,
        isPublic: Boolean(quiz.isPublic),
        shareCode: quiz.shareCode,
        createdAt: quiz.createdAt,
      },
      questions: sanitizedQuestions,
    };
  }

  async startPublicQuizAttempt(
    userId: string,
    shareCode: string,
    database = db
  ): Promise<{ attemptId: string; quizId: string }> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.shareCode, shareCode), eq(quizzes.status, 'published')))
      .get();

    if (!quiz) {
      throw new QuizError(
        'Shared quiz not found or is currently private.',
        404,
        'QUIZ_NOT_FOUND'
      );
    }

    const existingQuestions = database
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .all();

    if (existingQuestions.length === 0) {
      throw new QuizError('This quiz does not contain any questions.', 400, 'NO_QUESTIONS');
    }

    const questionIds = existingQuestions.map((q) => q.id);

    // Determine user's attempt number for this quiz
    const userAttempts = database
      .select({ attemptNumber: quizAttempts.attemptNumber })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, userId)))
      .all();

    const maxAttemptNumber = userAttempts.reduce((max, a) => Math.max(max, a.attemptNumber), 0);
    const nextAttemptNumber = maxAttemptNumber + 1;

    const attemptId = crypto.randomUUID();
    const shuffledOrder = shuffleArray(questionIds);

    database
      .insert(quizAttempts)
      .values({
        id: attemptId,
        quizId: quiz.id,
        userId,
        attemptNumber: nextAttemptNumber,
        status: 'in_progress',
        shuffledOrder,
        totalQuestions: questionIds.length,
      })
      .run();

    return {
      attemptId,
      quizId: quiz.id,
    };
  }

  async getUserQuizzes(
    userId: string,
    database = db
  ): Promise<CreatedQuizSummaryDto[]> {
    const userMcqQuizzes = database
      .select({
        id: quizzes.id,
        topic: quizzes.topic,
        difficulty: quizzes.difficulty,
        questionCount: quizzes.questionCount,
        status: quizzes.status,
        shareCode: quizzes.shareCode,
        createdAt: quizzes.createdAt,
      })
      .from(quizzes)
      .where(eq(quizzes.userId, userId))
      .orderBy(desc(quizzes.createdAt))
      .all();

    const userCodeQuizzes = database
      .select({
        id: codeQuizzes.id,
        repoName: codeQuizzes.repoName,
        questionCount: codeQuizzes.questionCount,
        createdAt: codeQuizzes.createdAt,
      })
      .from(codeQuizzes)
      .where(eq(codeQuizzes.userId, userId))
      .orderBy(desc(codeQuizzes.createdAt))
      .all();

    const formattedMcqs: CreatedQuizSummaryDto[] = userMcqQuizzes.map((q) => ({
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      questionCount: q.questionCount,
      quizType: 'mcq',
      status: q.status,
      shareCode: q.shareCode,
      createdAt: q.createdAt,
    }));

    const formattedCode: CreatedQuizSummaryDto[] = userCodeQuizzes.map((q) => ({
      id: q.id,
      topic: `Code Review: ${q.repoName}`,
      difficulty: 'medium',
      questionCount: q.questionCount,
      quizType: 'code_review',
      status: 'published',
      shareCode: null,
      createdAt: q.createdAt,
    }));

    return [...formattedMcqs, ...formattedCode].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async deleteQuiz(
    userId: string,
    quizId: string,
    database = db
  ): Promise<{ success: boolean; id: string }> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId)))
      .get();

    if (!quiz) {
      throw new QuizError(
        'Quiz not found or you do not have permission to delete it.',
        404,
        'QUIZ_NOT_FOUND'
      );
    }

    database.transaction((tx) => {
      // Remove any assignments referencing this quiz
      tx.delete(quizAssignments).where(eq(quizAssignments.quizId, quizId)).run();
      // Delete quiz (cascades to questions, choices, attempts, answers)
      tx.delete(quizzes).where(eq(quizzes.id, quizId)).run();
    });

    return { success: true, id: quizId };
  }
}

export const quizService = new QuizService();
