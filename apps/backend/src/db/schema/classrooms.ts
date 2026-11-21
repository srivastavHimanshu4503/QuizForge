import { sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const classrooms = sqliteTable(
  'classrooms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    code: text('code').notNull(),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('classrooms_code_idx').on(table.code),
    index('classrooms_teacher_id_idx').on(table.teacherId),
  ]
);

export type Classroom = typeof classrooms.$inferSelect;
export type NewClassroom = typeof classrooms.$inferInsert;
