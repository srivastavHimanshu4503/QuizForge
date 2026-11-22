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

  it('blocks students from accessing full classroom gradebook (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classrooms/${classroomId}/gradebook`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows teacher to retrieve full classroom gradebook matrix with psychometric item analysis', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classrooms/${classroomId}/gradebook`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const gradebook = body.data;
    expect(gradebook.classroom.id).toBe(classroomId);
    expect(gradebook.stats.totalStudents).toBe(1);
    expect(gradebook.stats.totalAssignments).toBe(1);
    expect(gradebook.stats.overallCompletionRate).toBe(100);
    expect(typeof gradebook.stats.classAveragePercentage).toBe('number');

    // Verify assignment column definitions
    expect(gradebook.assignments.length).toBe(1);
    const assignCol = gradebook.assignments[0];
    expect(assignCol.id).toBe(assignmentId);
    expect(Array.isArray(assignCol.itemAnalysis)).toBe(true);
    expect(assignCol.itemAnalysis.length).toBeGreaterThan(0);
    const qAnalysis = assignCol.itemAnalysis[0];
    expect(qAnalysis).toHaveProperty('questionId');
    expect(qAnalysis).toHaveProperty('difficultyIndex');
    expect(qAnalysis).toHaveProperty('difficultyLabel');
    expect(qAnalysis).toHaveProperty('flagged');

    // Verify student matrix row
    expect(gradebook.students.length).toBe(1);
    const studentRow = gradebook.students[0];
    expect(studentRow.studentName).toBe('Alice Student');
    expect(studentRow.completedCount).toBe(1);
    expect(studentRow.overallAveragePercentage).toBeDefined();
    expect(studentRow.scores[assignmentId]).toBeDefined();
    expect(studentRow.scores[assignmentId].status).toBe('completed');
  });

  it('blocks students from exporting classroom gradebook CSV (403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classrooms/${classroomId}/gradebook/export`,
      headers: { cookie: studentCookie },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows teacher to export classroom gradebook CSV with proper headers and escaping', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/classrooms/${classroomId}/gradebook/export`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment; filename=');
    expect(res.payload).toContain('"Student Name","Student Email","Enrolled Date","Completed Assignments","Overall Average (%)"');
    expect(res.payload).toContain('Alice Student');
  });

  it('allows teacher to retrieve their created quizzes via GET /api/quizzes/mine', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/quizzes/mine',
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.quizzes)).toBe(true);
    expect(body.data.quizzes.some((q: any) => q.id === quizId)).toBe(true);
  });

  it('allows teacher to update assignment settings via PUT /api/classrooms/assignments/:id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/classrooms/assignments/${assignmentId}`,
      headers: { cookie: teacherCookie },
      payload: {
        title: 'Updated Homework: Raft Protocol v2',
        maxAttempts: 3,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Updated Homework: Raft Protocol v2');
    expect(body.data.maxAttempts).toBe(3);
  });

  it('allows teacher to create a timed & shuffled assignment (Milestone 9)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms/assignments',
      headers: { cookie: teacherCookie },
      payload: {
        classroomId,
        quizId,
        quizType: 'mcq',
        title: 'Timed Exam: Distributed Systems Final',
        description: 'Strict 10-minute exam with question randomization and academic integrity defenses.',
        maxAttempts: 1,
        timeLimitMinutes: 10,
        shuffleQuestions: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.timeLimitMinutes).toBe(10);
    expect(body.data.shuffleQuestions).toBe(true);
    const timedAssignmentId = body.data.id;

    // Student starts attempt on timed assignment
    const startRes = await app.inject({
      method: 'POST',
      url: `/api/classrooms/assignments/${timedAssignmentId}/start`,
      headers: { cookie: studentCookie },
    });
    expect(startRes.statusCode).toBe(201);
    const startBody = JSON.parse(startRes.payload);
    const timedAttemptId = startBody.data.attemptId;

    // Verify active attempt returns timeLimitMinutes
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/attempts/${timedAttemptId}`,
      headers: { cookie: studentCookie },
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.data.timeLimitMinutes).toBe(10);
    expect(getBody.data.questions).toBeDefined();

    // Student records integrity event (tab switch)
    const integrityRes = await app.inject({
      method: 'POST',
      url: `/api/attempts/${timedAttemptId}/integrity-event`,
      headers: { cookie: studentCookie },
      payload: { tabSwitchCount: 4 },
    });
    expect(integrityRes.statusCode).toBe(200);
    const integrityBody = JSON.parse(integrityRes.payload);
    expect(integrityBody.success).toBe(true);
    expect(integrityBody.data.tabSwitchCount).toBe(4);

    // Student submits timed-out attempt
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/attempts/${timedAttemptId}/submit`,
      headers: { cookie: studentCookie },
      payload: { isTimedOut: true, tabSwitchCount: 4 },
    });
    expect(submitRes.statusCode).toBe(200);
    const submitBody = JSON.parse(submitRes.payload);
    expect(submitBody.success).toBe(true);
    expect(submitBody.data.isTimedOut).toBe(true);
    expect(submitBody.data.tabSwitchCount).toBe(4);
    expect(typeof submitBody.data.durationSeconds).toBe('number');

    // Teacher views submissions and sees integrity flag and timeout
    const subRes = await app.inject({
      method: 'GET',
      url: `/api/classrooms/assignments/${timedAssignmentId}/submissions`,
      headers: { cookie: teacherCookie },
    });
    expect(subRes.statusCode).toBe(200);
    const subBody = JSON.parse(subRes.payload);
    const studentEntry = subBody.data.find((s: any) => s.studentName === 'Alice Student');
    expect(studentEntry).toBeDefined();
    expect(studentEntry.tabSwitchCount).toBe(4);
    expect(studentEntry.isTimedOut).toBe(true);
    expect(studentEntry.timeLimitMinutes).toBe(10);
  });

  it('allows teacher to delete an assignment via DELETE /api/classrooms/assignments/:id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/classrooms/assignments/${assignmentId}`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(assignmentId);

    // Verify assignment is no longer listed in classroom details
    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/classrooms/${classroomId}`,
      headers: { cookie: teacherCookie },
    });
    const detailBody = JSON.parse(detailRes.payload);
    expect(detailBody.data.assignments.some((a: any) => a.id === assignmentId)).toBe(false);
  });

  it('allows teacher to delete a classroom via DELETE /api/classrooms/:id', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/classrooms/${classroomId}`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });

  it('allows user to delete a quiz via DELETE /api/quizzes/:quizId', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/quizzes/${quizId}`,
      headers: { cookie: teacherCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
  });
});
