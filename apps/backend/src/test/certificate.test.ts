import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

describe('Milestone 10: PDF Certificate & Student Performance Report Cards', () => {
  let app: FastifyInstance;
  const runId = Date.now();
  const studentEmail = `cert.student.${runId}@test.com`;
  const otherUserEmail = `other.user.${runId}@test.com`;

  let studentCookie: string;
  let otherUserCookie: string;
  let passedAttemptId: string;
  let failedAttemptId: string;
  let quizId: string;
  let verificationCode: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Register student
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: studentEmail,
        password: 'Password123!',
        displayName: 'Grace Hopper',
      },
    });
    expect(regRes.statusCode).toBe(201);
    const cookieHeader = regRes.headers['set-cookie'];
    studentCookie = Array.isArray(cookieHeader) ? cookieHeader[0]! : (cookieHeader as string);

    // 2. Register other user
    const otherRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: otherUserEmail,
        password: 'Password123!',
        displayName: 'Intruder User',
      },
    });
    expect(otherRes.statusCode).toBe(201);
    const otherCookieHeader = otherRes.headers['set-cookie'];
    otherUserCookie = Array.isArray(otherCookieHeader) ? otherCookieHeader[0]! : (otherCookieHeader as string);

    // 3. Generate a master quiz via /api/quizzes/generate
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: studentCookie },
      payload: {
        topic: 'Compiler Design & AST Optimization',
        questionCount: 2,
        difficulty: 'medium',
      },
    });
    expect(genRes.statusCode).toBe(201);
    const genBody = JSON.parse(genRes.payload);
    quizId = genBody.data.quizId;
    failedAttemptId = genBody.data.attemptId;

    // Fetch questions for failed attempt and submit with 0 answers (0%)
    const failSubmit = await app.inject({
      method: 'POST',
      url: `/api/attempts/${failedAttemptId}/submit`,
      headers: { cookie: studentCookie },
    });
    expect(failSubmit.statusCode).toBe(200);
    const failBody = JSON.parse(failSubmit.payload);
    expect(failBody.data.accuracyPercentage).toBe(0);

    // Collect correct answers from review
    const correctMap = new Map<string, string>();
    for (const r of failBody.data.review) {
      correctMap.set(r.question_id, r.correct_choice_id);
    }

    // 4. Restart quiz to get Attempt #2 and score 100%
    const restartRes = await app.inject({
      method: 'POST',
      url: `/api/quizzes/${quizId}/restart`,
      headers: { cookie: studentCookie },
    });
    expect(restartRes.statusCode).toBe(201);
    const restartBody = JSON.parse(restartRes.payload);
    passedAttemptId = restartBody.data.attemptId;

    // Fetch attempt 2 questions
    const passAttRes = await app.inject({
      method: 'GET',
      url: `/api/attempts/${passedAttemptId}`,
      headers: { cookie: studentCookie },
    });
    const passAttBody = JSON.parse(passAttRes.payload);
    for (const q of passAttBody.data.questions) {
      const correctChoice = correctMap.get(q.question_id);
      if (correctChoice) {
        await app.inject({
          method: 'PATCH',
          url: `/api/attempts/${passedAttemptId}/answers`,
          headers: { cookie: studentCookie },
          payload: { questionId: q.question_id, selectedChoiceId: correctChoice },
        });
      }
    }

    // Submit passing attempt (100%)
    const passSubmit = await app.inject({
      method: 'POST',
      url: `/api/attempts/${passedAttemptId}/submit`,
      headers: { cookie: studentCookie },
    });
    expect(passSubmit.statusCode).toBe(200);
    const passBody = JSON.parse(passSubmit.payload);
    expect(passBody.data.accuracyPercentage).toBe(100);
  });

  afterAll(async () => {
    await app.close();
  });

  it('checks certificate metadata for passed attempt (eligible: true)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${passedAttemptId}/meta`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.isEligible).toBe(true);
    expect(body.data.minPassingPercentage).toBe(70);
    expect(body.data.percentage).toBe(100);
  });

  it('checks certificate metadata for failed attempt (eligible: false)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${failedAttemptId}/meta`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.isEligible).toBe(false);
    expect(body.data.percentage).toBe(0);
  });

  it('rejects certificate PDF generation for failed attempt (400 PASSING_GRADE_NOT_MET)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${failedAttemptId}/pdf`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PASSING_GRADE_NOT_MET');
  });

  it('generates and downloads pristine Certificate PDF for passed attempt', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${passedAttemptId}/pdf`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename=');

    // Verify it is a valid PDF buffer
    const buffer = Buffer.from(res.rawPayload);
    expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('retrieves certificate metadata showing newly issued certificate record', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${passedAttemptId}/meta`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.hasCertificate).toBe(true);
    expect(body.data.certificate).toBeDefined();
    expect(body.data.certificate.recipientName).toBe('Grace Hopper');
    expect(body.data.certificate.percentage).toBe(100);
    expect(body.data.certificate.verificationCode).toMatch(/^QF-\d{4}-[A-Z0-9]+$/);

    verificationCode = body.data.certificate.verificationCode;
  });

  it('publicly verifies certificate authenticity using verification code (no auth required)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/verify/${verificationCode}`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.isValid).toBe(true);
    expect(body.data.verificationCode).toBe(verificationCode);
    expect(body.data.recipientName).toBe('Grace Hopper');
    expect(body.data.quizTitle).toBe('Compiler Design & AST Optimization');
    expect(body.data.percentage).toBe(100);
    expect(body.data.isDistinction).toBe(true);
    expect(body.data.grade).toContain('High Distinction');
  });

  it('rejects public verification for invalid or fake certificate code (404)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/certificates/verify/FAKE-CODE-999',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CERTIFICATE_NOT_FOUND');
  });

  it('generates and downloads Student Performance Report Card PDF', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${passedAttemptId}/report-card`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment; filename=');

    const buffer = Buffer.from(res.rawPayload);
    expect(buffer.slice(0, 5).toString('ascii')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1500);
  });

  it('blocks unauthorized users from downloading another candidate report card (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/certificates/${passedAttemptId}/report-card`,
      headers: { cookie: otherUserCookie },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
