import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { quizzes, questions, choices, quizAttempts } from '../db/schema/index';
import { aiService } from './ai/ai.service';
import { shuffleArray } from '../utils/shuffle';
import { GenerateQuizInput } from '@quiz-forge/shared';
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
    // 1. Generate questions via AI Provider
    const generatedQuestions = await aiService.generateQuizQuestions(input);

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
          aiModel: env.GEMINI_MODEL,
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
}

export const quizService = new QuizService();
