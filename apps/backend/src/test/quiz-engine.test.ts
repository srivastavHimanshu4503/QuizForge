import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';

describe('Quiz Engine, Lifecycle, Scoring & Multi-Tenancy', () => {
  let app: FastifyInstance;

  let userACookie = '';
  let userBCookie = '';

  let userAQuizId = '';
  let userAAttempt1Id = '';
  let userAAttempt2Id = '';
  let firstQuestionId = '';
  let secondQuestionId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Create User A
    const resA = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `usera_${Date.now()}@quizforge.com`,
        password: 'Password123!',
        displayName: 'User Alpha',
      },
    });
    const cookieA = resA.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userACookie = `${cookieA?.name}=${cookieA?.value}`;

    // 2. Create User B (for multi-tenant isolation tests)
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: `userb_${Date.now()}@quizforge.com`,
        password: 'Password123!',
        displayName: 'User Beta',
      },
    });
    const cookieB = resB.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    userBCookie = `${cookieB?.name}=${cookieB?.value}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a quiz, persists questions/choices, and creates Attempt #1', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: userACookie },
      payload: {
        topic: 'Rust Memory Safety',
        questionCount: 3,
        difficulty: 'hard',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.quizId).toBeDefined();
    expect(body.data.attemptId).toBeDefined();
    expect(body.data.totalQuestions).toBe(3);
    expect(body.data.status).toBe('in_progress');

    userAQuizId = body.data.quizId;
    userAAttempt1Id = body.data.attemptId;
  });

  it('delivers sanitized questions in active attempt with correct answers stripped', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${userAAttempt1Id}`,
      headers: { cookie: userACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.attemptId).toBe(userAAttempt1Id);
    expect(body.data.topic).toBe('Rust Memory Safety');
    expect(body.data.difficulty).toBe('hard');
    expect(body.data.status).toBe('in_progress');
    expect(body.data.questions).toHaveLength(3);

    const questions = body.data.questions;
    firstQuestionId = questions[0].question_id;
    secondQuestionId = questions[1].question_id;

    for (const q of questions) {
      expect(q.question_id).toBeDefined();
      expect(q.question).toBeDefined();
      expect(q.choices).toHaveLength(4);

      // SECURITY AUDIT: Verify correct answers and explanations are NEVER exposed
      expect(q.correct_answer_id).toBeUndefined();
      expect(q.correct_choice_id).toBeUndefined();
      expect(q.correctChoiceId).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    }

    expect(body.data.savedAnswers).toEqual({});
  });

  it('autosaves and updates answers in real-time', async () => {
    // 1. Autosave option 'B' for first question
    const saveRes1 = await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${userAAttempt1Id}/answers`,
      headers: { cookie: userACookie },
      payload: {
        questionId: firstQuestionId,
        selectedChoiceId: 'B',
      },
    });

    expect(saveRes1.statusCode).toBe(200);
    expect(JSON.parse(saveRes1.payload).data.selectedChoiceId).toBe('B');

    // 2. Fetch attempt and verify saved answer persists
    const getRes1 = await app.inject({
      method: 'GET',
      url: `/api/attempts/${userAAttempt1Id}`,
      headers: { cookie: userACookie },
    });
    expect(JSON.parse(getRes1.payload).data.savedAnswers[firstQuestionId]).toBe('B');

    // 3. Update choice to 'C'
    const saveRes2 = await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${userAAttempt1Id}/answers`,
      headers: { cookie: userACookie },
      payload: {
        questionId: firstQuestionId,
        selectedChoiceId: 'C',
      },
    });
    expect(saveRes2.statusCode).toBe(200);

    // 4. Answer second question with 'A'
    await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${userAAttempt1Id}/answers`,
      headers: { cookie: userACookie },
      payload: {
        questionId: secondQuestionId,
        selectedChoiceId: 'A',
      },
    });

    // Verify both answers are persisted
    const getRes2 = await app.inject({
      method: 'GET',
      url: `/api/attempts/${userAAttempt1Id}`,
      headers: { cookie: userACookie },
    });
    const saved = JSON.parse(getRes2.payload).data.savedAnswers;
    expect(saved[firstQuestionId]).toBe('C');
    expect(saved[secondQuestionId]).toBe('A');
  });

  it('submits attempt, executes server-side scoring, and reveals complete review', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/attempts/${userAAttempt1Id}/submit`,
      headers: { cookie: userACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const result = body.data;
    expect(result.attemptId).toBe(userAAttempt1Id);
    expect(result.totalQuestions).toBe(3);
    expect(typeof result.score).toBe('number');
    expect(typeof result.correctCount).toBe('number');
    expect(typeof result.incorrectCount).toBe('number');
    // We answered 2 out of 3 questions
    expect(result.unansweredCount).toBe(1);
    expect(result.correctCount + result.incorrectCount + result.unansweredCount).toBe(3);
    expect(result.score).toBe(result.correctCount);
    expect(typeof result.accuracyPercentage).toBe('number');

    // Verify review exposes answers & explanations post-submission
    expect(result.review).toHaveLength(3);
    for (const item of result.review) {
      expect(item.question_id).toBeDefined();
      expect(['A', 'B', 'C', 'D']).toContain(item.correct_choice_id);
      expect(typeof item.is_correct).toBe('boolean');
      expect(item.explanation.length).toBeGreaterThan(5);
    }

    // Verify re-submitting returns 400
    const resReSubmit = await app.inject({
      method: 'POST',
      url: `/api/attempts/${userAAttempt1Id}/submit`,
      headers: { cookie: userACookie },
    });
    expect(resReSubmit.statusCode).toBe(400);

    // Verify modifying answers after submission returns 400
    const resLateAnswer = await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${userAAttempt1Id}/answers`,
      headers: { cookie: userACookie },
      payload: {
        questionId: firstQuestionId,
        selectedChoiceId: 'D',
      },
    });
    expect(resLateAnswer.statusCode).toBe(400);
  });

  it('retrieves completed attempt results via GET /api/attempts/:id/results', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${userAAttempt1Id}/results`,
      headers: { cookie: userACookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.attemptId).toBe(userAAttempt1Id);
    expect(body.data.review).toHaveLength(3);
  });

  it('restarts a quiz with existing questions in shuffled order (zero AI calls)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/quizzes/${userAQuizId}/restart`,
      headers: { cookie: userACookie },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.quizId).toBe(userAQuizId);
    expect(body.data.attemptId).toBeDefined();
    expect(body.data.attemptId).not.toBe(userAAttempt1Id);
    expect(body.data.attemptNumber).toBe(2);
    expect(body.data.totalQuestions).toBe(3);

    userAAttempt2Id = body.data.attemptId;

    // Verify fresh attempt has clean state
    const attempt2Res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${userAAttempt2Id}`,
      headers: { cookie: userACookie },
    });

    const attempt2Body = JSON.parse(attempt2Res.payload);
    expect(attempt2Body.data.status).toBe('in_progress');
    expect(attempt2Body.data.attemptNumber).toBe(2);
    // Answers must be reset
    expect(attempt2Body.data.savedAnswers).toEqual({});
    expect(attempt2Body.data.questions).toHaveLength(3);
  });

  it('prevents cross-user access (multi-tenant authorization enforcement)', async () => {
    // 1. User B tries to view User A's quiz
    const getQuizRes = await app.inject({
      method: 'GET',
      url: `/api/quizzes/${userAQuizId}`,
      headers: { cookie: userBCookie },
    });
    expect(getQuizRes.statusCode).toBe(404);

    // 2. User B tries to restart User A's quiz
    const restartRes = await app.inject({
      method: 'POST',
      url: `/api/quizzes/${userAQuizId}/restart`,
      headers: { cookie: userBCookie },
    });
    expect(restartRes.statusCode).toBe(404);

    // 3. User B tries to view User A's active attempt
    const getAttemptRes = await app.inject({
      method: 'GET',
      url: `/api/attempts/${userAAttempt2Id}`,
      headers: { cookie: userBCookie },
    });
    expect(getAttemptRes.statusCode).toBe(404);

    // 4. User B tries to answer User A's attempt
    const answerRes = await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${userAAttempt2Id}/answers`,
      headers: { cookie: userBCookie },
      payload: {
        questionId: firstQuestionId,
        selectedChoiceId: 'A',
      },
    });
    expect(answerRes.statusCode).toBe(404);

    // 5. User B tries to submit User A's attempt
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/attempts/${userAAttempt2Id}/submit`,
      headers: { cookie: userBCookie },
    });
    expect(submitRes.statusCode).toBe(404);
  });

  it('retrieves user quiz history with pagination', async () => {
    // User A history should have 1 completed attempt (Attempt #1)
    const resA = await app.inject({
      method: 'GET',
      url: '/api/history?page=1&limit=10',
      headers: { cookie: userACookie },
    });

    expect(resA.statusCode).toBe(200);
    const bodyA = JSON.parse(resA.payload);
    expect(bodyA.success).toBe(true);
    expect(bodyA.data.total).toBe(1);
    expect(bodyA.data.items).toHaveLength(1);

    const historyItem = bodyA.data.items[0];
    expect(historyItem.attemptId).toBe(userAAttempt1Id);
    expect(historyItem.topic).toBe('Rust Memory Safety');
    expect(historyItem.totalQuestions).toBe(3);
    expect(typeof historyItem.score).toBe('number');

    // User B history must be completely empty
    const resB = await app.inject({
      method: 'GET',
      url: '/api/history',
      headers: { cookie: userBCookie },
    });
    expect(resB.statusCode).toBe(200);
    const bodyB = JSON.parse(resB.payload);
    expect(bodyB.data.total).toBe(0);
    expect(bodyB.data.items).toHaveLength(0);
  });
});
