import { eq, and, lte, or, inArray, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  flashcardDecks,
  flashcardCards,
  flashcardReviews,
} from '../db/schema/flashcards';
import { quizzes } from '../db/schema/quizzes';
import { questions } from '../db/schema/questions';
import { choices } from '../db/schema/choices';
import { quizAttempts } from '../db/schema/attempts';
import { attemptAnswers } from '../db/schema/answers';
import type {
  FlashcardDeckDto,
  FlashcardCardDto,
  FlashcardReviewResultDto,
  FlashcardStatsDto,
  FlashcardState,
  FlashcardRating,
  CreateFlashcardDeckInput,
  CreateFlashcardCardInput,
  ImportMistakesInput,
  GenerateFromQuizInput,
} from '@quiz-forge/shared';

export class FlashcardsService {
  /**
   * SuperMemo SM-2 Spaced Repetition calculation algorithm
   * rating: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
   */
  calculateNextReview(
    current: {
      repetitionNumber: number;
      easinessFactor: number;
      intervalDays: number;
      lapses: number;
    },
    rating: FlashcardRating
  ): {
    repetitionNumber: number;
    easinessFactor: number;
    intervalDays: number;
    lapses: number;
    dueDate: string;
    state: FlashcardState;
  } {
    let repetition = current.repetitionNumber;
    let ef = current.easinessFactor;
    let interval = current.intervalDays;
    let lapses = current.lapses;
    let state: FlashcardState = 'review';

    if (rating === 1) {
      // Again (complete lapse)
      repetition = 0;
      interval = 1;
      lapses += 1;
      ef = Math.max(1.3, Number((ef - 0.2).toFixed(2)));
      state = 'learning';
    } else if (rating === 2) {
      // Hard
      interval = repetition > 0 ? Math.max(1, Math.round(interval * 1.2)) : 1;
      ef = Math.max(1.3, Number((ef - 0.15).toFixed(2)));
      repetition += 1;
      state = interval >= 21 ? 'mastered' : 'review';
    } else if (rating === 3) {
      // Good
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * ef);
      }
      repetition += 1;
      state = interval >= 21 ? 'mastered' : 'review';
    } else if (rating === 4) {
      // Easy
      if (repetition === 0) {
        interval = 4;
      } else if (repetition === 1) {
        interval = 8;
      } else {
        interval = Math.round(Math.max(interval * ef * 1.3, interval + 4));
      }
      ef = Math.min(3.5, Number((ef + 0.15).toFixed(2)));
      repetition += 1;
      state = interval >= 21 ? 'mastered' : 'review';
    }

    const dueDate = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString();

    return {
      repetitionNumber: repetition,
      easinessFactor: ef,
      intervalDays: interval,
      lapses,
      dueDate,
      state,
    };
  }

  async getOverallStats(userId: string): Promise<FlashcardStatsDto> {
    const now = new Date().toISOString();

    const userDecks = db
      .select({ id: flashcardDecks.id })
      .from(flashcardDecks)
      .where(eq(flashcardDecks.userId, userId))
      .all();

    const userCards = db
      .select()
      .from(flashcardCards)
      .where(eq(flashcardCards.userId, userId))
      .all();

    const totalDecks = userDecks.length;
    const totalCards = userCards.length;
    let dueTodayCount = 0;
    let masteredCount = 0;
    let learningCount = 0;
    let newCount = 0;

    for (const card of userCards) {
      if (card.state === 'mastered') {
        masteredCount++;
      } else if (card.state === 'learning') {
        learningCount++;
      } else if (card.state === 'new') {
        newCount++;
      }

      if (card.state === 'new' || card.dueDate <= now) {
        dueTodayCount++;
      }
    }

    const reviews = db
      .select({ reviewedAt: flashcardReviews.reviewedAt })
      .from(flashcardReviews)
      .where(eq(flashcardReviews.userId, userId))
      .orderBy(desc(flashcardReviews.reviewedAt))
      .all();

    // Calculate review streak in days
    let streakDays = 0;
    if (reviews.length > 0) {
      const dates = new Set(reviews.map((r) => r.reviewedAt.slice(0, 10)));
      const todayStr = now.slice(0, 10);
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      let currentCheck = dates.has(todayStr) ? new Date() : dates.has(yesterdayStr) ? new Date(Date.now() - 86400000) : null;

      if (currentCheck) {
        while (true) {
          const checkStr = currentCheck.toISOString().slice(0, 10);
          if (dates.has(checkStr)) {
            streakDays++;
            currentCheck = new Date(currentCheck.getTime() - 86400000);
          } else {
            break;
          }
        }
      }
    }

    return {
      totalDecks,
      totalCards,
      dueTodayCount,
      masteredCount,
      learningCount,
      newCount,
      streakDays,
      totalReviewsDone: reviews.length,
    };
  }

  async getUserDecks(userId: string): Promise<FlashcardDeckDto[]> {
    const now = new Date().toISOString();

    const decks = db
      .select({
        id: flashcardDecks.id,
        userId: flashcardDecks.userId,
        title: flashcardDecks.title,
        description: flashcardDecks.description,
        quizId: flashcardDecks.quizId,
        createdAt: flashcardDecks.createdAt,
        updatedAt: flashcardDecks.updatedAt,
        quizTitle: quizzes.topic,
      })
      .from(flashcardDecks)
      .leftJoin(quizzes, eq(flashcardDecks.quizId, quizzes.id))
      .where(eq(flashcardDecks.userId, userId))
      .orderBy(desc(flashcardDecks.createdAt))
      .all();

    const result: FlashcardDeckDto[] = [];

    for (const deck of decks) {
      const cards = db
        .select({
          id: flashcardCards.id,
          dueDate: flashcardCards.dueDate,
          state: flashcardCards.state,
        })
        .from(flashcardCards)
        .where(eq(flashcardCards.deckId, deck.id))
        .all();

      let dueCards = 0;
      let newCards = 0;
      let learningCards = 0;
      let reviewCards = 0;
      let masteredCards = 0;

      for (const c of cards) {
        if (c.state === 'new') newCards++;
        else if (c.state === 'learning') learningCards++;
        else if (c.state === 'review') reviewCards++;
        else if (c.state === 'mastered') masteredCards++;

        if (c.state === 'new' || c.dueDate <= now) {
          dueCards++;
        }
      }

      result.push({
        id: deck.id,
        userId: deck.userId,
        title: deck.title,
        description: deck.description,
        quizId: deck.quizId,
        quizTitle: deck.quizTitle ?? null,
        totalCards: cards.length,
        dueCards,
        newCards,
        learningCards,
        reviewCards,
        masteredCards,
        createdAt: deck.createdAt,
        updatedAt: deck.updatedAt,
      });
    }

    return result;
  }

  async getDeckById(deckId: string, userId: string): Promise<FlashcardDeckDto | null> {
    const now = new Date().toISOString();

    const row = db
      .select({
        id: flashcardDecks.id,
        userId: flashcardDecks.userId,
        title: flashcardDecks.title,
        description: flashcardDecks.description,
        quizId: flashcardDecks.quizId,
        createdAt: flashcardDecks.createdAt,
        updatedAt: flashcardDecks.updatedAt,
        quizTitle: quizzes.topic,
      })
      .from(flashcardDecks)
      .leftJoin(quizzes, eq(flashcardDecks.quizId, quizzes.id))
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .get();

    if (!row) return null;

    const cards = db
      .select({
        dueDate: flashcardCards.dueDate,
        state: flashcardCards.state,
      })
      .from(flashcardCards)
      .where(eq(flashcardCards.deckId, deckId))
      .all();

    let dueCards = 0;
    let newCards = 0;
    let learningCards = 0;
    let reviewCards = 0;
    let masteredCards = 0;

    for (const c of cards) {
      if (c.state === 'new') newCards++;
      else if (c.state === 'learning') learningCards++;
      else if (c.state === 'review') reviewCards++;
      else if (c.state === 'mastered') masteredCards++;

      if (c.state === 'new' || c.dueDate <= now) {
        dueCards++;
      }
    }

    return {
      id: row.id,
      userId: row.userId,
      title: row.title,
      description: row.description,
      quizId: row.quizId,
      quizTitle: row.quizTitle ?? null,
      totalCards: cards.length,
      dueCards,
      newCards,
      learningCards,
      reviewCards,
      masteredCards,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async createDeck(userId: string, data: CreateFlashcardDeckInput): Promise<FlashcardDeckDto> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.insert(flashcardDecks)
      .values({
        id,
        userId,
        title: data.title,
        description: data.description ?? null,
        quizId: data.quizId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const deck = await this.getDeckById(id, userId);
    if (!deck) throw new Error('Failed to create deck');
    return deck;
  }

  async deleteDeck(deckId: string, userId: string): Promise<boolean> {
    const result = db
      .delete(flashcardDecks)
      .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
      .run();
    return result.changes > 0;
  }

  async getStudyCards(
    deckId: string,
    userId: string,
    mode: 'due' | 'all' = 'due'
  ): Promise<FlashcardCardDto[]> {
    const deck = await this.getDeckById(deckId, userId);
    if (!deck) throw new Error('Deck not found');

    const now = new Date().toISOString();

    const cards = db
      .select()
      .from(flashcardCards)
      .where(
        mode === 'due'
          ? and(
              eq(flashcardCards.deckId, deckId),
              eq(flashcardCards.userId, userId),
              or(eq(flashcardCards.state, 'new'), lte(flashcardCards.dueDate, now))
            )
          : and(eq(flashcardCards.deckId, deckId), eq(flashcardCards.userId, userId))
      )
      .all();

    // Sort: 'new' first, then earliest due date
    cards.sort((a, b) => {
      if (a.state === 'new' && b.state !== 'new') return -1;
      if (a.state !== 'new' && b.state === 'new') return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return cards.map((c) => ({
      id: c.id,
      deckId: c.deckId,
      userId: c.userId,
      questionId: c.questionId,
      front: c.front,
      back: c.back,
      explanation: c.explanation,
      repetitionNumber: c.repetitionNumber,
      easinessFactor: c.easinessFactor,
      intervalDays: c.intervalDays,
      dueDate: c.dueDate,
      state: c.state as FlashcardState,
      lastReviewedAt: c.lastReviewedAt,
      reviewCount: c.reviewCount,
      lapses: c.lapses,
      createdAt: c.createdAt,
    }));
  }

  async createCard(userId: string, data: CreateFlashcardCardInput): Promise<FlashcardCardDto> {
    const deck = await this.getDeckById(data.deckId, userId);
    if (!deck) throw new Error('Deck not found');

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.insert(flashcardCards)
      .values({
        id,
        deckId: data.deckId,
        userId,
        questionId: data.questionId ?? null,
        front: data.front,
        back: data.back,
        explanation: data.explanation ?? null,
        repetitionNumber: 0,
        easinessFactor: 2.5,
        intervalDays: 0,
        dueDate: now,
        state: 'new',
        lastReviewedAt: null,
        reviewCount: 0,
        lapses: 0,
        createdAt: now,
      })
      .run();

    const card = db
      .select()
      .from(flashcardCards)
      .where(eq(flashcardCards.id, id))
      .get();

    if (!card) throw new Error('Failed to create card');

    return {
      id: card.id,
      deckId: card.deckId,
      userId: card.userId,
      questionId: card.questionId,
      front: card.front,
      back: card.back,
      explanation: card.explanation,
      repetitionNumber: card.repetitionNumber,
      easinessFactor: card.easinessFactor,
      intervalDays: card.intervalDays,
      dueDate: card.dueDate,
      state: card.state as FlashcardState,
      lastReviewedAt: card.lastReviewedAt,
      reviewCount: card.reviewCount,
      lapses: card.lapses,
      createdAt: card.createdAt,
    };
  }

  async deleteCard(cardId: string, userId: string): Promise<boolean> {
    const result = db
      .delete(flashcardCards)
      .where(and(eq(flashcardCards.id, cardId), eq(flashcardCards.userId, userId)))
      .run();
    return result.changes > 0;
  }

  async reviewCard(
    cardId: string,
    userId: string,
    rating: FlashcardRating
  ): Promise<FlashcardReviewResultDto> {
    const card = db
      .select()
      .from(flashcardCards)
      .where(and(eq(flashcardCards.id, cardId), eq(flashcardCards.userId, userId)))
      .get();

    if (!card) throw new Error('Card not found');

    const next = this.calculateNextReview(
      {
        repetitionNumber: card.repetitionNumber,
        easinessFactor: card.easinessFactor,
        intervalDays: card.intervalDays,
        lapses: card.lapses,
      },
      rating
    );

    const now = new Date().toISOString();

    // Log the review event
    db.insert(flashcardReviews)
      .values({
        id: crypto.randomUUID(),
        cardId: card.id,
        userId,
        rating,
        previousInterval: card.intervalDays,
        newInterval: next.intervalDays,
        previousEf: card.easinessFactor,
        newEf: next.easinessFactor,
        reviewedAt: now,
      })
      .run();

    // Update card state
    db.update(flashcardCards)
      .set({
        repetitionNumber: next.repetitionNumber,
        easinessFactor: next.easinessFactor,
        intervalDays: next.intervalDays,
        dueDate: next.dueDate,
        state: next.state,
        lastReviewedAt: now,
        reviewCount: card.reviewCount + 1,
        lapses: next.lapses,
      })
      .where(eq(flashcardCards.id, card.id))
      .run();

    return {
      cardId: card.id,
      rating,
      previousInterval: card.intervalDays,
      newInterval: next.intervalDays,
      previousEf: card.easinessFactor,
      newEf: next.easinessFactor,
      dueDate: next.dueDate,
      state: next.state,
      repetitionNumber: next.repetitionNumber,
    };
  }

  async importMistakes(
    userId: string,
    data: ImportMistakesInput
  ): Promise<{ importedCount: number; deckId: string | null; message: string }> {
    // 1. Find completed quiz attempts
    const attempts = db
      .select({ id: quizAttempts.id, quizId: quizAttempts.quizId })
      .from(quizAttempts)
      .where(
        data.quizId
          ? and(
              eq(quizAttempts.userId, userId),
              eq(quizAttempts.status, 'completed'),
              eq(quizAttempts.quizId, data.quizId)
            )
          : and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, 'completed'))
      )
      .all();

    if (attempts.length === 0) {
      return { importedCount: 0, deckId: null, message: 'No completed quiz attempts found.' };
    }

    const attemptIds = attempts.map((a) => a.id);

    // 2. Find incorrect answers in those attempts
    const wrongAnswers = db
      .select({
        questionId: attemptAnswers.questionId,
      })
      .from(attemptAnswers)
      .where(
        and(
          inArray(attemptAnswers.attemptId, attemptIds),
          eq(attemptAnswers.isCorrect, false)
        )
      )
      .all();

    if (wrongAnswers.length === 0) {
      return { importedCount: 0, deckId: null, message: 'Great job! No incorrect answers found to import.' };
    }

    const questionIds = Array.from(new Set(wrongAnswers.map((w) => w.questionId)));

    // 3. Find or create deck
    let targetDeckTitle = data.deckTitle || 'Mistakes & Weak Areas';
    if (!data.deckTitle && data.quizId) {
      const quiz = db.select({ topic: quizzes.topic }).from(quizzes).where(eq(quizzes.id, data.quizId)).get();
      if (quiz) {
        targetDeckTitle = `${quiz.topic} - Mistakes`;
      }
    }

    const existingDeck = db
      .select()
      .from(flashcardDecks)
      .where(and(eq(flashcardDecks.userId, userId), eq(flashcardDecks.title, targetDeckTitle)))
      .get();

    let deckId: string;
    if (!existingDeck) {
      const newDeck = await this.createDeck(userId, {
        title: targetDeckTitle,
        description: 'Auto-generated spaced repetition deck from your missed quiz questions.',
        quizId: data.quizId,
      });
      deckId = newDeck.id;
    } else {
      deckId = existingDeck.id;
    }

    // 4. Fetch existing cards in deck to prevent duplicates
    const existingCards = db
      .select({ questionId: flashcardCards.questionId })
      .from(flashcardCards)
      .where(eq(flashcardCards.deckId, deckId))
      .all();
    const existingQuestionIdSet = new Set(existingCards.map((c) => c.questionId).filter(Boolean));

    let importedCount = 0;

    // 5. Query question & choices details
    for (const qId of questionIds) {
      if (existingQuestionIdSet.has(qId)) continue;

      const q = db.select().from(questions).where(eq(questions.id, qId)).get();
      if (!q) continue;

      const qChoices = db.select().from(choices).where(eq(choices.questionId, qId)).all();
      const correctChoice = qChoices.find((c) => c.choiceId === q.correctChoiceId);

      const frontText = q.questionText;
      const backText = correctChoice
        ? `${correctChoice.choiceId}: ${correctChoice.optionText}`
        : `Option ${q.correctChoiceId}`;

      await this.createCard(userId, {
        deckId,
        questionId: q.id,
        front: frontText,
        back: backText,
        explanation: q.explanation ?? undefined,
      });

      importedCount++;
    }

    return {
      importedCount,
      deckId,
      message: `Successfully imported ${importedCount} missed question${importedCount === 1 ? '' : 's'} into your flashcards!`,
    };
  }

  async generateFromQuiz(
    userId: string,
    data: GenerateFromQuizInput
  ): Promise<{ importedCount: number; deckId: string; title: string }> {
    const quiz = db.select().from(quizzes).where(eq(quizzes.id, data.quizId)).get();
    if (!quiz) throw new Error('Quiz not found');

    const deckTitle = data.deckTitle || `${quiz.topic} - Flashcards`;

    const deck = await this.createDeck(userId, {
      title: deckTitle,
      description: `Spaced repetition flashcards generated from "${quiz.topic}".`,
      quizId: quiz.id,
    });

    const quizQuestions = db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .orderBy(questions.questionOrder)
      .all();

    let count = 0;
    for (const q of quizQuestions) {
      const qChoices = db.select().from(choices).where(eq(choices.questionId, q.id)).all();
      const correctChoice = qChoices.find((c) => c.choiceId === q.correctChoiceId);

      const front = q.questionText;
      const back = correctChoice
        ? `${correctChoice.choiceId}: ${correctChoice.optionText}`
        : `Option ${q.correctChoiceId}`;

      await this.createCard(userId, {
        deckId: deck.id,
        questionId: q.id,
        front,
        back,
        explanation: q.explanation ?? undefined,
      });
      count++;
    }

    return {
      importedCount: count,
      deckId: deck.id,
      title: deckTitle,
    };
  }
}

export const flashcardsService = new FlashcardsService();
