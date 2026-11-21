import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';
import { codeQuizzes } from './code-quizzes';
import { users } from './users';

export const codeAttempts = sqliteTable(
  'code_attempts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    codeQuizId: text('code_quiz_id')
      .notNull()
      .references(() => codeQuizzes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['in_progress', 'completed'] })
      .notNull()
      .default('in_progress'),
    totalScore: real('total_score'),
    maxPossibleScore: real('max_possible_score').notNull(),
    accuracyPercentage: real('accuracy_percentage'),
    startedAt: text('started_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('code_attempts_user_id_idx').on(table.userId),
    index('code_attempts_quiz_id_idx').on(table.codeQuizId),
  ]
);

export type CodeAttempt = typeof codeAttempts.$inferSelect;
export type NewCodeAttempt = typeof codeAttempts.$inferInsert;
