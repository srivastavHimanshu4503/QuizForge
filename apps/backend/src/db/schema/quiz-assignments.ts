import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { classrooms } from './classrooms';
import { users } from './users';

export const quizAssignments = sqliteTable(
  'quiz_assignments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    quizId: text('quiz_id').notNull(),
    quizType: text('quiz_type', { enum: ['mcq', 'code_review'] })
      .notNull()
      .default('mcq'),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: text('due_date'),
    maxAttempts: integer('max_attempts').notNull().default(1),
    timeLimitMinutes: integer('time_limit_minutes'),
    shuffleQuestions: integer('shuffle_questions', { mode: 'boolean' })
      .notNull()
      .default(true),
    showFeedbackImmediately: integer('show_feedback_immediately', { mode: 'boolean' })
      .notNull()
      .default(true),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('quiz_assignments_classroom_id_idx').on(table.classroomId),
    index('quiz_assignments_teacher_id_idx').on(table.teacherId),
    index('quiz_assignments_quiz_id_idx').on(table.quizId),
  ]
);

export type QuizAssignment = typeof quizAssignments.$inferSelect;
export type NewQuizAssignment = typeof quizAssignments.$inferInsert;
