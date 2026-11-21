import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { questions } from './questions';

export const choices = sqliteTable(
  'choices',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    choiceId: text('choice_id', { enum: ['A', 'B', 'C', 'D'] }).notNull(),
    optionText: text('option_text').notNull(),
  },
  (table) => [
    uniqueIndex('choices_question_id_choice_id_idx').on(table.questionId, table.choiceId),
    index('choices_question_id_idx').on(table.questionId),
  ]
);

export type Choice = typeof choices.$inferSelect;
export type NewChoice = typeof choices.$inferInsert;
