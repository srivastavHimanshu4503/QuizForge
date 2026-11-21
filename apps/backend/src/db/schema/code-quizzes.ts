import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const codeQuizzes = sqliteTable(
  'code_quizzes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    repoUrl: text('repo_url').notNull(),
    repoOwner: text('repo_owner').notNull(),
    repoName: text('repo_name').notNull(),
    branch: text('branch').notNull().default('main'),
    questionCount: integer('question_count').notNull(),
    llmProvider: text('llm_provider').notNull(),
    llmModel: text('llm_model').notNull(),
    filesAnalyzed: integer('files_analyzed').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('code_quizzes_user_id_idx').on(table.userId),
  ]
);

export type CodeQuiz = typeof codeQuizzes.$inferSelect;
export type NewCodeQuiz = typeof codeQuizzes.$inferInsert;
