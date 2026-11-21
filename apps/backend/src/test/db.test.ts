import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';
import * as schema from '../db/schema/index';
import { users, quizzes, questions, choices, quizAttempts, attemptAnswers } from '../db/schema/index';
import { eq } from 'drizzle-orm';

describe('SQLite Database & Relational Schema Integrity', () => {
  const testDbFile = path.resolve(process.cwd(), 'test-integrity.db');
  let testSqlite: Database.Database;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(() => {
    // Clean up any old test DB file
    if (fs.existsSync(testDbFile)) {
      fs.unlinkSync(testDbFile);
    }

    testSqlite = new Database(testDbFile);
    testSqlite.pragma('journal_mode = WAL');
    testSqlite.pragma('foreign_keys = ON');

    testDb = drizzle(testSqlite, { schema });

    // Apply migrations
    const migrationsFolder = path.resolve(process.cwd(), 'src/db/migrations');
    migrate(testDb, { migrationsFolder });
  });

  afterAll(() => {
    testSqlite.close();
    // Clean up test DB and associated WAL files
    if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
    if (fs.existsSync(`${testDbFile}-wal`)) fs.unlinkSync(`${testDbFile}-wal`);
    if (fs.existsSync(`${testDbFile}-shm`)) fs.unlinkSync(`${testDbFile}-shm`);
  });

  it('verifies SQLite WAL (Write-Ahead Logging) mode is active', () => {
    const row = testSqlite.pragma('journal_mode', { simple: true });
    expect(row).toBe('wal');
  });

  it('verifies SQLite foreign-key constraints are strictly enabled', () => {
    const fkEnabled = testSqlite.pragma('foreign_keys', { simple: true });
    expect(fkEnabled).toBe(1);
  });

  it('rejects child record insertions with non-existent foreign keys', () => {
    const nonExistentUserId = crypto.randomUUID();

    // Attempting to insert a quiz for a non-existent user must throw SQLITE_CONSTRAINT_FOREIGNKEY
    expect(() => {
      testDb
        .insert(quizzes)
        .values({
          userId: nonExistentUserId,
          topic: 'TypeScript Fundamentals',
          difficulty: 'medium',
          questionCount: 5,
        })
        .run();
    }).toThrow(/FOREIGN KEY/i);
  });

  it('enforces unique email constraint on users table', () => {
    const email = 'unique.test@quizforge.com';

    testDb
      .insert(users)
      .values({
        email,
        passwordHash: 'hashed_password_123',
        displayName: 'Original User',
      })
      .run();

    // Inserting a duplicate email must throw SQLITE_CONSTRAINT_UNIQUE
    expect(() => {
      testDb
        .insert(users)
        .values({
          email,
          passwordHash: 'another_password',
          displayName: 'Duplicate User',
        })
        .run();
    }).toThrow(/UNIQUE constraint failed/i);
  });

  it('enforces unique question order per quiz', () => {
    // Insert valid user and quiz
    const [user] = testDb
      .insert(users)
      .values({
        email: 'quizowner@quizforge.com',
        passwordHash: 'hash',
        displayName: 'Quiz Owner',
      })
      .returning()
      .all();

    const [quiz] = testDb
      .insert(quizzes)
      .values({
        userId: user!.id,
        topic: 'Data Structures',
        difficulty: 'hard',
        questionCount: 2,
      })
      .returning()
      .all();

    // Insert question 1
    testDb
      .insert(questions)
      .values({
        quizId: quiz!.id,
        questionOrder: 1,
        questionText: 'What is a binary tree?',
        correctChoiceId: 'A',
        explanation: 'A tree data structure where each node has at most two children.',
      })
      .run();

    // Inserting another question with the same order (1) on the same quiz must fail
    expect(() => {
      testDb
        .insert(questions)
        .values({
          quizId: quiz!.id,
          questionOrder: 1,
          questionText: 'Duplicate order question',
          correctChoiceId: 'B',
          explanation: 'Should fail',
        })
        .run();
    }).toThrow(/UNIQUE constraint failed/i);
  });

  it('cascades deletion through users -> quizzes -> questions -> choices -> attempts -> answers', () => {
    // 1. Create User
    const [cascadeUser] = testDb
      .insert(users)
      .values({
        email: 'cascade.test@quizforge.com',
        passwordHash: 'hash',
        displayName: 'Cascade Test User',
      })
      .returning()
      .all();

    const userId = cascadeUser!.id;

    // 2. Create Quiz
    const [cascadeQuiz] = testDb
      .insert(quizzes)
      .values({
        userId,
        topic: 'Cascade Verification',
        difficulty: 'easy',
        questionCount: 1,
      })
      .returning()
      .all();

    const quizId = cascadeQuiz!.id;

    // 3. Create Question
    const [cascadeQuestion] = testDb
      .insert(questions)
      .values({
        quizId,
        questionOrder: 1,
        questionText: 'Will cascade work?',
        correctChoiceId: 'A',
        explanation: 'Yes, ON DELETE CASCADE will clean up child records.',
      })
      .returning()
      .all();

    const questionId = cascadeQuestion!.id;

    // 4. Create Choices
    testDb
      .insert(choices)
      .values([
        { questionId, choiceId: 'A', optionText: 'Yes' },
        { questionId, choiceId: 'B', optionText: 'No' },
        { questionId, choiceId: 'C', optionText: 'Maybe' },
        { questionId, choiceId: 'D', optionText: 'Unknown' },
      ])
      .run();

    // 5. Create Attempt
    const [attempt] = testDb
      .insert(quizAttempts)
      .values({
        quizId,
        userId,
        attemptNumber: 1,
        status: 'in_progress',
        shuffledOrder: [questionId],
        totalQuestions: 1,
      })
      .returning()
      .all();

    const attemptId = attempt!.id;

    // 6. Create Answer
    testDb
      .insert(attemptAnswers)
      .values({
        attemptId,
        questionId,
        selectedChoiceId: 'A',
      })
      .run();

    // Verify all records exist prior to deletion
    expect(testDb.select().from(quizzes).where(eq(quizzes.id, quizId)).all()).toHaveLength(1);
    expect(testDb.select().from(questions).where(eq(questions.id, questionId)).all()).toHaveLength(1);
    expect(testDb.select().from(choices).where(eq(choices.questionId, questionId)).all()).toHaveLength(4);
    expect(testDb.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).all()).toHaveLength(1);
    expect(testDb.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)).all()).toHaveLength(1);

    // Act: Delete the root user
    testDb.delete(users).where(eq(users.id, userId)).run();

    // Assert: Everything associated with this user should be automatically cascade-deleted
    expect(testDb.select().from(users).where(eq(users.id, userId)).all()).toHaveLength(0);
    expect(testDb.select().from(quizzes).where(eq(quizzes.id, quizId)).all()).toHaveLength(0);
    expect(testDb.select().from(questions).where(eq(questions.id, questionId)).all()).toHaveLength(0);
    expect(testDb.select().from(choices).where(eq(choices.questionId, questionId)).all()).toHaveLength(0);
    expect(testDb.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).all()).toHaveLength(0);
    expect(testDb.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)).all()).toHaveLength(0);
  });
});
