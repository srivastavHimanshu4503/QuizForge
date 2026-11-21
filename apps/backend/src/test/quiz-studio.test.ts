import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import request from 'supertest';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';

describe('Quiz Review Studio, Publishing Engine & Public Sharing (Milestone 6)', () => {
  let app: FastifyInstance;
  let creatorCookie = '';
  let studentCookie = '';
  let quizId = '';
  let shareCode = '';
  let firstQuestionId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.listen({ port: 0 });

    const runId = Date.now();

    // 1. Register Creator
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `studio_creator_${runId}@university.edu`,
        password: 'Password123!',
        displayName: 'Professor Author',
      },
    });
    const cookieA = resA.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    creatorCookie = `${cookieA?.name}=${cookieA?.value}`;

    // 2. Register Student
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `studio_student_${runId}@university.edu`,
        password: 'Password123!',
        displayName: 'Student Learner',
      },
    });
    const cookieB = resB.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    studentCookie = `${cookieB?.name}=${cookieB?.value}`;

    // 3. Creator generates initial quiz
    const quizRes = await request(app.server)
      .post('/api/quizzes/generate')
      .set('Cookie', creatorCookie)
      .send({
        topic: 'System Architecture Fundamentals',
        difficulty: 'medium',
        questionCount: 3,
      });

    expect(quizRes.status).toBe(201);
    quizId = quizRes.body.data.quizId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests to Studio endpoints with 401', async () => {
    const res = await request(app.server).get(`/api/quizzes/${quizId}/studio`);
    expect(res.status).toBe(401);
  });

  it('allows creator to fetch full Studio editor payload with answers and explanations', async () => {
    const res = await request(app.server)
      .get(`/api/quizzes/${quizId}/studio`)
      .set('Cookie', creatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.id).toBe(quizId);
    expect(data.topic).toBe('System Architecture Fundamentals');
    expect(data.status).toBeDefined();
    expect(data.questions.length).toBe(3);

    const firstQ = data.questions[0];
    expect(firstQ.id).toBeDefined();
    expect(firstQ.questionText).toBeTruthy();
    expect(firstQ.correctChoiceId).toMatch(/^[ABCD]$/);
    expect(firstQ.explanation).toBeTruthy();
    expect(firstQ.choices.length).toBe(4);

    firstQuestionId = firstQ.id;
  });

  it('rejects non-creator access to Review Studio with 403 Forbidden', async () => {
    const res = await request(app.server)
      .get(`/api/quizzes/${quizId}/studio`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects invalid studio modifications (duplicate choice texts) with 400 VALIDATION_ERROR', async () => {
    const invalidPayload = {
      topic: 'Invalid Quiz',
      questions: [
        {
          id: firstQuestionId,
          questionText: 'What is high availability in distributed systems?',
          choices: [
            { choice_id: 'A', option_text: 'Duplicate option' },
            { choice_id: 'B', option_text: 'Duplicate option' },
            { choice_id: 'C', option_text: 'Option C' },
            { choice_id: 'D', option_text: 'Option D' },
          ],
          correctChoiceId: 'A',
          explanation: 'Valid explanation text.',
        },
      ],
    };

    const res = await request(app.server)
      .put(`/api/quizzes/${quizId}/studio`)
      .set('Cookie', creatorCookie)
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('allows creator to edit questions, choices, explanations, and add custom questions', async () => {
    const updatedPayload = {
      topic: 'Refined System Architecture Masterclass',
      difficulty: 'hard',
      isPublic: true,
      questions: [
        {
          id: firstQuestionId,
          questionText: 'Edited Question: How does horizontal scaling differ from vertical scaling?',
          choices: [
            { choice_id: 'A', option_text: 'Adding more nodes vs adding CPU/RAM to a single node' },
            { choice_id: 'B', option_text: 'Adding CPU/RAM to a single node vs adding more nodes' },
            { choice_id: 'C', option_text: 'Increasing disk storage capacity only' },
            { choice_id: 'D', option_text: 'Switching database engines completely' },
          ],
          correctChoiceId: 'A',
          explanation: 'Horizontal scaling adds more instances/machines, while vertical scaling upgrades the existing machine resources.',
        },
        {
          questionText: 'Custom Manual Question: Which algorithm is commonly used for leader election in distributed consensus?',
          choices: [
            { choice_id: 'A', option_text: 'Raft consensus algorithm' },
            { choice_id: 'B', option_text: 'Dijkstra shortest path' },
            { choice_id: 'C', option_text: 'Bubble sort' },
            { choice_id: 'D', option_text: 'Binary search tree rebalancing' },
          ],
          correctChoiceId: 'A',
          explanation: 'Raft is an authoritative consensus algorithm that explicitly elects a leader to manage log replication.',
        },
      ],
    };

    const res = await request(app.server)
      .put(`/api/quizzes/${quizId}/studio`)
      .set('Cookie', creatorCookie)
      .send(updatedPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = res.body.data;
    expect(updated.topic).toBe('Refined System Architecture Masterclass');
    expect(updated.difficulty).toBe('hard');
    expect(updated.questionCount).toBe(2);
    expect(updated.questions.length).toBe(2);
    expect(updated.questions[0].questionText).toContain('Edited Question');
    expect(updated.questions[1].questionText).toContain('Custom Manual Question');
  });

  it('publishes quiz and generates shareCode for public distribution', async () => {
    const res = await request(app.server)
      .post(`/api/quizzes/${quizId}/publish`)
      .set('Cookie', creatorCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.shareCode).toHaveLength(8);

    shareCode = res.body.data.shareCode;
  });

  it('allows public student to view shared quiz with answers stripped for security', async () => {
    const res = await request(app.server)
      .get(`/api/quizzes/share/${shareCode}`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { quiz, questions } = res.body.data;
    expect(quiz.topic).toBe('Refined System Architecture Masterclass');
    expect(questions.length).toBe(2);

    // SECURITY: Ensure correct answer and explanation are NOT leaked in client payload!
    for (const q of questions) {
      expect((q as any).correctChoiceId).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
      expect(q.choices.length).toBe(4);
    }
  });

  it('allows public student to start attempt on shared quiz and submit responses', async () => {
    // 1. Start attempt via share code
    const startRes = await request(app.server)
      .post(`/api/quizzes/share/${shareCode}/start`)
      .set('Cookie', studentCookie);

    expect(startRes.status).toBe(201);
    expect(startRes.body.success).toBe(true);

    const attemptId = startRes.body.data.attemptId;
    expect(attemptId).toBeDefined();

    // 2. Fetch active attempt
    const attemptRes = await request(app.server)
      .get(`/api/attempts/${attemptId}`)
      .set('Cookie', studentCookie);

    expect(attemptRes.status).toBe(200);
    expect(attemptRes.body.data.questions.length).toBe(2);

    const questions = attemptRes.body.data.questions;
    for (const q of questions) {
      const ansRes = await request(app.server)
        .patch(`/api/attempts/${attemptId}/answers`)
        .set('Cookie', studentCookie)
        .send({
          questionId: q.question_id,
          selectedChoiceId: 'A',
        });
      expect(ansRes.status).toBe(200);
    }

    // 3. Submit attempt
    const submitRes = await request(app.server)
      .post(`/api/attempts/${attemptId}/submit`)
      .set('Cookie', studentCookie);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.score).toBe(2); // Both answers 'A' are correct in our edit!
    expect(submitRes.body.data.accuracyPercentage).toBe(100);
  });

  it('unpublishing sets status to draft and blocks public access to shareCode', async () => {
    // 1. Unpublish
    const unpubRes = await request(app.server)
      .post(`/api/quizzes/${quizId}/unpublish`)
      .set('Cookie', creatorCookie);

    expect(unpubRes.status).toBe(200);
    expect(unpubRes.body.data.status).toBe('draft');

    // 2. Public lookup now fails with 404
    const res = await request(app.server)
      .get(`/api/quizzes/share/${shareCode}`)
      .set('Cookie', studentCookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('QUIZ_NOT_FOUND');
  });
});
