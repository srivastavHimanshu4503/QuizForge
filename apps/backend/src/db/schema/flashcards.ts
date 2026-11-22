import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';
import { quizzes } from './quizzes';
import { questions } from './questions';

export const flashcardDecks = sqliteTable(
  'flashcard_decks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    quizId: text('quiz_id').references(() => quizzes.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('decks_user_id_idx').on(table.userId),
    index('decks_quiz_id_idx').on(table.quizId),
  ]
);

export const flashcardCards = sqliteTable(
  'flashcard_cards',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deckId: text('deck_id')
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: text('question_id').references(() => questions.id, { onDelete: 'set null' }),
    front: text('front').notNull(),
    back: text('back').notNull(),
    explanation: text('explanation'),
    repetitionNumber: integer('repetition_number').notNull().default(0),
    easinessFactor: real('easiness_factor').notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    dueDate: text('due_date')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    state: text('state', { enum: ['new', 'learning', 'review', 'mastered'] })
      .notNull()
      .default('new'),
    lastReviewedAt: text('last_reviewed_at'),
    reviewCount: integer('review_count').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('cards_deck_id_idx').on(table.deckId),
    index('cards_user_id_idx').on(table.userId),
    index('cards_due_date_idx').on(table.dueDate),
    index('cards_state_idx').on(table.state),
  ]
);

export const flashcardReviews = sqliteTable(
  'flashcard_reviews',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    cardId: text('card_id')
      .notNull()
      .references(() => flashcardCards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    previousInterval: integer('previous_interval').notNull(),
    newInterval: integer('new_interval').notNull(),
    previousEf: real('previous_ef').notNull(),
    newEf: real('new_ef').notNull(),
    reviewedAt: text('reviewed_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('reviews_card_id_idx').on(table.cardId),
    index('reviews_user_id_idx').on(table.userId),
    index('reviews_reviewed_at_idx').on(table.reviewedAt),
  ]
);

export type FlashcardDeck = typeof flashcardDecks.$inferSelect;
export type NewFlashcardDeck = typeof flashcardDecks.$inferInsert;

export type FlashcardCard = typeof flashcardCards.$inferSelect;
export type NewFlashcardCard = typeof flashcardCards.$inferInsert;

export type FlashcardReview = typeof flashcardReviews.$inferSelect;
export type NewFlashcardReview = typeof flashcardReviews.$inferInsert;
