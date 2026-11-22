import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../db';
import { quizzes } from '../db/schema/quizzes';
import { questions } from '../db/schema/questions';
import { choices } from '../db/schema/choices';
import { quizAttempts } from '../db/schema/attempts';
import { flashcardDecks, flashcardCards } from '../db/schema/flashcards';

describe('Milestone 13: Offline-First PWA, Service Worker Cache & Background Sync', () => {
  let app: FastifyInstance;
  let userCookie: string;
  let userId: string;
  let testDeckId: string;
  let testCardId: string;
  let testQuizId: string;
  let testAttemptId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Register test user
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `pwa.sync.${Date.now()}@test.com`,
        password: 'Password123!',
        displayName: 'PWA Explorer',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const body = JSON.parse(regRes.payload);
    userId = body.data.user.id;
    const cookieHeader = regRes.headers['set-cookie'];
    userCookie = Array.isArray(cookieHeader) ? cookieHeader[0]! : (cookieHeader as string);

    // 2. Set up flashcard deck and card for sync testing
    testDeckId = crypto.randomUUID();
    db.insert(flashcardDecks)
      .values({
        id: testDeckId,
        userId,
        title: 'Offline Systems Architecture',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .run();

    testCardId = crypto.randomUUID();
    db.insert(flashcardCards)
      .values({
        id: testCardId,
        deckId: testDeckId,
        userId,
        front: 'What are the core properties of IndexedDB?',
        back: 'Transactional, object-oriented, persistent client-side key-value database.',
        createdAt: new Date().toISOString(),
      })
      .run();

    // 3. Set up quiz for attempt sync testing
    testQuizId = crypto.randomUUID();
    db.insert(quizzes)
      .values({
        id: testQuizId,
        userId,
        topic: 'Service Worker Lifecycle',
        difficulty: 'medium',
        questionCount: 1,
      })
      .run();

    const qId = crypto.randomUUID();
    db.insert(questions)
      .values({
        id: qId,
        quizId: testQuizId,
        questionOrder: 1,
        questionText: 'Which event triggers when a new Service Worker takes control?',
        correctChoiceId: 'A',
        explanation: 'The activate event cleans up old caches and clients.claim() takes immediate control.',
      })
      .run();

    db.insert(choices)
      .values([
        { id: crypto.randomUUID(), questionId: qId, choiceId: 'A', optionText: 'activate' },
        { id: crypto.randomUUID(), questionId: qId, choiceId: 'B', optionText: 'install' },
      ])
      .run();

    // Create an in-progress quiz attempt
    testAttemptId = crypto.randomUUID();
    db.insert(quizAttempts)
      .values({
        id: testAttemptId,
        quizId: testQuizId,
        userId,
        attemptNumber: 1,
        status: 'in_progress',
        shuffledOrder: [qId],
        totalQuestions: 1,
        startedAt: new Date().toISOString(),
      })
      .run();
  });

  afterAll(async () => {
    await app.close();
  });

  // 1. Manifest & Service Worker Static Verification
  describe('PWA Manifest & Service Worker Assets', () => {
    it('verifies manifest.webmanifest exists and contains valid PWA specification', () => {
      const manifestPath = path.resolve(__dirname, '../../../frontend/public/manifest.webmanifest');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(content);

      expect(manifest.name).toBe('QuizForge AI Assessment & Spaced Repetition');
      expect(manifest.short_name).toBe('QuizForge');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/');
      expect(manifest.theme_color).toBe('#1935CA');
      expect(Array.isArray(manifest.icons)).toBe(true);
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it('verifies sw.js exists with pre-cache and offline routing strategies', () => {
      const swPath = path.resolve(__dirname, '../../../frontend/public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf-8');
      expect(swContent).toContain('addEventListener(\'install\'');
      expect(swContent).toContain('addEventListener(\'activate\'');
      expect(swContent).toContain('addEventListener(\'fetch\'');
      expect(swContent).toContain('caches.open');
    });

    it('verifies PWA vector icon exists', () => {
      const iconPath = path.resolve(__dirname, '../../../frontend/public/icons/icon.svg');
      expect(fs.existsSync(iconPath)).toBe(true);
      const svg = fs.readFileSync(iconPath, 'utf-8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 512 512"');
    });
  });

  // 2. Background Sync Execution Verification
  describe('Offline Sync Replay Engine', () => {
    it('successfully processes offline-queued card review replay upon reconnecting', async () => {
      // Simulate client replaying an offline-queued rating of 3 (Good)
      const res = await app.inject({
        method: 'POST',
        url: `/api/flashcards/cards/${testCardId}/review`,
        headers: { cookie: userCookie },
        payload: { rating: 3 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.cardId).toBe(testCardId);
      expect(body.newInterval).toBe(1);
      expect(body.repetitionNumber).toBe(1);
    });

    it('successfully processes offline-queued quiz submission replay upon reconnecting', async () => {
      // 1. Replay queued answers
      const q = db.select().from(questions).where(eq(questions.quizId, testQuizId)).get();
      const patchRes = await app.inject({
        method: 'PATCH',
        url: `/api/attempts/${testAttemptId}/answers`,
        headers: { cookie: userCookie },
        payload: {
          questionId: q!.id,
          selectedChoiceId: 'A',
        },
      });
      expect(patchRes.statusCode).toBe(200);

      // 2. Replay attempt submission
      const res = await app.inject({
        method: 'POST',
        url: `/api/attempts/${testAttemptId}/submit`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.attemptId).toBe(testAttemptId);
      expect(body.data.completedAt).toBeDefined();

      const updatedAttempt = db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.id, testAttemptId))
        .get();
      expect(updatedAttempt?.status).toBe('completed');
    });
  });
});
