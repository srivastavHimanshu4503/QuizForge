import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { quizAttempts } from './attempts';
import { questions } from './questions';

export const attemptAnswers = sqliteTable(
  'attempt_answers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedChoiceId: text('selected_choice_id', { enum: ['A', 'B', 'C', 'D'] }),
    isCorrect: integer('is_correct', { mode: 'boolean' }),
    answeredAt: text('answered_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('answers_attempt_id_question_id_idx').on(table.attemptId, table.questionId),
    index('answers_attempt_id_idx').on(table.attemptId),
  ]
);

export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswers.$inferInsert;
