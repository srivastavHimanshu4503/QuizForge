import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { quizzes } from './quizzes';

export const studyRooms = sqliteTable(
  'study_rooms',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    hostUserId: text('host_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    quizId: text('quiz_id').references(() => quizzes.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['active', 'ended'] })
      .notNull()
      .default('active'),
    maxParticipants: integer('max_participants').notNull().default(10),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    endedAt: text('ended_at'),
  },
  (table) => [
    uniqueIndex('study_rooms_code_idx').on(table.code),
    index('study_rooms_host_id_idx').on(table.hostUserId),
    index('study_rooms_status_idx').on(table.status),
  ]
);

export const studyRoomMembers = sqliteTable(
  'study_room_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    roomId: text('room_id')
      .notNull()
      .references(() => studyRooms.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['host', 'participant'] })
      .notNull()
      .default('participant'),
    joinedAt: text('joined_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('study_room_members_room_id_idx').on(table.roomId),
    index('study_room_members_user_id_idx').on(table.userId),
  ]
);
