import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { db } from '../db/index';
import {
  quizzes,
  questions,
  quizAttempts,
} from '../db/schema/index';
import { eq } from 'drizzle-orm';
import {
  calculateIrtProbability,
  calculateFisherInformation,
  updateAbilityEstimate,
  classifyTheta,
  calculatePercentile,
} from '@quiz-forge/shared';

describe('Milestone 16: Computerized Adaptive Testing (CAT) Engine', () => {
  let app: FastifyInstance;
  let userCookie: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const userEmail = `cat_tester_${Date.now()}@example.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: userEmail,
        password: 'Password123!',
        displayName: 'Adaptive Student',
        role: 'student',
      },
    });

    userCookie = regRes.headers['set-cookie'] as string;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Item Response Theory (IRT) Mathematical Specifications', () => {
    it('calculates logistic probability accurately with symmetry at theta = b', () => {
      // When ability equals difficulty, P is exactly 50%
      expect(calculateIrtProbability(0.0, 0.0)).toBeCloseTo(0.5, 5);
      expect(calculateIrtProbability(1.5, 1.5)).toBeCloseTo(0.5, 5);
      expect(calculateIrtProbability(-2.0, -2.0)).toBeCloseTo(0.5, 5);

      // Higher ability has higher probability
      expect(calculateIrtProbability(1.5, 0.0)).toBeGreaterThan(0.5);
      expect(calculateIrtProbability(-1.5, 0.0)).toBeLessThan(0.5);
    });

    it('maximizes Fisher Information at b == theta', () => {
      const optimalInfo = calculateFisherInformation(1.0, 1.0);
      const subOptimalInfo = calculateFisherInformation(1.0, 2.5);
      expect(optimalInfo).toBeGreaterThan(subOptimalInfo);
      expect(optimalInfo).toBeCloseTo(0.25, 4);
    });

    it('updates ability theta upward on correct answers and downward on incorrect answers', () => {
      const initialTheta = 0.0;
      const initialSE = 1.0;

      // 1. Correct answer on medium question (b=0)
      const afterCorrect = updateAbilityEstimate(initialTheta, initialSE, true, 0.0);
      expect(afterCorrect.newTheta).toBeGreaterThan(initialTheta);
      expect(afterCorrect.newSE).toBeLessThan(initialSE);

      // 2. Incorrect answer on medium question (b=0)
      const afterIncorrect = updateAbilityEstimate(initialTheta, initialSE, false, 0.0);
      expect(afterIncorrect.newTheta).toBeLessThan(initialTheta);
      expect(afterIncorrect.newSE).toBeLessThan(initialSE);
    });

    it('maps latent theta to proficiency classification and normative percentiles', () => {
      expect(classifyTheta(-2.0)).toBe('Novice');
      expect(classifyTheta(-0.5)).toBe('Developing');
      expect(classifyTheta(0.5)).toBe('Proficient');
      expect(classifyTheta(1.5)).toBe('Advanced');
      expect(classifyTheta(2.5)).toBe('Master');

      // Percentiles: theta = 0 should be median ~50th percentile
      expect(calculatePercentile(0.0)).toBe(50);
      expect(calculatePercentile(2.0)).toBeGreaterThan(95);
      expect(calculatePercentile(-2.0)).toBeLessThan(10);
    });
  });

  describe('Adaptive Question Generation & Dynamic Execution Endpoints', () => {
    let adaptiveQuizId: string;
    let adaptiveAttemptId: string;

    it('generates an adaptive quiz with stratified item pool via POST /api/quizzes/generate-adaptive', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/quizzes/generate-adaptive',
        headers: { cookie: userCookie },
        payload: {
          topic: 'System Architecture',
          itemPoolSize: 8,
          maxTestLength: 4,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.quizId).toBeDefined();
      expect(body.data.attemptId).toBeDefined();
      expect(body.data.itemPoolSize).toBeGreaterThanOrEqual(4);
      expect(body.data.maxTestLength).toBe(4);

      adaptiveQuizId = body.data.quizId;
      adaptiveAttemptId = body.data.attemptId;

      // Verify quiz in DB is marked adaptive
      const qz = db.select().from(quizzes).where(eq(quizzes.id, adaptiveQuizId)).get();
      expect(qz?.isAdaptive).toBe(true);

      // Verify attempt is initialized with theta = 0.0
      const att = db.select().from(quizAttempts).where(eq(quizAttempts.id, adaptiveAttemptId)).get();
      expect(att?.isAdaptive).toBe(true);
      expect(att?.currentTheta).toBe(0.0);
      expect(att?.standardError).toBe(1.0);
    });

    it('serves optimal first question matching initial theta=0 via GET /api/attempts/:attemptId/adaptive-next', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/attempts/${adaptiveAttemptId}/adaptive-next`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.step).toBe(1);
      expect(body.data.maxSteps).toBe(4);
      expect(body.data.currentTheta).toBe(0.0);
      expect(body.data.question).toBeDefined();
      expect(body.data.question.choices.length).toBeGreaterThanOrEqual(2);
      expect(body.data.isComplete).toBe(false);
    });

    it('records answer, recalibrates ability theta, and serves adaptive next question', async () => {
      // 1. Get Step 1 Question
      const next1Res = await app.inject({
        method: 'GET',
        url: `/api/attempts/${adaptiveAttemptId}/adaptive-next`,
        headers: { cookie: userCookie },
      });
      const q1 = JSON.parse(next1Res.payload).data.question;

      // Find question's correct answer
      const qRow = db.select().from(questions).where(eq(questions.id, q1.question_id)).get();

      // Submit Correct Answer
      const ans1Res = await app.inject({
        method: 'POST',
        url: `/api/attempts/${adaptiveAttemptId}/adaptive-answer`,
        headers: { cookie: userCookie },
        payload: {
          questionId: q1.question_id,
          selectedChoiceId: qRow!.correctChoiceId,
        },
      });

      expect(ans1Res.statusCode).toBe(200);
      const ans1Body = JSON.parse(ans1Res.payload);
      expect(ans1Body.success).toBe(true);
      expect(ans1Body.data.isCorrect).toBe(true);
      expect(ans1Body.data.newTheta).toBeGreaterThan(0.0); // Escalated ability
      expect(ans1Body.data.step).toBe(1);
      expect(ans1Body.data.isComplete).toBe(false);

      // 2. Fetch Step 2 Question (should target higher theta)
      const next2Res = await app.inject({
        method: 'GET',
        url: `/api/attempts/${adaptiveAttemptId}/adaptive-next`,
        headers: { cookie: userCookie },
      });
      const next2Body = JSON.parse(next2Res.payload);
      expect(next2Body.data.step).toBe(2);
      expect(next2Body.data.currentTheta).toBeGreaterThan(0.0);

      const q2 = next2Body.data.question;
      expect(q2.question_id).not.toBe(q1.question_id); // Does not repeat

      // Submit Answer for Step 2
      const ans2Res = await app.inject({
        method: 'POST',
        url: `/api/attempts/${adaptiveAttemptId}/adaptive-answer`,
        headers: { cookie: userCookie },
        payload: {
          questionId: q2.question_id,
          selectedChoiceId: 'A',
        },
      });
      expect(ans2Res.statusCode).toBe(200);
    });

    it('generates full adaptive trajectory report via GET /api/attempts/:attemptId/adaptive-trajectory', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/attempts/${adaptiveAttemptId}/adaptive-trajectory`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.isAdaptive).toBe(true);
      expect(body.data.finalTheta).toBeDefined();
      expect(body.data.standardError).toBeDefined();
      expect(body.data.percentile).toBeGreaterThanOrEqual(1);
      expect(body.data.abilityTier).toBeDefined();
      expect(body.data.totalSteps).toBe(2);
      expect(body.data.trajectory.length).toBe(2);

      const p1 = body.data.trajectory[0];
      expect(p1.step).toBe(1);
      expect(p1.theta).toBeDefined();
      expect(p1.isCorrect).toBe(true);
    });
  });
});
