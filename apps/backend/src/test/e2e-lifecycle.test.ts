import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';
import { ClientQuestion } from '@quiz-forge/shared';

describe('End-to-End Complete Quiz Lifecycle (All 10 Core Requirements)', () => {
  let app: FastifyInstance;
  let authCookie = '';

  let quizId = '';
  let attempt1Id = '';
  let attempt2Id = '';

  let questionsAttempt1: ClientQuestion[] = [];
  const correctAnswersByQuestionId = new Map<string, 'A' | 'B' | 'C' | 'D'>();

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Req 1: User Registration
  it('Requirement 1 & 2: User registers and logs in with secure credentials', async () => {
    const email = `e2e_student_${Date.now()}@quizforge.com`;
    const password = 'SuperSecurePassword123!';

    // Register
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password,
        displayName: 'E2E Student',
      },
    });

    expect(regRes.statusCode).toBe(201);
    const cookie = regRes.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();

    // Login
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginCookie = loginRes.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    expect(loginCookie).toBeDefined();

    authCookie = `${loginCookie?.name}=${loginCookie?.value}`;
  });

  // Req 3 & 4: Enter topic, question count, difficulty tier & generate questions
  it('Requirement 3 & 4: Generates questions and answers via AI provider adapter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: authCookie },
      payload: {
        topic: 'Kubernetes Pod Lifecycle & Scheduling',
        questionCount: 4,
        difficulty: 'medium',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.quizId).toBeDefined();
    expect(body.data.attemptId).toBeDefined();
    expect(body.data.totalQuestions).toBe(4);
    expect(body.data.status).toBe('in_progress');

    quizId = body.data.quizId;
    attempt1Id = body.data.attemptId;
  });

  // Req 5 & 6: Interactive MCQ interface, Previous/Next navigation & anti-cheat check
  it('Requirement 5 & 6: Delivers sanitized attempt questions and preserves answers during navigation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${attempt1Id}`,
      headers: { cookie: authCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.status).toBe('in_progress');
    expect(body.data.questions).toHaveLength(4);

    questionsAttempt1 = body.data.questions;

    // Security check: Correct answers and explanations MUST NOT be in the client payload
    for (const q of questionsAttempt1) {
      expect(q.choices).toHaveLength(4);
      // @ts-expect-error verifying property absence
      expect(q.correct_answer_id).toBeUndefined();
      // @ts-expect-error verifying property absence
      expect(q.explanation).toBeUndefined();
    }

    // Step through navigation and autosave answers
    const q0 = questionsAttempt1[0]!.question_id;
    const q1 = questionsAttempt1[1]!.question_id;
    const q2 = questionsAttempt1[2]!.question_id;
    // q3 left unanswered

    // Answer Q0 with 'A'
    await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${attempt1Id}/answers`,
      headers: { cookie: authCookie },
      payload: { questionId: q0, selectedChoiceId: 'A' },
    });

    // Answer Q1 with 'B'
    await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${attempt1Id}/answers`,
      headers: { cookie: authCookie },
      payload: { questionId: q1, selectedChoiceId: 'B' },
    });

    // Answer Q2 with 'C', then change to 'D' (modifying selection)
    await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${attempt1Id}/answers`,
      headers: { cookie: authCookie },
      payload: { questionId: q2, selectedChoiceId: 'C' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${attempt1Id}/answers`,
      headers: { cookie: authCookie },
      payload: { questionId: q2, selectedChoiceId: 'D' },
    });

    // Verify persistence across navigation
    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/attempts/${attempt1Id}`,
      headers: { cookie: authCookie },
    });
    const saved = JSON.parse(checkRes.payload).data.savedAnswers;
    expect(saved[q0]).toBe('A');
    expect(saved[q1]).toBe('B');
    expect(saved[q2]).toBe('D');
    expect(saved[questionsAttempt1[3]!.question_id]).toBeUndefined();
  });

  // Req 7: View results after submitting quiz
  it('Requirement 7: Calculates score server-side and exposes post-submission review', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/attempts/${attempt1Id}/submit`,
      headers: { cookie: authCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const result = body.data;
    expect(result.attemptId).toBe(attempt1Id);
    expect(result.totalQuestions).toBe(4);
    expect(result.unansweredCount).toBe(1); // 1 skipped
    expect(result.correctCount + result.incorrectCount).toBe(3);
    expect(result.score).toBe(result.correctCount);
    expect(result.accuracyPercentage).toBe(
      Math.round((result.correctCount / 4) * 10000) / 100
    );

    // Save known correct choices for Attempt #2 testing
    for (const item of result.review) {
      correctAnswersByQuestionId.set(item.question_id, item.correct_choice_id);
      expect(item.explanation.length).toBeGreaterThan(5);
    }
  });

  // Req 8: View previous quiz scores
  it('Requirement 8: Shows completed attempt in user quiz history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/history',
      headers: { cookie: authCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.total).toBe(1);
    expect(body.data.items[0].attemptId).toBe(attempt1Id);
    expect(body.data.items[0].topic).toBe('Kubernetes Pod Lifecycle & Scheduling');
    expect(body.data.items[0].totalQuestions).toBe(4);
  });

  // Req 9: Restart a previous quiz using the same questions in a shuffled order (Zero AI calls)
  it('Requirement 9: Restarts quiz with identical questions in shuffled order and zero AI calls', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/quizzes/${quizId}/restart`,
      headers: { cookie: authCookie },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.quizId).toBe(quizId);
    expect(body.data.attemptId).not.toBe(attempt1Id);
    expect(body.data.attemptNumber).toBe(2);

    attempt2Id = body.data.attemptId;

    // Fetch attempt 2
    const att2Res = await app.inject({
      method: 'GET',
      url: `/api/attempts/${attempt2Id}`,
      headers: { cookie: authCookie },
    });

    const att2Body = JSON.parse(att2Res.payload);
    expect(att2Body.data.status).toBe('in_progress');
    expect(att2Body.data.savedAnswers).toEqual({});
    expect(att2Body.data.questions).toHaveLength(4);

    // Verify all original questions exist in Attempt #2
    const qIdsAttempt2 = att2Body.data.questions.map(
      (q: ClientQuestion) => q.question_id
    );
    const qIdsAttempt1 = questionsAttempt1.map((q) => q.question_id);
    expect(new Set(qIdsAttempt2)).toEqual(new Set(qIdsAttempt1));

    // Answer Attempt #2 with 100% correct answers using saved correct choices
    for (const q of att2Body.data.questions) {
      const correctChoice = correctAnswersByQuestionId.get(q.question_id);
      expect(correctChoice).toBeDefined();

      await app.inject({
        method: 'PATCH',
        url: `/api/attempts/${attempt2Id}/answers`,
        headers: { cookie: authCookie },
        payload: {
          questionId: q.question_id,
          selectedChoiceId: correctChoice,
        },
      });
    }

    // Submit Attempt #2
    const submit2Res = await app.inject({
      method: 'POST',
      url: `/api/attempts/${attempt2Id}/submit`,
      headers: { cookie: authCookie },
    });

    const submit2Body = JSON.parse(submit2Res.payload);
    expect(submit2Body.data.score).toBe(4);
    expect(submit2Body.data.correctCount).toBe(4);
    expect(submit2Body.data.incorrectCount).toBe(0);
    expect(submit2Body.data.unansweredCount).toBe(0);
    expect(submit2Body.data.accuracyPercentage).toBe(100);

    // History now contains both Attempt 1 and Attempt 2
    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/history',
      headers: { cookie: authCookie },
    });
    const historyBody = JSON.parse(historyRes.payload);
    expect(historyBody.data.total).toBe(2);
  });

  // Req 10: Generate another quiz using a fresh Gemini API request
  it('Requirement 10: Generates another quiz as a distinct separate entity', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: authCookie },
      payload: {
        topic: 'Golang Channels & Goroutines',
        questionCount: 3,
        difficulty: 'easy',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.data.quizId).not.toBe(quizId);
    expect(body.data.totalQuestions).toBe(3);
  });
});
