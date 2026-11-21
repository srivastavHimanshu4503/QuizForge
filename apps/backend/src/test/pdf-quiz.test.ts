import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';

describe('PDF-to-Quiz Ingestion & Asynchronous Job Lifecycle (Milestone 3)', () => {
  let app: FastifyInstance;
  let userACookie = '';
  let userBCookie = '';
  let generatedJobId = '';
  let generatedQuizId = '';
  let generatedAttemptId = '';

  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n' +
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n' +
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n' +
    '4 0 obj << /Length 85 >> stream\n' +
    'BT /F1 12 Tf 50 700 Td (Software Engineering and Distributed Systems Architecture Design Principles in Practice) Tj ET\n' +
    'endstream endobj\n' +
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n' +
    'xref\n' +
    '0 6\n' +
    '0000000000 65535 f \n' +
    '0000000010 00000 n \n' +
    '0000000059 00000 n \n' +
    '0000000116 00000 n \n' +
    '0000000251 00000 n \n' +
    '0000000385 00000 n \n' +
    'trailer << /Size 6 /Root 1 0 R >>\n' +
    'startxref\n' +
    '463\n' +
    '%%EOF\n'
  );

  beforeAll(async () => {
    app = await buildApp();
    await app.listen({ port: 0 });

    const runId = Date.now();

    // User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `pdf_user_a_${runId}@university.edu`,
        password: 'Password123!',
        displayName: 'Professor Alpha',
      },
    });
    const cookieA = resA.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userACookie = `${cookieA?.name}=${cookieA?.value}`;

    // User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `pdf_user_b_${runId}@university.edu`,
        password: 'Password123!',
        displayName: 'Student Beta',
      },
    });
    const cookieB = resB.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userBCookie = `${cookieB?.name}=${cookieB?.value}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests to POST /api/quizzes/generate/pdf with 401', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/pdf')
      .attach('file', validPdfBuffer, 'test.pdf');

    expect(res.status).toBe(401);
  });

  it('rejects uploads with invalid magic bytes (fake PDF) with 400 FILE_SIGNATURE_MISMATCH', async () => {
    const fakePdfBuffer = Buffer.from('This is a plain text file pretending to be a PDF.');

    const res = await request(app.server)
      .post('/api/quizzes/generate/pdf')
      .set('Cookie', userACookie)
      .attach('file', fakePdfBuffer, 'fake.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FILE_SIGNATURE_MISMATCH');
  });

  it('rejects empty file uploads with 400 EMPTY_FILE', async () => {
    const emptyBuffer = Buffer.alloc(0);

    const res = await request(app.server)
      .post('/api/quizzes/generate/pdf')
      .set('Cookie', userACookie)
      .attach('file', emptyBuffer, 'empty.pdf');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMPTY_FILE');
  });

  it('accepts a valid PDF and initiates an asynchronous generation job with 202 Accepted', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/pdf')
      .set('Cookie', userACookie)
      .attach('file', validPdfBuffer, 'distributed_systems.pdf')
      .field('topic', 'Distributed Systems Core')
      .field('difficulty', 'medium')
      .field('questionCount', '3');

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
    expect(res.body.data.status).toBe('queued');

    generatedJobId = res.body.data.jobId;
  });

  it('polls job progress until completion and retrieves quizId and attemptId', async () => {
    expect(generatedJobId).toBeTruthy();

    // Poll up to 10 times with 200ms sleep
    let completed = false;
    let pollCount = 0;

    while (!completed && pollCount < 15) {
      pollCount++;
      const res = await request(app.server)
        .get(`/api/jobs/${generatedJobId}`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const job = res.body.data;
      expect(job.jobId).toBe(generatedJobId);
      expect(job.progress).toBeGreaterThanOrEqual(0);

      if (job.status === 'completed') {
        completed = true;
        expect(job.stage).toBe('completed');
        expect(job.progress).toBe(100);
        expect(job.quizId).toBeDefined();
        expect(job.attemptId).toBeDefined();
        generatedQuizId = job.quizId;
        generatedAttemptId = job.attemptId;
      } else if (job.status === 'failed') {
        throw new Error(`Job unexpectedly failed: ${job.error}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    expect(completed).toBe(true);
    expect(generatedQuizId).toBeTruthy();
    expect(generatedAttemptId).toBeTruthy();
  });

  it('enforces multi-tenant job isolation (User B cannot poll User A job)', async () => {
    const res = await request(app.server)
      .get(`/api/jobs/${generatedJobId}`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('JOB_NOT_FOUND');
  });

  it('allows creator to fetch active attempt for generated PDF quiz and complete it', async () => {
    // 1. Fetch attempt
    const attemptRes = await request(app.server)
      .get(`/api/attempts/${generatedAttemptId}`)
      .set('Cookie', userACookie);

    expect(attemptRes.status).toBe(200);
    expect(attemptRes.body.success).toBe(true);
    expect(attemptRes.body.data.attemptId).toBe(generatedAttemptId);
    expect(attemptRes.body.data.questions.length).toBeGreaterThan(0);

    const questions = attemptRes.body.data.questions;
    for (const q of questions) {
      const submitRes = await request(app.server)
        .patch(`/api/attempts/${generatedAttemptId}/answers`)
        .set('Cookie', userACookie)
        .send({
          questionId: q.question_id,
          selectedChoiceId: 'A',
        });
      expect(submitRes.status).toBe(200);
    }

    // 2. Complete/Submit attempt
    const submitAttemptRes = await request(app.server)
      .post(`/api/attempts/${generatedAttemptId}/submit`)
      .set('Cookie', userACookie);

    expect(submitAttemptRes.status).toBe(200);
    expect(submitAttemptRes.body.data.attemptId).toBe(generatedAttemptId);
    expect(submitAttemptRes.body.data.score).toBeDefined();
    expect(submitAttemptRes.body.data.review.length).toBeGreaterThan(0);
  });
});
