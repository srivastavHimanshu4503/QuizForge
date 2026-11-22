import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { quizzes } from './quizzes';
import { questions } from './questions';
import { users } from './users';

export const arenaSessions = sqliteTable(
  'arena_sessions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    hostId: text('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pin: text('pin').notNull().unique(),
    status: text('status', {
      enum: ['lobby', 'question', 'leaderboard', 'finished', 'abandoned'],
    })
      .notNull()
      .default('lobby'),
    currentQuestionIndex: integer('current_question_index').notNull().default(0),
    totalQuestions: integer('total_questions').notNull(),
    timePerQuestionSeconds: integer('time_per_question_seconds').notNull().default(30),
    questionStartedAt: text('question_started_at'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    endedAt: text('ended_at'),
  },
  (table) => [
    uniqueIndex('arena_sessions_pin_idx').on(table.pin),
    index('arena_sessions_host_id_idx').on(table.hostId),
    index('arena_sessions_status_idx').on(table.status),
  ]
);

export const arenaParticipants = sqliteTable(
  'arena_participants',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => arenaSessions.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    nickname: text('nickname').notNull(),
    score: integer('score').notNull().default(0),
    streak: integer('streak').notNull().default(0),
    joinedAt: text('joined_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('arena_participants_session_nickname_idx').on(table.sessionId, table.nickname),
    index('arena_participants_session_id_idx').on(table.sessionId),
  ]
);

export const arenaAnswers = sqliteTable(
  'arena_answers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionId: text('session_id')
      .notNull()
      .references(() => arenaSessions.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => arenaParticipants.id, { onDelete: 'cascade' }),
    questionId: text('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedChoiceId: text('selected_choice_id').notNull(),
    isCorrect: integer('is_correct', { mode: 'boolean' }).notNull(),
    responseTimeMs: integer('response_time_ms').notNull(),
    pointsAwarded: integer('points_awarded').notNull(),
    answeredAt: text('answered_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('arena_answers_session_participant_q_idx').on(
      table.sessionId,
      table.participantId,
      table.questionId
    ),
    index('arena_answers_session_question_idx').on(table.sessionId, table.questionId),
  ]
);

export type ArenaSession = typeof arenaSessions.$inferSelect;
export type NewArenaSession = typeof arenaSessions.$inferInsert;
export type ArenaParticipant = typeof arenaParticipants.$inferSelect;
export type NewArenaParticipant = typeof arenaParticipants.$inferInsert;
export type ArenaAnswer = typeof arenaAnswers.$inferSelect;
export type NewArenaAnswer = typeof arenaAnswers.$inferInsert;
