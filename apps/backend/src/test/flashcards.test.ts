import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { db } from '../db';
import { quizzes } from '../db/schema/quizzes';
import { questions } from '../db/schema/questions';
import { choices } from '../db/schema/choices';
import { quizAttempts } from '../db/schema/attempts';
import { attemptAnswers } from '../db/schema/answers';
import { flashcardsService } from '../services/flashcards.service';

describe('Milestone 12: Adaptive Spaced Repetition & Flashcards Engine', () => {
  let app: FastifyInstance;
  let user1Cookie: string;
  let user1Id: string;
  let user2Cookie: string;
  let testQuizId: string;
  let testQuestionId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register User 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `flashcard.user1.${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Flashcard Student One',
      },
    });
    expect(res1.statusCode).toBe(201);
    const body1 = JSON.parse(res1.payload);
    user1Id = body1.data.user.id;
    const cookieHeader1 = res1.headers['set-cookie'];
    user1Cookie = Array.isArray(cookieHeader1) ? cookieHeader1[0]! : (cookieHeader1 as string);

    // Register User 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `flashcard.user2.${Date.now()}@example.com`,
        password: 'Password123!',
        displayName: 'Flashcard Student Two',
      },
    });
    expect(res2.statusCode).toBe(201);
    const cookieHeader2 = res2.headers['set-cookie'];
    user2Cookie = Array.isArray(cookieHeader2) ? cookieHeader2[0]! : (cookieHeader2 as string);

    // Create a Quiz with Questions for Testing
    testQuizId = crypto.randomUUID();
    await db.insert(quizzes).values({
      id: testQuizId,
      userId: user1Id,
      topic: 'JavaScript Async Mastery',
      difficulty: 'medium',
      questionCount: 2,
    });

    testQuestionId = crypto.randomUUID();
    await db.insert(questions).values({
      id: testQuestionId,
      quizId: testQuizId,
      questionOrder: 1,
      questionText: 'What does Promise.all() do when one promise rejects?',
      correctChoiceId: 'B',
      explanation: 'Promise.all rejects immediately with the first rejected promise.',
    });

    await db.insert(choices).values([
      { id: crypto.randomUUID(), questionId: testQuestionId, choiceId: 'A', optionText: 'Waits for all to settle' },
      { id: crypto.randomUUID(), questionId: testQuestionId, choiceId: 'B', optionText: 'Rejects immediately with that error' },
      { id: crypto.randomUUID(), questionId: testQuestionId, choiceId: 'C', optionText: 'Ignores the rejection' },
      { id: crypto.randomUUID(), questionId: testQuestionId, choiceId: 'D', optionText: 'Retries the promise' },
    ]);

    const q2Id = crypto.randomUUID();
    await db.insert(questions).values({
      id: q2Id,
      quizId: testQuizId,
      questionOrder: 2,
      questionText: 'What is the return type of an async function?',
      correctChoiceId: 'A',
      explanation: 'Async functions always return a Promise.',
    });

    await db.insert(choices).values([
      { id: crypto.randomUUID(), questionId: q2Id, choiceId: 'A', optionText: 'Promise' },
      { id: crypto.randomUUID(), questionId: q2Id, choiceId: 'B', optionText: 'Observable' },
      { id: crypto.randomUUID(), questionId: q2Id, choiceId: 'C', optionText: 'Generator' },
      { id: crypto.randomUUID(), questionId: q2Id, choiceId: 'D', optionText: 'Callback' },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. SM-2 Unit Algorithm Tests
  describe('SM-2 Algorithm Logic', () => {
    it('handles rating 1 (Again / Lapse) correctly', () => {
      const current = {
        repetitionNumber: 3,
        easinessFactor: 2.5,
        intervalDays: 15,
        lapses: 0,
      };

      const result = flashcardsService.calculateNextReview(current, 1);
      expect(result.repetitionNumber).toBe(0);
      expect(result.intervalDays).toBe(1);
      expect(result.lapses).toBe(1);
      expect(result.easinessFactor).toBe(2.3);
      expect(result.state).toBe('learning');
    });

    it('handles rating 3 (Good) progression correctly', () => {
      // Repetition 0 -> interval 1
      const step1 = flashcardsService.calculateNextReview(
        { repetitionNumber: 0, easinessFactor: 2.5, intervalDays: 0, lapses: 0 },
        3
      );
      expect(step1.repetitionNumber).toBe(1);
      expect(step1.intervalDays).toBe(1);

      // Repetition 1 -> interval 6
      const step2 = flashcardsService.calculateNextReview(step1, 3);
      expect(step2.repetitionNumber).toBe(2);
      expect(step2.intervalDays).toBe(6);

      // Repetition 2 -> interval 6 * 2.5 = 15
      const step3 = flashcardsService.calculateNextReview(step2, 3);
      expect(step3.repetitionNumber).toBe(3);
      expect(step3.intervalDays).toBe(15);
      expect(step3.state).toBe('review');

      // Repetition 3 -> interval 15 * 2.5 = 38 -> mastered (interval >= 21)
      const step4 = flashcardsService.calculateNextReview(step3, 3);
      expect(step4.intervalDays).toBe(38);
      expect(step4.state).toBe('mastered');
    });

    it('handles rating 4 (Easy) interval bonus and EF increase', () => {
      const step1 = flashcardsService.calculateNextReview(
        { repetitionNumber: 0, easinessFactor: 2.5, intervalDays: 0, lapses: 0 },
        4
      );
      expect(step1.intervalDays).toBe(4);
      expect(step1.easinessFactor).toBe(2.65);
    });
  });

  // 2. Deck & Card CRUD Integration Tests
  describe('Deck & Card Management', () => {
    let createdDeckId: string;
    let createdCardId: string;

    it('creates a new flashcard deck', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flashcards/decks',
        headers: { cookie: user1Cookie },
        payload: {
          title: 'TypeScript Advanced Types',
          description: 'Key utility types and generics',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.title).toBe('TypeScript Advanced Types');
      expect(body.totalCards).toBe(0);
      createdDeckId = body.id;
    });

    it('adds a card to the deck', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flashcards/cards',
        headers: { cookie: user1Cookie },
        payload: {
          deckId: createdDeckId,
          front: 'What does ReturnType<T> do in TypeScript?',
          back: 'Constructs a type consisting of the return type of function type T.',
          explanation: 'Useful for inferring function outputs dynamically.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.state).toBe('new');
      expect(body.repetitionNumber).toBe(0);
      createdCardId = body.id;
    });

    it('retrieves study cards for due practice', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/flashcards/decks/${createdDeckId}/study`,
        headers: { cookie: user1Cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].id).toBe(createdCardId);
    });

    it('reviews a card and advances its SM-2 schedule', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/flashcards/cards/${createdCardId}/review`,
        headers: { cookie: user1Cookie },
        payload: { rating: 3 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.cardId).toBe(createdCardId);
      expect(body.repetitionNumber).toBe(1);
      expect(body.newInterval).toBe(1);
    });

    it('retrieves overall user stats', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/flashcards/stats',
        headers: { cookie: user1Cookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.totalDecks).toBeGreaterThanOrEqual(1);
      expect(body.totalCards).toBeGreaterThanOrEqual(1);
      expect(body.totalReviewsDone).toBeGreaterThanOrEqual(1);
    });
  });

  // 3. Automated Generation from Mistakes and Quizzes
  describe('Mistakes Import and Quiz Deck Generation', () => {
    it('imports missed quiz questions from completed attempts', async () => {
      // Create a completed attempt with an incorrect answer for testQuestionId
      const attemptId = crypto.randomUUID();
      await db.insert(quizAttempts).values({
        id: attemptId,
        quizId: testQuizId,
        userId: user1Id,
        attemptNumber: 1,
        status: 'completed',
        shuffledOrder: [testQuestionId],
        totalQuestions: 1,
        correctCount: 0,
        incorrectCount: 1,
        accuracyPercentage: 0,
        completedAt: new Date().toISOString(),
      });

      await db.insert(attemptAnswers).values({
        id: crypto.randomUUID(),
        attemptId,
        questionId: testQuestionId,
        selectedChoiceId: 'A', // Incorrect answer (correct is B)
        isCorrect: false,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/flashcards/import-mistakes',
        headers: { cookie: user1Cookie },
        payload: { quizId: testQuizId },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.importedCount).toBe(1);
      expect(body.deckId).toBeDefined();

      // Ensure second import does not create duplicates
      const repeatRes = await app.inject({
        method: 'POST',
        url: '/api/flashcards/import-mistakes',
        headers: { cookie: user1Cookie },
        payload: { quizId: testQuizId },
      });

      expect(repeatRes.statusCode).toBe(200);
      const repeatBody = JSON.parse(repeatRes.payload);
      expect(repeatBody.importedCount).toBe(0);
    });

    it('generates a full flashcard deck from any quiz', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/flashcards/generate-from-quiz',
        headers: { cookie: user1Cookie },
        payload: { quizId: testQuizId },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.importedCount).toBe(2);
      expect(body.deckId).toBeDefined();

      const studyRes = await app.inject({
        method: 'GET',
        url: `/api/flashcards/decks/${body.deckId}/study?mode=all`,
        headers: { cookie: user1Cookie },
      });

      expect(studyRes.statusCode).toBe(200);
      const studyBody = JSON.parse(studyRes.payload);
      expect(studyBody.length).toBe(2);
    });
  });

  // 4. Access Control Isolation
  describe('Access Control Isolation', () => {
    it('prevents user 2 from reading or reviewing user 1 decks', async () => {
      // User 1 creates deck
      const deckRes = await app.inject({
        method: 'POST',
        url: '/api/flashcards/decks',
        headers: { cookie: user1Cookie },
        payload: { title: 'Private Deck' },
      });

      const privateDeckId = JSON.parse(deckRes.payload).id;

      // User 2 tries to fetch User 1 deck
      const res = await app.inject({
        method: 'GET',
        url: `/api/flashcards/decks/${privateDeckId}`,
        headers: { cookie: user2Cookie },
      });

      expect(res.statusCode).toBe(404);

      // User 2 tries to delete User 1 deck
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/flashcards/decks/${privateDeckId}`,
        headers: { cookie: user2Cookie },
      });

      expect(delRes.statusCode).toBe(404);
    });
  });
});
