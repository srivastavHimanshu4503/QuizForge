import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { classrooms } from './classrooms';
import { users } from './users';

export const classroomMembers = sqliteTable(
  'classroom_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: text('joined_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('classroom_members_class_student_idx').on(table.classroomId, table.studentId),
    index('classroom_members_student_id_idx').on(table.studentId),
  ]
);

export type ClassroomMember = typeof classroomMembers.$inferSelect;
export type NewClassroomMember = typeof classroomMembers.$inferInsert;
