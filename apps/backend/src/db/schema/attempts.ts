import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { quizzes } from './quizzes';
import { users } from './users';

export const quizAttempts = sqliteTable(
  'quiz_attempts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] })
      .notNull()
      .default('in_progress'),
    shuffledOrder: text('shuffled_order', { mode: 'json' })
      .notNull()
      .$type<string[]>(),
    score: integer('score'),
    totalQuestions: integer('total_questions').notNull(),
    correctCount: integer('correct_count'),
    incorrectCount: integer('incorrect_count'),
    unansweredCount: integer('unanswered_count'),
    accuracyPercentage: real('accuracy_percentage'),
    startedAt: text('started_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    completedAt: text('completed_at'),
    assignmentId: text('assignment_id'),
    timeLimitMinutes: integer('time_limit_minutes'),
    tabSwitchCount: integer('tab_switch_count').default(0),
    isTimedOut: integer('is_timed_out', { mode: 'boolean' }).default(false),
    isAdaptive: integer('is_adaptive', { mode: 'boolean' }).notNull().default(false),
    currentTheta: real('current_theta').notNull().default(0.0),
    standardError: real('standard_error').notNull().default(1.0),
    abilityHistory: text('ability_history', { mode: 'json' })
      .notNull()
      .$type<
        Array<{
          step: number;
          questionId: string;
          theta: number;
          se: number;
          isCorrect: boolean;
          difficultyParam: number;
          difficultyTier: string;
        }>
      >()
      .$defaultFn(() => []),
  },
  (table) => [
    uniqueIndex('attempts_quiz_user_attempt_number_idx').on(table.quizId, table.userId, table.attemptNumber),
    index('attempts_user_id_completed_at_idx').on(table.userId, table.completedAt),
    index('attempts_assignment_id_idx').on(table.assignmentId),
  ]
);

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;
