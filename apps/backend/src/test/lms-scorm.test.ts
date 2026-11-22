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
} from '../db/schema/index';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import {
  calculateCronbachAlpha,
  calculatePointBiserial,
  classifyDiscrimination,
  classifyReliability,
} from '@quiz-forge/shared';

describe('Milestone 17: Enterprise LMS Integration, SCORM/xAPI Export & Institutional Psychometrics', () => {
  let app: FastifyInstance;
  let userCookie: string;
  let teacherId: string;
  let testQuizId: string;
  let questionIds: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Register teacher user
    const teacherEmail = `educator_${Date.now()}@university.edu`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: teacherEmail,
        password: 'Password123!',
        displayName: 'Prof. Ada Lovelace',
        role: 'teacher',
      },
    });

    userCookie = regRes.headers['set-cookie'] as string;
    teacherId = JSON.parse(regRes.payload).data.user.id;

    // 2. Seed a test quiz for LMS export and psychometric analysis
    testQuizId = crypto.randomUUID();
    db.insert(quizzes)
      .values({
        id: testQuizId,
        userId: teacherId,
        topic: 'Distributed Systems Architecture',
        difficulty: 'hard',
        questionCount: 4,
        aiModel: 'gemini-2.5-flash',
      })
      .run();

    // Seed 4 questions
    const qTexts = [
      'What does the CAP theorem state?',
      'Which algorithm guarantees consensus in asynchronous networks with crash failures?',
      'What is the primary role of a write-ahead log (WAL) in distributed storage?',
      'How does consistent hashing minimize remapping during node scale-out?',
    ];

    questionIds = [];
    qTexts.forEach((qText, idx) => {
      const qId = crypto.randomUUID();
      questionIds.push(qId);

      db.insert(questions)
        .values({
          id: qId,
          quizId: testQuizId,
          questionOrder: idx + 1,
          questionText: qText,
          correctChoiceId: 'A',
          explanation: `Canonical explanation for question ${idx + 1}`,
          difficultyTier: idx < 2 ? 'medium' : 'hard',
          difficultyParam: (idx - 1.5) * 1.0,
        })
        .run();

      // Choices A, B, C, D
      ['A', 'B', 'C', 'D'].forEach((choiceLetter) => {
        db.insert(choices)
          .values({
            id: crypto.randomUUID(),
            questionId: qId,
            choiceId: choiceLetter as any,
            optionText: `Option ${choiceLetter} for Question ${idx + 1}`,
          })
          .run();
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Psychometric Statistical Formulas Unit Tests', () => {
    it('accurately calculates Cronbach Alpha reliability coefficient', () => {
      // 5 examinees across 4 items
      // Exam 1: 1, 1, 1, 1 (Total: 4)
      // Exam 2: 1, 1, 1, 0 (Total: 3)
      // Exam 3: 1, 1, 0, 0 (Total: 2)
      // Exam 4: 1, 0, 0, 0 (Total: 1)
      // Exam 5: 0, 0, 0, 0 (Total: 0)
      const matrix = [
        [1, 1, 1, 1],
        [1, 1, 1, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const totals = [4, 3, 2, 1, 0];

      const alpha = calculateCronbachAlpha(matrix, totals);
      expect(alpha).toBeGreaterThan(0.7); // Strongly consistent test
      expect(classifyReliability(alpha)).toBe('good');
    });

    it('accurately computes Point-Biserial Correlation (r_pb) for item discrimination', () => {
      // Item answered correctly only by top performers:
      // Item answers: 1 (score 4), 1 (score 3), 0 (score 2), 0 (score 1)
      const itemAnswers = [1, 1, 0, 0];
      const totalScores = [4, 3, 2, 1];

      const r_pb = calculatePointBiserial(itemAnswers, totalScores);
      expect(r_pb).toBeGreaterThan(0.7); // Exceptional discrimination
      expect(classifyDiscrimination(r_pb)).toBe('excellent');

      // Inverted item (flawed distractor where bottom performers got it right):
      const invertedAnswers = [0, 0, 1, 1];
      const invertedRpb = calculatePointBiserial(invertedAnswers, totalScores);
      expect(invertedRpb).toBeLessThan(0.0);
      expect(classifyDiscrimination(invertedRpb)).toBe('flawed');
    });
  });

  describe('SCORM 1.2, SCORM 2004 & xAPI Package Generation', () => {
    it('exports a valid SCORM 1.2 ZIP package with imsmanifest.xml and CMI 1.2 API wrapper', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/quizzes/${testQuizId}/export/scorm?version=1.2&passingScore=75`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.headers['content-disposition']).toContain('.zip');

      // Unzip and inspect package structure
      const zip = await JSZip.loadAsync(res.rawPayload);

      // Verify imsmanifest.xml
      const manifestFile = zip.file('imsmanifest.xml');
      expect(manifestFile).not.toBeNull();
      const manifestXml = await manifestFile!.async('string');
      expect(manifestXml).toContain('schemaversion>1.2<');
      expect(manifestXml).toContain('Distributed Systems Architecture');
      expect(manifestXml).toContain('href="index.html"');

      // Verify index.html self-contained player
      const htmlFile = zip.file('index.html');
      expect(htmlFile).not.toBeNull();
      const htmlContent = await htmlFile!.async('string');
      expect(htmlContent).toContain('LMSInitialize');
      expect(htmlContent).toContain('cmi.core.score.raw');
      expect(htmlContent).toContain('cmi.core.lesson_status');
      expect(htmlContent).toContain('CAP theorem');

      // Verify quizforge-meta.json
      const metaFile = zip.file('quizforge-meta.json');
      expect(metaFile).not.toBeNull();
      const metaJson = JSON.parse(await metaFile!.async('string'));
      expect(metaJson.totalQuestions).toBe(4);
      expect(metaJson.passingScorePercentage).toBe(75);
    });

    it('exports a valid SCORM 2004 4th Edition ZIP package with CMI 2004 scaled scoring', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/quizzes/${testQuizId}/export/scorm?version=2004_4th&passingScore=80`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const zip = await JSZip.loadAsync(res.rawPayload);

      // Verify SCORM 2004 manifest
      const manifest = await zip.file('imsmanifest.xml')!.async('string');
      expect(manifest).toContain('2004 4th Edition');
      expect(manifest).toContain('xmlns:imsss');

      // Verify SCORM 2004 CMI calls in HTML
      const html = await zip.file('index.html')!.async('string');
      expect(html).toContain('API_1484_11');
      expect(html).toContain('cmi.score.scaled');
      expect(html).toContain('cmi.completion_status');
    });

    it('exports an xAPI (Tin Can) package with tincan.xml activity descriptor', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/quizzes/${testQuizId}/export/scorm?version=xapi`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const zip = await JSZip.loadAsync(res.rawPayload);
      const tincan = await zip.file('tincan.xml')!.async('string');
      expect(tincan).toContain('http://projecttincan.com/tincan.xsd');
      expect(tincan).toContain('Distributed Systems Architecture');
    });
  });

  describe('Institutional Psychometrics & Cohort Analytics Engine', () => {
    it('computes test reliability, Cronbach Alpha, and item point-biserials across cohort attempts', async () => {
      // Seed 3 completed attempts with varied performance
      const attempt1Id = crypto.randomUUID();
      const attempt2Id = crypto.randomUUID();
      const attempt3Id = crypto.randomUUID();

      const seedAttempt = (attId: string, attemptNum: number, score: number, answersMap: Record<string, boolean>) => {
        db.insert(quizAttempts)
          .values({
            id: attId,
            quizId: testQuizId,
            userId: teacherId,
            attemptNumber: attemptNum,
            status: 'completed',
            score,
            totalQuestions: 4,
            correctCount: score,
            incorrectCount: 4 - score,
            accuracyPercentage: Math.round((score / 4) * 100),
            shuffledOrder: questionIds,
            completedAt: new Date().toISOString(),
          })
          .run();

        questionIds.forEach((qId) => {
          const isRight = answersMap[qId] ?? false;
          db.insert(attemptAnswers)
            .values({
              attemptId: attId,
              questionId: qId,
              selectedChoiceId: isRight ? 'A' : 'B',
              isCorrect: isRight,
            })
            .run();
        });
      };

      // Examinee 1 (High): score 4 (all correct)
      seedAttempt(attempt1Id, 1, 4, {
        [questionIds[0]!]: true,
        [questionIds[1]!]: true,
        [questionIds[2]!]: true,
        [questionIds[3]!]: true,
      });

      // Examinee 2 (Medium): score 2 (Q1, Q2 correct; Q3, Q4 incorrect)
      seedAttempt(attempt2Id, 2, 2, {
        [questionIds[0]!]: true,
        [questionIds[1]!]: true,
        [questionIds[2]!]: false,
        [questionIds[3]!]: false,
      });

      // Examinee 3 (Low): score 1 (Q1 correct; Q2, Q3, Q4 incorrect)
      seedAttempt(attempt3Id, 3, 1, {
        [questionIds[0]!]: true,
        [questionIds[1]!]: false,
        [questionIds[2]!]: false,
        [questionIds[3]!]: false,
      });

      // Query Psychometrics Endpoint
      const res = await app.inject({
        method: 'GET',
        url: `/api/quizzes/${testQuizId}/psychometrics`,
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);

      const data = body.data;
      expect(data.sampleSize).toBe(3);
      expect(data.meanScore).toBeCloseTo(2.33, 1);
      expect(data.items).toHaveLength(4);

      // Q1 was answered correctly by all 3 candidates: facility = 1.0
      const item1 = data.items[0];
      expect(item1.facilityIndex).toBe(1.0);
      expect(item1.correctResponses).toBe(3);

      // Q4 was answered correctly only by top candidate: positive discrimination
      const item4 = data.items[3];
      expect(item4.facilityIndex).toBeCloseTo(0.33, 1);
      expect(item4.discriminationIndex).toBeGreaterThan(0.0);

      // Score distribution buckets
      expect(data.scoreDistribution).toBeDefined();
      expect(data.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('LTI 1.3 Advantage Platform Registration & Grade Passback', () => {
    let platformId: string;

    it('registers an LTI 1.3 Consumer Platform (e.g. Canvas LMS)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/lti/platforms',
        headers: { cookie: userCookie },
        payload: {
          name: 'Harvard Canvas LMS',
          issuer: 'https://canvas.harvard.edu',
          clientId: 'harvard-quizforge-client-12345',
          authEndpoint: 'https://canvas.harvard.edu/api/lti/authorize_redirect',
          tokenEndpoint: 'https://canvas.harvard.edu/login/oauth2/token',
          keySetEndpoint: 'https://canvas.harvard.edu/api/lti/security/jwks',
          deploymentId: 'canvas-deployment-998877',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('Harvard Canvas LMS');
      platformId = body.data.id;
    });

    it('lists registered LTI 1.3 platforms', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/lti/platforms',
        headers: { cookie: userCookie },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.platforms.some((p: any) => p.id === platformId)).toBe(true);
    });

    it('submits LTI 1.3 Advantage AGS Grade Passback to LMS LineItem URL', async () => {
      // Find one of the completed attempts
      const attempt = db.select().from(quizAttempts).where(eq(quizAttempts.quizId, testQuizId)).get();

      const res = await app.inject({
        method: 'POST',
        url: '/api/lti/grade-passback',
        headers: { cookie: userCookie },
        payload: {
          attemptId: attempt!.id,
          score: 85,
          maxScore: 100,
          lineItemUrl: 'https://canvas.harvard.edu/api/lti/courses/101/line_items/55',
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          comment: 'Perfect synchronization',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.scoreGiven).toBe(85);
      expect(body.data.scoreMaximum).toBe(100);
      expect(body.data.gradingProgress).toBe('FullyGraded');
      expect(body.data.passbackTimestamp).toBeDefined();
    });
  });
});
