import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

describe('RBAC & Classroom / Assignment Engine (Milestone 2)', () => {
  let app: FastifyInstance;
  const runId = Date.now();
  const teacherEmail = `prof.smith.${runId}@university.edu`;
  const studentEmail = `alice.student.${runId}@university.edu`;

  let teacherCookie: string;
  let studentCookie: string;
  let teacherId: string;
  let classroomId: string;
  let classroomCode: string;
  let quizId: string;
  let assignmentId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a teacher account with role="teacher"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: teacherEmail,
        password: 'Password123!',
        displayName: 'Professor Smith',
        role: 'teacher',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('teacher');
    teacherId = body.data.user.id;

    const cookieHeader = res.headers['set-cookie'];
    expect(cookieHeader).toBeDefined();
    teacherCookie = Array.isArray(cookieHeader) ? cookieHeader[0]! : (cookieHeader as string);
  });

  it('registers a student account with default role="student"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: studentEmail,
        password: 'Password123!',
        displayName: 'Alice Student',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('student');

    const cookieHeader = res.headers['set-cookie'];
    studentCookie = Array.isArray(cookieHeader) ? cookieHeader[0]! : (cookieHeader as string);
  });

  it('blocks students from creating a classroom (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms',
      headers: { cookie: studentCookie },
      payload: {
        name: 'Hacked Class',
        description: 'Should fail',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('allows teachers to create a classroom with an automated join code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms',
      headers: { cookie: teacherCookie },
      payload: {
        name: 'Distributed Systems 401',
        description: 'Advanced distributed consensus, Paxos, and Raft.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Distributed Systems 401');
    expect(body.data.code).toBeDefined();
    expect(body.data.code.length).toBe(6);
    expect(body.data.teacherId).toBe(teacherId);

    classroomId = body.data.id;
    classroomCode = body.data.code;
  });

  it('prevents teachers from joining their own classroom as a student (400)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms/join',
      headers: { cookie: teacherCookie },
      payload: { code: classroomCode },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('SELF_ENROLLMENT_DISALLOWED');
  });

  it('allows a student to enroll in the classroom using the join code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms/join',
      headers: { cookie: studentCookie },
      payload: { code: classroomCode.toLowerCase() }, // Test case-insensitivity
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(classroomId);
    expect(body.data.memberCount).toBe(1);
  });

  it('rejects duplicate enrollment in the same classroom (409 Conflict)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms/join',
      headers: { cookie: studentCookie },
      payload: { code: classroomCode },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('ALREADY_ENROLLED');
  });

  it('teacher generates a master quiz to be assigned', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/quizzes/generate',
      headers: { cookie: teacherCookie },
      payload: {
        topic: 'Raft Consensus Protocol',
        questionCount: 3,
        difficulty: 'hard',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    quizId = body.data.quizId;
    expect(quizId).toBeDefined();
  });

  it('blocks students from assigning quizzes (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms/assignments',
      headers: { cookie: studentCookie },
      payload: {
        classroomId,
        quizId,
        quizType: 'mcq',
        title: 'Unauthorized Assignment',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows teacher to create an assignment with parameters (due date, maxAttempts)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms/assignments',
      headers: { cookie: teacherCookie },
      payload: {
        classroomId,
        quizId,
        quizType: 'mcq',
        title: 'Homework 1: Raft Leader Election',
        description: 'Complete before class tomorrow.',
        dueDate: tomorrow,
        maxAttempts: 2,
        timeLimitMinutes: 30,
        showFeedbackImmediately: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Homework 1: Raft Leader Election');
    expect(body.data.maxAttempts).toBe(2);
    expect(body.data.classroomId).toBe(classroomId);

    assignmentId = body.data.id;
  });

  it('enrolled student sees assignment in their task list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/classrooms/assignments/student',
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const myAssignment = body.data.find((a: any) => a.id === assignmentId);
    expect(myAssignment).toBeDefined();
    expect(myAssignment.title).toBe('Homework 1: Raft Leader Election');
    expect(myAssignment.myAttemptsCount).toBe(0);
    expect(myAssignment.isCompleted).toBe(false);
    expect(myAssignment.isOverdue).toBe(false);
  });

  it('student starts an assigned quiz attempt and submits answers', async () => {
    // 1. Start assignment attempt
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/classrooms/assignments/${assignmentId}/start`,
      headers: { cookie: studentCookie },
    });

    expect(startRes.statusCode).toBe(201);
    const startBody = JSON.parse(startRes.payload);
    expect(startBody.success).toBe(true);
    expect(startBody.data.status).toBe('in_progress');
    const attemptId = startBody.data.attemptId;
    expect(attemptId).toBeDefined();

    // 2. Fetch active attempt
    const attemptRes = await app.inject({
      method: 'GET',
      url: `/api/attempts/${attemptId}`,
      headers: { cookie: studentCookie },
    });

    expect(attemptRes.statusCode).toBe(200);
    const attemptBody = JSON.parse(attemptRes.payload);
    const q1 = attemptBody.data.questions[0];
    expect(q1).toBeDefined();

    // 3. Save an answer
    const ansRes = await app.inject({
      method: 'PATCH',
      url: `/api/attempts/${attemptId}/answers`,
      headers: { cookie: studentCookie },
      payload: {
        questionId: q1.question_id,
        selectedChoiceId: 'A',
      },
    });
    expect(ansRes.statusCode).toBe(200);

    // 4. Submit attempt
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/attempts/${attemptId}/submit`,
      headers: { cookie: studentCookie },
    });
    expect(submitRes.statusCode).toBe(200);
  });

  it('student status updates to completed with score recorded', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/classrooms/assignments/student',
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const myAssignment = body.data.find((a: any) => a.id === assignmentId);
    expect(myAssignment.myAttemptsCount).toBe(1);
    expect(myAssignment.isCompleted).toBe(true);
    expect(myAssignment.myBestScore).toBeDefined();
  });

  it('student takes attempt 2 successfully (since maxAttempts=2)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/classrooms/assignments/${assignmentId}/start`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const attemptId = body.data.attemptId;

    // Submit attempt 2
    await app.inject({
      method: 'POST',
      url: `/api/attempts/${attemptId}/submit`,
      headers: { cookie: studentCookie },
    });
  });

  it('enforces max attempt limit and rejects attempt 3 (400 Bad Request)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/classrooms/assignments/${assignmentId}/start`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('MAX_ATTEMPTS_REACHED');
  });

  it('teacher views assignment submissions gradebook matrix', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classrooms/assignments/${assignmentId}/submissions`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);

    const studentSub = body.data[0];
    expect(studentSub.studentName).toBe('Alice Student');
    expect(studentSub.attemptsCount).toBe(2);
    expect(studentSub.status).toBe('completed');
    expect(studentSub.bestScore).toBeDefined();
  });

  it('blocks students from viewing assignment gradebook submissions (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classrooms/assignments/${assignmentId}/submissions`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(403);
  });
});
