import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { quizAttempts, quizzes, questions, choices, attemptAnswers, codeAttempts, codeQuizzes } from '../db/schema/index';
import {
  ActiveAttempt,
  AttemptResult,
  ChoiceId,
  ClientQuestion,
  HistoryItem,
  HistoryItemType,
  HistoryResponse,
  QuestionReview,
} from '@quiz-forge/shared';

export class AttemptError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AttemptError';
  }
}

export class AttemptService {
  async getActiveAttempt(
    userId: string,
    attemptId: string,
    database = db
  ): Promise<ActiveAttempt> {
    // 1. Fetch Attempt
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AttemptError(
        'Quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    // 2. Fetch Quiz metadata
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, attempt.quizId))
      .get();

    if (!quiz) {
      throw new AttemptError('Associated quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    // 3. Fetch all questions and choices for this quiz
    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, attempt.quizId))
      .all();

    const questionIds = quizQuestions.map((q) => q.id);

    const questionChoices = database
      .select()
      .from(choices)
      .where(inArray(choices.questionId, questionIds))
      .all();

    // Group choices by question ID
    const choicesByQuestion = new Map<string, Array<{ choice_id: ChoiceId; option_text: string }>>();
    for (const c of questionChoices) {
      const list = choicesByQuestion.get(c.questionId) || [];
      list.push({
        choice_id: c.choiceId as ChoiceId,
        option_text: c.optionText,
      });
      choicesByQuestion.set(c.questionId, list);
    }

    // Build question lookup
    const questionMap = new Map(quizQuestions.map((q) => [q.id, q]));

    // 4. Map questions strictly according to attempt's shuffledOrder
    // SECURITY: Strip correct_choice_id and explanation!
    const sanitizedQuestions: ClientQuestion[] = [];
    for (const qId of attempt.shuffledOrder) {
      const q = questionMap.get(qId);
      if (q) {
        const cList = (choicesByQuestion.get(qId) || []).sort((a, b) =>
          a.choice_id.localeCompare(b.choice_id)
        );
        sanitizedQuestions.push({
          question_id: q.id,
          question: q.questionText,
          choices: cList,
        });
      }
    }

    // 5. Fetch saved answers for this attempt
    const answers = database
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId))
      .all();

    const savedAnswers: Record<string, ChoiceId | null> = {};
    for (const ans of answers) {
      savedAnswers[ans.questionId] = (ans.selectedChoiceId as ChoiceId) ?? null;
    }

    return {
      attemptId: attempt.id,
      quizId: attempt.quizId,
      attemptNumber: attempt.attemptNumber,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      status: attempt.status,
      totalQuestions: attempt.totalQuestions,
      questions: sanitizedQuestions,
      savedAnswers,
    };
  }

  async saveAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    selectedChoiceId: ChoiceId | null,
    database = db
  ): Promise<{ questionId: string; selectedChoiceId: ChoiceId | null }> {
    // 1. Verify Attempt ownership and active status
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AttemptError(
        'Quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    if (attempt.status !== 'in_progress') {
      throw new AttemptError(
        'Cannot modify answers on a completed or abandoned attempt.',
        400,
        'ATTEMPT_ALREADY_COMPLETED'
      );
    }

    // 2. Verify question belongs to this quiz
    const question = database
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, questionId), eq(questions.quizId, attempt.quizId)))
      .get();

    if (!question) {
      throw new AttemptError(
        'Question does not belong to this quiz attempt.',
        400,
        'INVALID_QUESTION'
      );
    }

    // 3. Idempotent Upsert in attempt_answers
    const existing = database
      .select()
      .from(attemptAnswers)
      .where(
        and(
          eq(attemptAnswers.attemptId, attemptId),
          eq(attemptAnswers.questionId, questionId)
        )
      )
      .get();

    const now = new Date().toISOString();

    if (existing) {
      database
        .update(attemptAnswers)
        .set({
          selectedChoiceId,
          answeredAt: now,
        })
        .where(eq(attemptAnswers.id, existing.id))
        .run();
    } else {
      database
        .insert(attemptAnswers)
        .values({
          id: crypto.randomUUID(),
          attemptId,
          questionId,
          selectedChoiceId,
          answeredAt: now,
        })
        .run();
    }

    return { questionId, selectedChoiceId };
  }

  async submitAttempt(
    userId: string,
    attemptId: string,
    database = db
  ): Promise<AttemptResult> {
    // 1. Verify Attempt ownership
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AttemptError(
        'Quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    if (attempt.status === 'completed') {
      throw new AttemptError(
        'Attempt has already been submitted.',
        400,
        'ATTEMPT_ALREADY_SUBMITTED'
      );
    }

    // 2. Query Quiz metadata
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, attempt.quizId))
      .get();

    if (!quiz) {
      throw new AttemptError('Associated quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    // 3. Query canonical questions with correct answers and explanations
    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, attempt.quizId))
      .all();

    const questionIds = quizQuestions.map((q) => q.id);

    const questionChoices = database
      .select()
      .from(choices)
      .where(inArray(choices.questionId, questionIds))
      .all();

    const choicesByQuestion = new Map<string, Array<{ choice_id: ChoiceId; option_text: string }>>();
    for (const c of questionChoices) {
      const list = choicesByQuestion.get(c.questionId) || [];
      list.push({
        choice_id: c.choiceId as ChoiceId,
        option_text: c.optionText,
      });
      choicesByQuestion.set(c.questionId, list);
    }

    const questionMap = new Map(quizQuestions.map((q) => [q.id, q]));

    // 4. Query user answers
    const userAnswers = database
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId))
      .all();

    const userAnswersMap = new Map(userAnswers.map((a) => [a.questionId, a]));

    // 5. Calculate Score Server-Side
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;

    const review: QuestionReview[] = [];
    const now = new Date().toISOString();

    database.transaction((tx) => {
      for (const qId of attempt.shuffledOrder) {
        const q = questionMap.get(qId);
        if (!q) continue;

        const ans = userAnswersMap.get(qId);
        const selected = (ans?.selectedChoiceId as ChoiceId) ?? null;
        const isCorrect = selected !== null && selected === q.correctChoiceId;

        if (selected === null) {
          unansweredCount++;
        } else if (isCorrect) {
          correctCount++;
        } else {
          incorrectCount++;
        }

        // Update answer record correctness
        if (ans) {
          tx.update(attemptAnswers)
            .set({ isCorrect })
            .where(eq(attemptAnswers.id, ans.id))
            .run();
        } else {
          tx.insert(attemptAnswers)
            .values({
              id: crypto.randomUUID(),
              attemptId,
              questionId: q.id,
              selectedChoiceId: null,
              isCorrect: false,
              answeredAt: now,
            })
            .run();
        }

        const cList = (choicesByQuestion.get(q.id) || []).sort((a, b) =>
          a.choice_id.localeCompare(b.choice_id)
        );

        review.push({
          question_id: q.id,
          question: q.questionText,
          choices: cList,
          selected_choice_id: selected,
          correct_choice_id: q.correctChoiceId as ChoiceId,
          is_correct: isCorrect,
          explanation: q.explanation,
        });
      }

      const totalQuestions = quizQuestions.length;
      const score = correctCount;
      const accuracyPercentage =
        totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 10000) / 100 : 0;

      // Finalize attempt
      tx.update(quizAttempts)
        .set({
          status: 'completed',
          score,
          totalQuestions,
          correctCount,
          incorrectCount,
          unansweredCount,
          accuracyPercentage,
          completedAt: now,
        })
        .where(eq(quizAttempts.id, attemptId))
        .run();
    });

    const totalQuestions = quizQuestions.length;
    const score = correctCount;
    const accuracyPercentage =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 10000) / 100 : 0;

    return {
      attemptId: attempt.id,
      quizId: attempt.quizId,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      attemptNumber: attempt.attemptNumber,
      score,
      totalQuestions,
      correctCount,
      incorrectCount,
      unansweredCount,
      accuracyPercentage,
      completedAt: now,
      review,
    };
  }

  async getCompletedResults(
    userId: string,
    attemptId: string,
    database = db
  ): Promise<AttemptResult> {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new AttemptError(
        'Quiz attempt not found or unauthorized.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    if (attempt.status !== 'completed') {
      throw new AttemptError(
        'Attempt is still in progress. Please submit the quiz first.',
        400,
        'ATTEMPT_NOT_COMPLETED'
      );
    }

    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, attempt.quizId))
      .get();

    if (!quiz) {
      throw new AttemptError('Associated quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, attempt.quizId))
      .all();

    const questionIds = quizQuestions.map((q) => q.id);

    const questionChoices = database
      .select()
      .from(choices)
      .where(inArray(choices.questionId, questionIds))
      .all();

    const choicesByQuestion = new Map<string, Array<{ choice_id: ChoiceId; option_text: string }>>();
    for (const c of questionChoices) {
      const list = choicesByQuestion.get(c.questionId) || [];
      list.push({
        choice_id: c.choiceId as ChoiceId,
        option_text: c.optionText,
      });
      choicesByQuestion.set(c.questionId, list);
    }

    const questionMap = new Map(quizQuestions.map((q) => [q.id, q]));

    const userAnswers = database
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId))
      .all();

    const userAnswersMap = new Map(userAnswers.map((a) => [a.questionId, a]));

    const review: QuestionReview[] = [];
    for (const qId of attempt.shuffledOrder) {
      const q = questionMap.get(qId);
      if (!q) continue;

      const ans = userAnswersMap.get(qId);
      const selected = (ans?.selectedChoiceId as ChoiceId) ?? null;
      const isCorrect = selected !== null && selected === q.correctChoiceId;

      const cList = (choicesByQuestion.get(q.id) || []).sort((a, b) =>
        a.choice_id.localeCompare(b.choice_id)
      );

      review.push({
        question_id: q.id,
        question: q.questionText,
        choices: cList,
        selected_choice_id: selected,
        correct_choice_id: q.correctChoiceId as ChoiceId,
        is_correct: isCorrect,
        explanation: q.explanation,
      });
    }

    return {
      attemptId: attempt.id,
      quizId: attempt.quizId,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      attemptNumber: attempt.attemptNumber,
      score: attempt.score ?? 0,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount ?? 0,
      incorrectCount: attempt.incorrectCount ?? 0,
      unansweredCount: attempt.unansweredCount ?? 0,
      accuracyPercentage: attempt.accuracyPercentage ?? 0,
      completedAt: attempt.completedAt ?? new Date().toISOString(),
      review,
    };
  }

  async getUserHistory(
    userId: string,
    page = 1,
    pageSize = 10,
    filterType: 'all' | 'mcq' | 'code' = 'all',
    database = db
  ): Promise<HistoryResponse> {
    const validPage = Math.max(1, page);
    const validPageSize = Math.min(50, Math.max(1, pageSize));
    const offset = (validPage - 1) * validPageSize;

    if (filterType === 'mcq') {
      const totalRow = database
        .select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.userId, userId),
            eq(quizAttempts.status, 'completed')
          )
        )
        .get();

      const total = totalRow ? Number(totalRow.count) : 0;

      const rows = database
        .select({
          attemptId: quizAttempts.id,
          quizId: quizAttempts.quizId,
          topic: quizzes.topic,
          difficulty: quizzes.difficulty,
          attemptNumber: quizAttempts.attemptNumber,
          score: quizAttempts.score,
          totalQuestions: quizAttempts.totalQuestions,
          accuracyPercentage: quizAttempts.accuracyPercentage,
          completedAt: quizAttempts.completedAt,
        })
        .from(quizAttempts)
        .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
        .where(
          and(
            eq(quizAttempts.userId, userId),
            eq(quizAttempts.status, 'completed')
          )
        )
        .orderBy(desc(quizAttempts.completedAt))
        .limit(validPageSize)
        .offset(offset)
        .all();

      const items: HistoryItem[] = rows.map((r) => ({
        attemptId: r.attemptId,
        quizId: r.quizId,
        type: 'mcq' as const,
        topic: r.topic,
        difficulty: r.difficulty,
        attemptNumber: r.attemptNumber,
        score: r.score ?? 0,
        maxScore: r.totalQuestions,
        totalQuestions: r.totalQuestions,
        accuracyPercentage: r.accuracyPercentage ?? 0,
        completedAt: r.completedAt ?? new Date().toISOString(),
      }));

      return {
        items,
        total,
        page: validPage,
        pageSize: validPageSize,
      };
    }

    if (filterType === 'code') {
      const totalRow = database
        .select({ count: sql<number>`count(*)` })
        .from(codeAttempts)
        .where(
          and(
            eq(codeAttempts.userId, userId),
            eq(codeAttempts.status, 'completed')
          )
        )
        .get();

      const total = totalRow ? Number(totalRow.count) : 0;

      const rows = database
        .select({
          attemptId: codeAttempts.id,
          codeQuizId: codeAttempts.codeQuizId,
          repoUrl: codeQuizzes.repoUrl,
          repoOwner: codeQuizzes.repoOwner,
          repoName: codeQuizzes.repoName,
          questionCount: codeQuizzes.questionCount,
          totalScore: codeAttempts.totalScore,
          maxPossibleScore: codeAttempts.maxPossibleScore,
          accuracyPercentage: codeAttempts.accuracyPercentage,
          completedAt: codeAttempts.completedAt,
          startedAt: codeAttempts.startedAt,
        })
        .from(codeAttempts)
        .innerJoin(codeQuizzes, eq(codeAttempts.codeQuizId, codeQuizzes.id))
        .where(
          and(
            eq(codeAttempts.userId, userId),
            eq(codeAttempts.status, 'completed')
          )
        )
        .orderBy(desc(codeAttempts.completedAt))
        .limit(validPageSize)
        .offset(offset)
        .all();

      const items: HistoryItem[] = rows.map((r) => ({
        attemptId: r.attemptId,
        quizId: r.codeQuizId,
        type: 'code_review' as const,
        topic: `${r.repoOwner}/${r.repoName}`,
        difficulty: 'mixed',
        attemptNumber: 1,
        score: r.totalScore ?? 0,
        maxScore: r.maxPossibleScore,
        totalQuestions: r.questionCount,
        accuracyPercentage: r.accuracyPercentage ?? 0,
        completedAt: r.completedAt ?? r.startedAt ?? new Date().toISOString(),
        repoUrl: r.repoUrl,
        repoOwner: r.repoOwner,
        repoName: r.repoName,
      }));

      return {
        items,
        total,
        page: validPage,
        pageSize: validPageSize,
      };
    }

    // Default: 'all' - Unified history
    const countRow = (database as any).get(sql<{ total: number }>`
      SELECT (
        (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = ${userId} AND status = 'completed') +
        (SELECT COUNT(*) FROM code_attempts WHERE user_id = ${userId} AND status = 'completed')
      ) as total
    `);
    const total = countRow ? Number(countRow.total) : 0;

    const rawRows = (database as any).all(sql<{
      attemptId: string;
      quizId: string;
      type: string;
      topic: string;
      difficulty: string;
      attemptNumber: number;
      score: number;
      maxScore: number;
      totalQuestions: number;
      accuracyPercentage: number;
      completedAt: string;
      repoUrl: string | null;
      repoOwner: string | null;
      repoName: string | null;
    }>`
      SELECT
        qa.id as attemptId,
        qa.quiz_id as quizId,
        'mcq' as type,
        q.topic as topic,
        q.difficulty as difficulty,
        qa.attempt_number as attemptNumber,
        COALESCE(qa.score, 0) as score,
        qa.total_questions as maxScore,
        qa.total_questions as totalQuestions,
        COALESCE(qa.accuracy_percentage, 0) as accuracyPercentage,
        COALESCE(qa.completed_at, ${new Date().toISOString()}) as completedAt,
        NULL as repoUrl,
        NULL as repoOwner,
        NULL as repoName
      FROM quiz_attempts qa
      INNER JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.user_id = ${userId} AND qa.status = 'completed'

      UNION ALL

      SELECT
        ca.id as attemptId,
        ca.code_quiz_id as quizId,
        'code_review' as type,
        (cq.repo_owner || '/' || cq.repo_name) as topic,
        'mixed' as difficulty,
        1 as attemptNumber,
        COALESCE(ca.total_score, 0) as score,
        ca.max_possible_score as maxScore,
        cq.question_count as totalQuestions,
        COALESCE(ca.accuracy_percentage, 0) as accuracyPercentage,
        COALESCE(ca.completed_at, ca.started_at) as completedAt,
        cq.repo_url as repoUrl,
        cq.repo_owner as repoOwner,
        cq.repo_name as repoName
      FROM code_attempts ca
      INNER JOIN code_quizzes cq ON ca.code_quiz_id = cq.id
      WHERE ca.user_id = ${userId} AND ca.status = 'completed'

      ORDER BY completedAt DESC
      LIMIT ${validPageSize} OFFSET ${offset}
    `);

    const items: HistoryItem[] = (rawRows || []).map((r: any) => ({
      attemptId: r.attemptId,
      quizId: r.quizId,
      type: (r.type === 'code_review' ? 'code_review' : 'mcq') as HistoryItemType,
      topic: r.topic,
      difficulty: r.difficulty,
      attemptNumber: r.attemptNumber ?? 1,
      score: r.score,
      maxScore: r.maxScore,
      totalQuestions: r.totalQuestions,
      accuracyPercentage: r.accuracyPercentage,
      completedAt: r.completedAt,
      repoUrl: r.repoUrl ?? undefined,
      repoOwner: r.repoOwner ?? undefined,
      repoName: r.repoName ?? undefined,
    }));

    return {
      items,
      total,
      page: validPage,
      pageSize: validPageSize,
    };
  }
}

export const attemptService = new AttemptService();
