import { sqliteTable, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { codeAttempts } from './code-attempts';
import { codeQuestions } from './code-questions';

export const codeAnswers = sqliteTable(
  'code_answers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    codeAttemptId: text('code_attempt_id')
      .notNull()
      .references(() => codeAttempts.id, { onDelete: 'cascade' }),
    codeQuestionId: text('code_question_id')
      .notNull()
      .references(() => codeQuestions.id, { onDelete: 'cascade' }),
    userAnswer: text('user_answer').notNull(),
    score: real('score'),
    accuracyScore: real('accuracy_score'),
    depthScore: real('depth_score'),
    completenessScore: real('completeness_score'),
    feedback: text('feedback'),
    evaluatedAt: text('evaluated_at'),
    evaluationProvider: text('evaluation_provider'),
  },
  (table) => [
    uniqueIndex('code_answers_attempt_question_idx').on(table.codeAttemptId, table.codeQuestionId),
    index('code_answers_attempt_idx').on(table.codeAttemptId),
  ]
);

export type CodeAnswer = typeof codeAnswers.$inferSelect;
export type NewCodeAnswer = typeof codeAnswers.$inferInsert;
