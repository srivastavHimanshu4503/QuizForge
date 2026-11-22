import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../db';
import { questions } from '../db/schema/questions';

describe('Milestone 11: Real-Time Live Quiz Arena (Multiplayer Battles)', () => {
  let app: FastifyInstance;
  const runId = Date.now();
  const hostEmail = `arena.host.${runId}@test.com`;
  const intruderEmail = `arena.intruder.${runId}@test.com`;

  let hostCookie: string;
  let intruderCookie: string;
  let quizId: string;
  let arenaPin: string;
  let aliceParticipantId: string;
  let bobParticipantId: string;
  let question1Id: string;
  let question2Id: string;
  let q1CorrectChoice: string;
  let q2CorrectChoice: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Register host
    const hostRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: hostEmail,
        password: 'Password123!',
        displayName: 'Professor Charles Xavier',
        role: 'teacher',
      },
    });
    expect(hostRes.statusCode).toBe(201);
    const hostCookieHeader = hostRes.headers['set-cookie'];
    hostCookie = Array.isArray(hostCookieHeader) ? hostCookieHeader[0]! : (hostCookieHeader as string);

    // 2. Register intruder
    const intruderRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: intruderEmail,
        password: 'Password123!',
        displayName: 'Magneto',
      },
    });
    expect(intruderRes.statusCode).toBe(201);
    const intCookieHeader = intruderRes.headers['set-cookie'];
    intruderCookie = Array.isArray(intCookieHeader) ? intCookieHeader[0]! : (intCookieHeader as string);

    // 3. Generate a master quiz
    const quizRes = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: hostCookie },
      payload: {
        topic: 'Quantum Computing & Grover Algorithm',
        questionCount: 2,
        difficulty: 'hard',
      },
    });
    expect(quizRes.statusCode).toBe(201);
    const quizBody = JSON.parse(quizRes.payload);
    quizId = quizBody.data.quizId;

    // Query actual questions in questionOrder so arena sequence matches
    const dbQuestions = db
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(questions.questionOrder)
      .all();

    question1Id = dbQuestions[0]!.id;
    q1CorrectChoice = dbQuestions[0]!.correctChoiceId;
    question2Id = dbQuestions[1]!.id;
    q2CorrectChoice = dbQuestions[1]!.correctChoiceId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('host initializes an arena live room with a 6-digit PIN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/arena/sessions',
      headers: { cookie: hostCookie },
      payload: {
        quizId,
        timePerQuestionSeconds: 30,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.pin).toMatch(/^\d{6}$/);
    expect(body.data.totalQuestions).toBe(2);
    expect(body.data.timePerQuestionSeconds).toBe(30);

    arenaPin = body.data.pin;
  });

  it('players join arena lobby via 6-digit PIN and nickname', async () => {
    // Player 1: Alice
    const aliceRes = await app.inject({
      method: 'POST',
      url: '/api/arena/join',
      payload: {
        pin: arenaPin,
        nickname: 'Alice',
      },
    });

    expect(aliceRes.statusCode).toBe(200);
    const aliceBody = JSON.parse(aliceRes.payload);
    expect(aliceBody.success).toBe(true);
    expect(aliceBody.data.nickname).toBe('Alice');
    expect(aliceBody.data.status).toBe('lobby');
    aliceParticipantId = aliceBody.data.participantId;

    // Player 2: Bob
    const bobRes = await app.inject({
      method: 'POST',
      url: '/api/arena/join',
      payload: {
        pin: arenaPin,
        nickname: 'Bob',
      },
    });

    expect(bobRes.statusCode).toBe(200);
    const bobBody = JSON.parse(bobRes.payload);
    expect(bobBody.data.nickname).toBe('Bob');
    bobParticipantId = bobBody.data.participantId;
  });

  it('rejects duplicate nickname in the same arena room (409 Conflict)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/arena/join',
      payload: {
        pin: arenaPin,
        nickname: 'Alice',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('NICKNAME_TAKEN');
  });

  it('retrieves live arena lobby state showing both joined players', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/arena/${arenaPin}/state`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.status).toBe('lobby');
    expect(body.data.participants).toHaveLength(2);
    expect(body.data.participants.some((p: any) => p.nickname === 'Alice')).toBe(true);
    expect(body.data.participants.some((p: any) => p.nickname === 'Bob')).toBe(true);
  });

  it('blocks non-hosts from starting the arena game (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/start`,
      headers: { cookie: intruderCookie },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('host starts the arena battle and delivers question 1 to participants', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/start`,
      headers: { cookie: hostCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.status).toBe('question');
    expect(body.data.currentQuestion).toBeDefined();
    expect(body.data.currentQuestion.index).toBe(1);
    expect(body.data.currentQuestion.total).toBe(2);
    expect(body.data.currentQuestion.choices).toHaveLength(4);
  });

  it('players submit answers: Alice correct with speed bonus, Bob incorrect', async () => {
    // Alice answers correctly within 2000ms
    const aliceAns = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/answer`,
      payload: {
        participantId: aliceParticipantId,
        questionId: question1Id,
        selectedChoiceId: q1CorrectChoice,
        responseTimeMs: 2000,
      },
    });

    expect(aliceAns.statusCode).toBe(200);
    const aBody = JSON.parse(aliceAns.payload);
    expect(aBody.data.isCorrect).toBe(true);
    expect(aBody.data.pointsAwarded).toBeGreaterThan(1400); // 1000 base + speed bonus
    expect(aBody.data.newStreak).toBe(1);

    // Bob answers with wrong choice
    const wrongChoice = q1CorrectChoice === 'A' ? 'B' : 'A';
    const bobAns = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/answer`,
      payload: {
        participantId: bobParticipantId,
        questionId: question1Id,
        selectedChoiceId: wrongChoice,
        responseTimeMs: 5000,
      },
    });

    expect(bobAns.statusCode).toBe(200);
    const bBody = JSON.parse(bobAns.payload);
    expect(bBody.data.isCorrect).toBe(false);
    expect(bBody.data.pointsAwarded).toBe(0);
    expect(bBody.data.newStreak).toBe(0);
    // Since both players answered, auto-completion triggers leaderboard transition
    expect(bBody.data.allAnswered).toBe(true);
  });

  it('inspects question end breakdown and live leaderboard ranking', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/arena/${arenaPin}/state`,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.status).toBe('leaderboard');
    expect(body.data.questionEnd).toBeDefined();
    expect(body.data.questionEnd.correctChoiceId).toBe(q1CorrectChoice);
    expect(body.data.questionEnd.totalAnswers).toBe(2);

    // Leaderboard verification
    expect(body.data.leaderboard).toBeDefined();
    expect(body.data.leaderboard[0].nickname).toBe('Alice');
    expect(body.data.leaderboard[0].score).toBeGreaterThan(0);
    expect(body.data.leaderboard[0].rank).toBe(1);
    expect(body.data.leaderboard[1].nickname).toBe('Bob');
    expect(body.data.leaderboard[1].score).toBe(0);
  });

  it('host advances to question 2 and players compete', async () => {
    const nextRes = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/next`,
      headers: { cookie: hostCookie },
    });

    expect(nextRes.statusCode).toBe(200);
    const nextBody = JSON.parse(nextRes.payload);
    expect(nextBody.data.status).toBe('question');
    expect(nextBody.data.currentQuestion.index).toBe(2);

    // Alice answers correct again with streak bonus
    const aAns = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/answer`,
      payload: {
        participantId: aliceParticipantId,
        questionId: question2Id,
        selectedChoiceId: q2CorrectChoice,
        responseTimeMs: 1500,
      },
    });
    const aBody = JSON.parse(aAns.payload);
    expect(aBody.data.isCorrect).toBe(true);
    expect(aBody.data.newStreak).toBe(2);

    // Bob answers correct this time
    const bAns = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/answer`,
      payload: {
        participantId: bobParticipantId,
        questionId: question2Id,
        selectedChoiceId: q2CorrectChoice,
        responseTimeMs: 4000,
      },
    });
    const bBody = JSON.parse(bAns.payload);
    expect(bBody.data.isCorrect).toBe(true);
    expect(bBody.data.pointsAwarded).toBeGreaterThan(1000);
  });

  it('host finishes the arena battle and reveals the final podium', async () => {
    // End question 2
    await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/end-question`,
      headers: { cookie: hostCookie },
    });

    // Advance beyond last question -> finished
    const finishRes = await app.inject({
      method: 'POST',
      url: `/api/arena/${arenaPin}/next`,
      headers: { cookie: hostCookie },
    });

    expect(finishRes.statusCode).toBe(200);
    const finishBody = JSON.parse(finishRes.payload);
    expect(finishBody.data.status).toBe('finished');
    expect(finishBody.data.podium).toBeDefined();
    expect(finishBody.data.podium.length).toBe(2);

    // 1st place: Alice (Gold)
    expect(finishBody.data.podium[0].nickname).toBe('Alice');
    expect(finishBody.data.podium[0].rank).toBe(1);

    // 2nd place: Bob (Silver)
    expect(finishBody.data.podium[1].nickname).toBe('Bob');
    expect(finishBody.data.podium[1].rank).toBe(2);
  });
});
