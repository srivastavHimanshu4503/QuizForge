import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { quizAttempts } from './attempts';
import { quizzes } from './quizzes';
import { users } from './users';

export const certificates = sqliteTable(
  'certificates',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    attemptId: text('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientName: text('recipient_name').notNull(),
    quizTitle: text('quiz_title').notNull(),
    score: integer('score').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    percentage: real('percentage').notNull(),
    verificationCode: text('verification_code').notNull().unique(),
    issuedAt: text('issued_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('certificates_attempt_id_idx').on(table.attemptId),
    uniqueIndex('certificates_verification_code_idx').on(table.verificationCode),
    index('certificates_user_id_idx').on(table.userId),
  ]
);

export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
