import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';

describe('Security Hardening, Anti-Tamper & Authorization Audits', () => {
  let app: FastifyInstance;
  let user1Cookie = '';
  let user2Cookie = '';
  let user1QuizId = '';
  let user1AttemptId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // User 1
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `sec_user1_${Date.now()}@quizforge.com`,
        password: 'Password123!',
        displayName: 'Security User 1',
      },
    });
    const c1 = res1.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    user1Cookie = `${c1?.name}=${c1?.value}`;

    // User 2
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `sec_user2_${Date.now()}@quizforge.com`,
        password: 'Password123!',
        displayName: 'Security User 2',
      },
    });
    const c2 = res2.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    user2Cookie = `${c2?.name}=${c2?.value}`;

    // Create a quiz for User 1
    const quizRes = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: user1Cookie },
      payload: {
        topic: 'Security Auditing',
        questionCount: 2,
        difficulty: 'hard',
      },
    });
    const qBody = JSON.parse(quizRes.payload);
    user1QuizId = qBody.data.quizId;
    user1AttemptId = qBody.data.attemptId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces secure HTTP headers on all API responses (Helmet)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('rejects tampered or forged JWT tokens with 401 Unauthorized', async () => {
    const forgedToken = 'eyAidHlwIjogIkpXVCIgfQ.eyBzdWIiOiAiZmFrZSIgfQ.invalidsignature';
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${forgedToken}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks unauthorized access to another user quiz metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/quizzes/${user1QuizId}`,
      headers: { cookie: user2Cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('blocks unauthorized access to another user quiz attempt results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${user1AttemptId}/results`,
      headers: { cookie: user2Cookie },
    });

    expect(res.statusCode).toBe(404);
  });

  it('rejects querying results on an uncompleted in-progress attempt', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${user1AttemptId}/results`,
      headers: { cookie: user1Cookie },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('ATTEMPT_NOT_COMPLETED');
  });

  it('rejects submitting an attempt that has already been submitted', async () => {
    // 1. Submit attempt
    const submit1 = await app.inject({
      method: 'POST',
      url: `/api/attempts/${user1AttemptId}/submit`,
      headers: { cookie: user1Cookie },
    });
    expect(submit1.statusCode).toBe(200);

    // 2. Submit again
    const submit2 = await app.inject({
      method: 'POST',
      url: `/api/attempts/${user1AttemptId}/submit`,
      headers: { cookie: user1Cookie },
    });
    expect(submit2.statusCode).toBe(400);
    expect(JSON.parse(submit2.payload).error.code).toBe('ATTEMPT_ALREADY_SUBMITTED');
  });

  it('rejects modifying answers on a completed attempt', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${user1AttemptId}/answers`,
      headers: { cookie: user1Cookie },
      payload: {
        questionId: 'any_id',
        selectedChoiceId: 'A',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.payload).error.code).toBe('ATTEMPT_ALREADY_COMPLETED');
  });
});
