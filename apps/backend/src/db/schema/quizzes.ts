import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const quizzes = sqliteTable(
  'quizzes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topic: text('topic').notNull(),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard', 'mixed'] }).notNull(),
    questionCount: integer('question_count').notNull(),
    aiModel: text('ai_model').notNull().default('gemini-2.5-flash'),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('published'),
    isPublic: integer('is_public').notNull().default(0),
    isAdaptive: integer('is_adaptive', { mode: 'boolean' }).notNull().default(false),
    shareCode: text('share_code').unique(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('quizzes_user_id_created_at_idx').on(table.userId, table.createdAt),
    uniqueIndex('quizzes_share_code_unique').on(table.shareCode),
  ]
);

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
