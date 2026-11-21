import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { quizzes } from './quizzes';

export const questions = sqliteTable(
  'questions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    questionOrder: integer('question_order').notNull(),
    questionText: text('question_text').notNull(),
    correctChoiceId: text('correct_choice_id', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
    explanation: text('explanation').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('questions_quiz_id_order_idx').on(table.quizId, table.questionOrder),
    index('questions_quiz_id_idx').on(table.quizId),
  ]
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
