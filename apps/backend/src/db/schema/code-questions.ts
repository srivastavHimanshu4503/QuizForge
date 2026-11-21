import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { codeQuizzes } from './code-quizzes';

export const codeQuestions = sqliteTable(
  'code_questions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    codeQuizId: text('code_quiz_id')
      .notNull()
      .references(() => codeQuizzes.id, { onDelete: 'cascade' }),
    questionOrder: integer('question_order').notNull(),
    questionText: text('question_text').notNull(),
    codeSnippetPath: text('code_snippet_path').notNull(),
    codeSnippetContent: text('code_snippet_content').notNull(),
    codeSnippetStartLine: integer('code_snippet_start_line'),
    codeSnippetEndLine: integer('code_snippet_end_line'),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull(),
    expectedConcepts: text('expected_concepts', { mode: 'json' })
      .notNull()
      .$type<string[]>(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('code_questions_quiz_order_idx').on(table.codeQuizId, table.questionOrder),
    index('code_questions_quiz_idx').on(table.codeQuizId),
  ]
);

export type CodeQuestion = typeof codeQuestions.$inferSelect;
export type NewCodeQuestion = typeof codeQuestions.$inferInsert;
