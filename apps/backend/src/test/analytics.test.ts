import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { db } from '../db/index';
import {
  quizzes,
  questions,
  choices,
  quizAttempts,
  attemptAnswers,
  classrooms,
  classroomMembers,
} from '../db/schema/index';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';

describe('Milestone 14: Knowledge Gap Heatmaps & Remedial Quiz Generator', () => {
  let app: FastifyInstance;
  let studentCookie: string;
  let teacherCookie: string;

  let studentId: string;
  let teacherId: string;
  let otherStudentId: string;
  let testClassroomId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Register Student
    const studentEmail = `student_analytics_${Date.now()}@example.com`;
    const sRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: studentEmail,
        password: 'Password123!',
        displayName: 'Heatmap Student',
        role: 'student',
      },
    });
    studentCookie = sRes.headers['set-cookie'] as string;
    studentId = JSON.parse(sRes.payload).data.user.id;

    // 2. Register Teacher
    const teacherEmail = `teacher_analytics_${Date.now()}@example.com`;
    const tRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: teacherEmail,
        password: 'Password123!',
        displayName: 'Heatmap Teacher',
        role: 'teacher',
      },
    });
    teacherCookie = tRes.headers['set-cookie'] as string;
    teacherId = JSON.parse(tRes.payload).data.user.id;

    // 3. Register Peer Student
    const otherEmail = `peer_student_${Date.now()}@example.com`;
    const oRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: otherEmail,
        password: 'Password123!',
        displayName: 'Peer Student',
        role: 'student',
      },
    });
    otherStudentId = JSON.parse(oRes.payload).data.user.id;

    // 4. Create Classroom & Add Members
    testClassroomId = crypto.randomUUID();
    db.insert(classrooms)
      .values({
        id: testClassroomId,
        teacherId,
        name: 'Computer Science 101',
        description: 'Foundations of CS',
        code: `CS${Date.now().toString().slice(-4)}`,
      })
      .run();

    db.insert(classroomMembers)
      .values([
        {
          id: crypto.randomUUID(),
          classroomId: testClassroomId,
          studentId,
        },
        {
          id: crypto.randomUUID(),
          classroomId: testClassroomId,
          studentId: otherStudentId,
        },
      ])
      .run();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Student Knowledge Heatmap & Weakness Diagnosis', () => {
    it('returns empty default heatmap structure for user with zero attempts', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/mastery-heatmap',
        headers: { cookie: studentCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.summary.totalAttempts).toBe(0);
      expect(body.data.summary.overallAccuracy).toBe(0);
      expect(body.data.topicHeatmap).toEqual([]);
      expect(body.data.knowledgeGaps).toEqual([]);
    });

    it('computes topic mastery, knowledge gaps, and difficulty metrics from completed attempts', async () => {
      // 1. Create Quiz 1: Topic "TypeScript Generics" (Mastered topic)
      const quiz1Id = crypto.randomUUID();
      db.insert(quizzes)
        .values({
          id: quiz1Id,
          userId: studentId,
          topic: 'TypeScript Generics',
          difficulty: 'medium',
          questionCount: 2,
        })
        .run();

      const q1Id = crypto.randomUUID();
      const q2Id = crypto.randomUUID();
      db.insert(questions)
        .values([
          {
            id: q1Id,
            quizId: quiz1Id,
            questionOrder: 1,
            questionText: 'What does generic type T represent?',
            correctChoiceId: 'A',
            explanation: 'T is a type variable placeholder.',
          },
          {
            id: q2Id,
            quizId: quiz1Id,
            questionOrder: 2,
            questionText: 'How do you constrain a generic?',
            correctChoiceId: 'B',
            explanation: 'Using the extends keyword.',
          },
        ])
        .run();

      // Choices for Quiz 1
      db.insert(choices)
        .values([
          { id: crypto.randomUUID(), questionId: q1Id, choiceId: 'A', optionText: 'Type placeholder' },
          { id: crypto.randomUUID(), questionId: q1Id, choiceId: 'B', optionText: 'Constant' },
          { id: crypto.randomUUID(), questionId: q2Id, choiceId: 'A', optionText: 'implements' },
          { id: crypto.randomUUID(), questionId: q2Id, choiceId: 'B', optionText: 'extends' },
        ])
        .run();

      // Completed attempt for Quiz 1: 2/2 correct (100% -> 'mastered')
      const attempt1Id = crypto.randomUUID();
      db.insert(quizAttempts)
        .values({
          id: attempt1Id,
          quizId: quiz1Id,
          userId: studentId,
          attemptNumber: 1,
          status: 'completed',
          shuffledOrder: [q1Id, q2Id],
          score: 2,
          totalQuestions: 2,
          correctCount: 2,
          incorrectCount: 0,
          unansweredCount: 0,
          accuracyPercentage: 100,
          completedAt: new Date().toISOString(),
        })
        .run();

      db.insert(attemptAnswers)
        .values([
          { id: crypto.randomUUID(), attemptId: attempt1Id, questionId: q1Id, selectedChoiceId: 'A', isCorrect: true },
          { id: crypto.randomUUID(), attemptId: attempt1Id, questionId: q2Id, selectedChoiceId: 'B', isCorrect: true },
        ])
        .run();

      // 2. Create Quiz 2: Topic "React Hooks" (Gap topic: 1 correct, 2 incorrect -> 33%)
      const quiz2Id = crypto.randomUUID();
      db.insert(quizzes)
        .values({
          id: quiz2Id,
          userId: studentId,
          topic: 'React Hooks',
          difficulty: 'hard',
          questionCount: 3,
        })
        .run();

      const q3Id = crypto.randomUUID();
      const q4Id = crypto.randomUUID();
      const q5Id = crypto.randomUUID();

      db.insert(questions)
        .values([
          {
            id: q3Id,
            quizId: quiz2Id,
            questionOrder: 1,
            questionText: 'When does useEffect run?',
            correctChoiceId: 'A',
            explanation: 'Runs after render and commit phase.',
          },
          {
            id: q4Id,
            quizId: quiz2Id,
            questionOrder: 2,
            questionText: 'What is the purpose of useMemo?',
            correctChoiceId: 'A',
            explanation: 'Memoizes expensive computed values between renders.',
          },
          {
            id: q5Id,
            quizId: quiz2Id,
            questionOrder: 3,
            questionText: 'Can hooks be called inside loops?',
            correctChoiceId: 'B',
            explanation: 'Hooks must always be called at the top level.',
          },
        ])
        .run();

      db.insert(choices)
        .values([
          { id: crypto.randomUUID(), questionId: q3Id, choiceId: 'A', optionText: 'After commit' },
          { id: crypto.randomUUID(), questionId: q4Id, choiceId: 'A', optionText: 'Cache values' },
          { id: crypto.randomUUID(), questionId: q5Id, choiceId: 'B', optionText: 'Never in loops' },
        ])
        .run();

      const attempt2Id = crypto.randomUUID();
      db.insert(quizAttempts)
        .values({
          id: attempt2Id,
          quizId: quiz2Id,
          userId: studentId,
          attemptNumber: 1,
          status: 'completed',
          shuffledOrder: [q3Id, q4Id, q5Id],
          score: 1,
          totalQuestions: 3,
          correctCount: 1,
          incorrectCount: 2,
          unansweredCount: 0,
          accuracyPercentage: 33.3,
          completedAt: new Date().toISOString(),
        })
        .run();

      db.insert(attemptAnswers)
        .values([
          { id: crypto.randomUUID(), attemptId: attempt2Id, questionId: q3Id, selectedChoiceId: 'A', isCorrect: true },
          { id: crypto.randomUUID(), attemptId: attempt2Id, questionId: q4Id, selectedChoiceId: 'B', isCorrect: false },
          { id: crypto.randomUUID(), attemptId: attempt2Id, questionId: q5Id, selectedChoiceId: 'A', isCorrect: false },
        ])
        .run();

      // Fetch student heatmap
      const res = await app.inject({
        method: 'GET',
        url: '/api/analytics/mastery-heatmap',
        headers: { cookie: studentCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      // Verify Summary
      expect(body.data.summary.totalAttempts).toBe(2);
      expect(body.data.summary.totalQuestionsAnswered).toBe(5);
      expect(body.data.summary.masteredTopicsCount).toBe(1);
      expect(body.data.summary.identifiedGapsCount).toBe(1);

      // Verify Topic Heatmap
      const tsTopic = body.data.topicHeatmap.find((t: any) => t.topic === 'TypeScript Generics');
      expect(tsTopic).toBeDefined();
      expect(tsTopic.accuracyPercentage).toBe(100);
      expect(tsTopic.masteryLevel).toBe('mastered');

      const reactTopic = body.data.topicHeatmap.find((t: any) => t.topic === 'React Hooks');
      expect(reactTopic).toBeDefined();
      expect(reactTopic.accuracyPercentage).toBe(33);
      expect(reactTopic.masteryLevel).toBe('gap');

      // Verify Knowledge Gaps
      expect(body.data.knowledgeGaps.length).toBeGreaterThanOrEqual(1);
      const topGap = body.data.knowledgeGaps[0];
      expect(topGap.topic).toBe('React Hooks');
      expect(topGap.priority).toBe('critical');
      expect(topGap.missedQuestionsCount).toBe(2);
      expect(topGap.sampleMissedQuestions.length).toBe(2);
      expect(topGap.sampleMissedQuestions[0].explanation).toBeDefined();

      // Verify Difficulty Breakdown
      const hardDiff = body.data.difficultyBreakdown.find((d: any) => d.difficulty === 'hard');
      expect(hardDiff.totalQuestions).toBe(3);
      expect(hardDiff.correctCount).toBe(1);

      const medDiff = body.data.difficultyBreakdown.find((d: any) => d.difficulty === 'medium');
      expect(medDiff.totalQuestions).toBe(2);
      expect(medDiff.correctCount).toBe(2);
    });
  });

  describe('Classroom Knowledge Gap Heatmap (Teacher View)', () => {
    it('rejects unauthorized students from accessing classroom heatmap', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/classroom/${testClassroomId}/heatmap`,
        headers: { cookie: studentCookie },
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns classroom-level aggregate topic mastery matrix and identified weak points', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/analytics/classroom/${testClassroomId}/heatmap`,
        headers: { cookie: teacherCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.classroomId).toBe(testClassroomId);
      expect(body.data.classroomName).toBe('Computer Science 101');
      expect(body.data.totalStudents).toBe(2);

      // Check topic heatmap contains aggregate stats
      expect(body.data.topicHeatmap.length).toBeGreaterThan(0);
      const weakTopic = body.data.identifiedWeakPoints.find((w: any) => w.topic === 'React Hooks');
      expect(weakTopic).toBeDefined();
      expect(weakTopic.strugglingStudentsCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Targeted Remedial Quiz Generator', () => {
    it('generates a focused remedial practice quiz targeting student knowledge gaps', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/analytics/remedial-quiz',
        headers: { cookie: studentCookie },
        payload: {
          questionCount: 3,
          difficulty: 'medium',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.quizId).toBeDefined();
      expect(body.data.attemptId).toBeDefined();
      expect(body.data.topic).toContain('React Hooks');
      expect(body.data.questionCount).toBeGreaterThanOrEqual(1);
      expect(body.data.focusSummary).toContain('React Hooks');

      // Verify quiz exists in database
      const savedQuiz = db.select().from(quizzes).where(eq(quizzes.id, body.data.quizId)).get();
      expect(savedQuiz).toBeDefined();
      expect(savedQuiz?.topic).toContain('Remedial Practice');

      // Verify initial attempt is created
      const initialAttempt = db.select().from(quizAttempts).where(eq(quizAttempts.id, body.data.attemptId)).get();
      expect(initialAttempt).toBeDefined();
      expect(initialAttempt?.status).toBe('in_progress');
    });

    it('allows generating remedial quiz for an explicitly targeted topic', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/analytics/remedial-quiz',
        headers: { cookie: studentCookie },
        payload: {
          targetTopic: 'TypeScript Generics',
          questionCount: 2,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.topic).toContain('TypeScript Generics');
    });
  });
});
