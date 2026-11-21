import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';

describe('Image-to-Quiz Ingestion & Vision Processing (Milestone 5)', () => {
  let app: FastifyInstance;
  let userACookie = '';
  let userBCookie = '';
  let generatedJobId = '';
  let generatedQuizId = '';
  let generatedAttemptId = '';

  // Minimal valid 1x1 PNG image buffer
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  // Minimal valid 1x1 JPEG image buffer
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9,
  ]);

  beforeAll(async () => {
    app = await buildApp();
    await app.listen({ port: 0 });

    const runId = Date.now();

    // User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `image_prof_${runId}@artdesign.edu`,
        password: 'Password123!',
        displayName: 'Professor Vision',
      },
    });
    const cookieA = resA.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userACookie = `${cookieA?.name}=${cookieA?.value}`;

    // User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `image_student_${runId}@artdesign.edu`,
        password: 'Password123!',
        displayName: 'Student Vision',
      },
    });
    const cookieB = resB.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userBCookie = `${cookieB?.name}=${cookieB?.value}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests to POST /api/quizzes/generate/image with 401', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/image')
      .attach('file', validPngBuffer, 'diagram.png');

    expect(res.status).toBe(401);
  });

  it('rejects uploads with invalid magic bytes (fake image) with 400 FILE_SIGNATURE_MISMATCH', async () => {
    const fakeBuffer = Buffer.from('This is a text file pretending to be an image.');

    const res = await request(app.server)
      .post('/api/quizzes/generate/image')
      .set('Cookie', userACookie)
      .attach('file', fakeBuffer, 'fake.png');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FILE_SIGNATURE_MISMATCH');
  });

  it('rejects empty file uploads with 400 EMPTY_FILE', async () => {
    const emptyBuffer = Buffer.alloc(0);

    const res = await request(app.server)
      .post('/api/quizzes/generate/image')
      .set('Cookie', userACookie)
      .attach('file', emptyBuffer, 'empty.png');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EMPTY_FILE');
  });

  it('accepts a valid PNG image and initiates async generation job with 202 Accepted', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/image')
      .set('Cookie', userACookie)
      .attach('file', validPngBuffer, 'architecture_diagram.png')
      .field('topic', 'Software Architecture Diagram')
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

  it('allows creator to fetch active attempt for generated image quiz and submit answers', async () => {
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

    // 2. Submit attempt
    const submitAttemptRes = await request(app.server)
      .post(`/api/attempts/${generatedAttemptId}/submit`)
      .set('Cookie', userACookie);

    expect(submitAttemptRes.status).toBe(200);
    expect(submitAttemptRes.body.data.attemptId).toBe(generatedAttemptId);
    expect(submitAttemptRes.body.data.score).toBeDefined();
    expect(submitAttemptRes.body.data.review.length).toBeGreaterThan(0);
  });

  it('accepts a valid JPEG image and initiates generation job with 202 Accepted', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/image')
      .set('Cookie', userACookie)
      .attach('file', validJpegBuffer, 'circuit_board.jpeg')
      .field('topic', 'Electronics Circuit')
      .field('difficulty', 'hard')
      .field('questionCount', '3');

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
  });
});
