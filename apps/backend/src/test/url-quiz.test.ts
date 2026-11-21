import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import dns from 'node:dns/promises';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';
import { urlIngestionAdapter } from '../services/ingestion/url.adapter';

describe('URL-to-Quiz Ingestion & SSRF Defense (Milestone 4)', () => {
  let app: FastifyInstance;
  let userACookie = '';
  let userBCookie = '';
  let generatedJobId = '';
  let generatedQuizId = '';
  let generatedAttemptId = '';

  const mockArticleHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Understanding Modern Microservices Architecture Patterns</title>
      <meta property="og:title" content="Understanding Modern Microservices Architecture Patterns">
    </head>
    <body>
      <header><nav><a href="/">Home</a></nav></header>
      <article>
        <h1>Understanding Modern Microservices Architecture Patterns</h1>
        <p>Microservices architecture structures an application as a collection of loosely coupled, independently deployable services.</p>
        <h2>Service Communication Patterns</h2>
        <p>In distributed environments, services can interact via synchronous protocols like HTTP REST and gRPC, or asynchronous event-driven messaging like RabbitMQ and Apache Kafka.</p>
        <h2>Database-per-Service Pattern</h2>
        <p>To ensure high autonomy and loose coupling, each microservice must encapsulate its own private persistent data store. Other services access data only through published APIs, never through direct database sharing.</p>
        <h2>Saga Pattern for Distributed Transactions</h2>
        <p>When operations span multiple services, traditional ACID two-phase commit is impractical. Instead, the Saga pattern coordinates a sequence of local transactions where each step publishes events and compensation transactions recover from failures.</p>
      </article>
      <footer><p>&copy; 2026 Tech Journal</p></footer>
    </body>
    </html>
  `;

  beforeAll(async () => {
    app = await buildApp();
    await app.listen({ port: 0 });

    const runId = Date.now();

    // User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `url_prof_${runId}@engineering.edu`,
        password: 'Password123!',
        displayName: 'Professor URL',
      },
    });
    const cookieA = resA.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userACookie = `${cookieA?.name}=${cookieA?.value}`;

    // User B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `url_student_${runId}@engineering.edu`,
        password: 'Password123!',
        displayName: 'Student URL',
      },
    });
    const cookieB = resB.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userBCookie = `${cookieB?.name}=${cookieB?.value}`;
  });

  afterAll(async () => {
    urlIngestionAdapter.setFetchFn(null);
    vi.restoreAllMocks();
    await app.close();
  });

  it('rejects unauthenticated requests to POST /api/quizzes/generate/url with 401', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .send({ url: 'https://example.com/article' });

    expect(res.status).toBe(401);
  });

  it('rejects invalid or malformed URL strings with 400 VALIDATION_ERROR', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'not-a-valid-url' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects disallowed protocols (e.g. ftp://) with 400 DISALLOWED_PROTOCOL', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'ftp://ftp.example.com/notes.txt' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DISALLOWED_PROTOCOL');
  });

  it('rejects URLs containing embedded user credentials with 400 CREDENTIALS_IN_URL', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'https://admin:secret@example.com/article' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CREDENTIALS_IN_URL');
  });

  it('SSRF Defense: blocks requests to localhost with 400 SSRF_BLOCKED', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'http://localhost:4000/api/health' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_BLOCKED');
  });

  it('SSRF Defense: blocks requests to IPv4 loopback (127.0.0.1) with 400 SSRF_BLOCKED', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'http://127.0.0.1:4000/internal-admin' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_BLOCKED');
  });

  it('SSRF Defense: blocks cloud metadata endpoint (169.254.169.254) with 400 SSRF_BLOCKED', async () => {
    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_BLOCKED');
  });

  it('SSRF Defense: blocks private Class A, B, and C subnets with 400 SSRF_BLOCKED', async () => {
    const privateIps = ['http://10.0.0.1/secret', 'http://172.16.0.5/admin', 'http://192.168.1.1/router'];

    for (const url of privateIps) {
      const res = await request(app.server)
        .post('/api/quizzes/generate/url')
        .set('Cookie', userACookie)
        .send({ url });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SSRF_BLOCKED');
    }
  });

  it('SSRF Defense: blocks hostnames that resolve via DNS to private loopback IPs (DNS Rebinding)', async () => {
    // Mock DNS lookup to return 127.0.0.1 for a fake public hostname
    vi.spyOn(dns, 'lookup').mockImplementation(async (host: string) => {
      if (host === 'evil-rebind.com') {
        return [{ address: '127.0.0.1', family: 4 }] as any;
      }
      return [{ address: '93.184.216.34', family: 4 }] as any;
    });

    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({ url: 'https://evil-rebind.com/exploit' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SSRF_BLOCKED');
  });

  it('accepts a valid public URL and initiates async quiz generation with 202 Accepted', async () => {
    // Setup safe public DNS mock and mock fetch
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as any);

    urlIngestionAdapter.setFetchFn(async () => {
      return new Response(mockArticleHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    });

    const res = await request(app.server)
      .post('/api/quizzes/generate/url')
      .set('Cookie', userACookie)
      .send({
        url: 'https://techjournal.example.com/microservices-architecture-guide',
        topic: 'Microservices Architecture',
        difficulty: 'medium',
        questionCount: 3,
      });

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

  it('allows creator to fetch active attempt for generated URL quiz and submit answers', async () => {
    // 1. Fetch active attempt
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
});
