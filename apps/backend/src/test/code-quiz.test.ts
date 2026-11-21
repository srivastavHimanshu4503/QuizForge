import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';
import { gitHubService, RepoContext } from '../services/github.service';
import { llmRegistry } from '../services/llm/provider-registry';
import { MockLLMProvider } from '../services/llm/mock-llm.provider';

describe('Code Review Quiz & Evaluation Pipeline', () => {
  let app: FastifyInstance;
  let authCookie = '';
  const mockLLM = new MockLLMProvider('mock');

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Register test mock provider
    llmRegistry.register(mockLLM);

    // Register a test user and obtain auth cookie
    const email = `codetester_${Date.now()}@quizforge.com`;
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'Password123!',
        displayName: 'Code Reviewer',
      },
    });

    const cookie = regRes.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    authCookie = `${cookie?.name}=${cookie?.value}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates a code quiz from a GitHub repository via POST /api/code-quizzes/generate', async () => {
    // Mock GitHub Service to return a controlled repo context
    const mockRepoContext: RepoContext = {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      files: [
        {
          path: 'src/server.ts',
          content: '// Main entrypoint\nconst port = 4000;\nconsole.log(port);',
          language: 'typescript',
          sizeBytes: 60,
          lineCount: 3,
          hasComments: true,
          priorityScore: 12,
        },
      ],
      totalRepoFiles: 1,
      selectedFilesCount: 1,
      truncated: false,
      repoUrl: 'https://github.com/test-owner/test-repo',
    };

    vi.spyOn(gitHubService, 'fetchRepoContext').mockResolvedValue(mockRepoContext);

    // Mock LLM generation output
    mockLLM.setMockResponse(
      JSON.stringify({
        questions: [
          {
            question_id: 'cq_01',
            question: "Why is the comment '// Main entrypoint' placed here and what is the consequence of changing the port?",
            code_snippet: {
              file_path: 'src/server.ts',
              start_line: 1,
              end_line: 3,
              code: '// Main entrypoint\nconst port = 4000;\nconsole.log(port);',
            },
            difficulty: 'medium',
            expected_concepts: ['port configuration', 'server binding', 'entry point documentation'],
          },
        ],
      })
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/code-quizzes/generate',
      headers: { cookie: authCookie },
      payload: {
        repoUrl: 'https://github.com/test-owner/test-repo',
        questionCount: 3,
        llmProvider: 'mock',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.codeQuizId).toBeDefined();
    expect(body.data.attemptId).toBeDefined();
    expect(body.data.totalQuestions).toBe(1);

    const { attemptId, codeQuizId } = body.data;

    // 2. Query active code attempt
    const attemptRes = await app.inject({
      method: 'GET',
      url: `/api/code-quizzes/attempts/${attemptId}`,
      headers: { cookie: authCookie },
    });

    expect(attemptRes.statusCode).toBe(200);
    const attemptBody = JSON.parse(attemptRes.payload);
    expect(attemptBody.success).toBe(true);
    expect(attemptBody.data.questions.length).toBe(1);

    const question = attemptBody.data.questions[0];
    expect(question.codeSnippetContent).toContain('Main entrypoint');
    expect(question.userAnswer).toBeNull();

    // 3. Submit and evaluate an answer
    mockLLM.setMockResponse(
      JSON.stringify({
        score: 9.0,
        accuracy_score: 3.5,
        depth_score: 2.8,
        completeness_score: 2.7,
        feedback: 'Excellent answer explaining port binding and developer intent in comments.',
        key_concepts_identified: ['port configuration', 'server binding'],
        key_concepts_missed: [],
      })
    );

    const answerRes = await app.inject({
      method: 'POST',
      url: `/api/code-quizzes/attempts/${attemptId}/answers`,
      headers: { cookie: authCookie },
      payload: {
        questionId: question.id,
        answer: 'The comment documents the service initialization. The port constant binds the HTTP listener to port 4000.',
      },
    });

    expect(answerRes.statusCode).toBe(200);
    const answerBody = JSON.parse(answerRes.payload);
    expect(answerBody.success).toBe(true);
    expect(answerBody.data.evaluation.score).toBe(9.0);
    expect(answerBody.data.evaluation.feedback).toBeDefined();

    // 4. Submit and finalize the code attempt
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/code-quizzes/attempts/${attemptId}/submit`,
      headers: { cookie: authCookie },
    });

    expect(submitRes.statusCode).toBe(200);
    const submitBody = JSON.parse(submitRes.payload);
    expect(submitBody.success).toBe(true);
    expect(submitBody.data.status).toBe('completed');
    expect(submitBody.data.totalScore).toBe(9.0);
    expect(submitBody.data.accuracyPercentage).toBeGreaterThanOrEqual(90);

    // 5. Query results
    const resultsRes = await app.inject({
      method: 'GET',
      url: `/api/code-quizzes/attempts/${attemptId}/results`,
      headers: { cookie: authCookie },
    });

    expect(resultsRes.statusCode).toBe(200);
    const resultsBody = JSON.parse(resultsRes.payload);
    expect(resultsBody.success).toBe(true);
    expect(resultsBody.data.reviews.length).toBe(1);
    expect(resultsBody.data.reviews[0].score).toBe(9.0);

    // 6. Query history - verify code quiz attempt appears in history
    const historyRes = await app.inject({
      method: 'GET',
      url: '/api/history?page=1&limit=10',
      headers: { cookie: authCookie },
    });

    expect(historyRes.statusCode).toBe(200);
    const historyBody = JSON.parse(historyRes.payload);
    expect(historyBody.success).toBe(true);
    expect(historyBody.data.total).toBe(1);
    expect(historyBody.data.items[0].type).toBe('code_review');
    expect(historyBody.data.items[0].attemptId).toBe(attemptId);
    expect(historyBody.data.items[0].quizId).toBe(codeQuizId);
    expect(historyBody.data.items[0].topic).toBe('test-owner/test-repo');
    expect(historyBody.data.items[0].score).toBe(9.0);

    // 7. Verify filtering: type=code vs type=mcq
    const codeHistoryRes = await app.inject({
      method: 'GET',
      url: '/api/history?type=code',
      headers: { cookie: authCookie },
    });
    expect(codeHistoryRes.statusCode).toBe(200);
    expect(JSON.parse(codeHistoryRes.payload).data.total).toBe(1);

    const mcqHistoryRes = await app.inject({
      method: 'GET',
      url: '/api/history?type=mcq',
      headers: { cookie: authCookie },
    });
    expect(mcqHistoryRes.statusCode).toBe(200);
    expect(JSON.parse(mcqHistoryRes.payload).data.total).toBe(0);

    // 8. Retake the code quiz via POST /api/code-quizzes/:quizId/restart (Zero AI calls)
    const restartRes = await app.inject({
      method: 'POST',
      url: `/api/code-quizzes/${codeQuizId}/restart`,
      headers: { cookie: authCookie },
    });

    expect(restartRes.statusCode).toBe(201);
    const restartBody = JSON.parse(restartRes.payload);
    expect(restartBody.success).toBe(true);
    expect(restartBody.data.codeQuizId).toBe(codeQuizId);
    expect(restartBody.data.status).toBe('in_progress');
    expect(restartBody.data.attemptId).not.toBe(attemptId);

    // Verify the new attempt is accessible
    const newAttemptRes = await app.inject({
      method: 'GET',
      url: `/api/code-quizzes/attempts/${restartBody.data.attemptId}`,
      headers: { cookie: authCookie },
    });
    expect(newAttemptRes.statusCode).toBe(200);
    const newAttemptBody = JSON.parse(newAttemptRes.payload);
    expect(newAttemptBody.data.status).toBe('in_progress');
    expect(newAttemptBody.data.questions.length).toBe(1);
  });

  it('rejects unauthenticated requests to code quiz endpoints with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/code-quizzes/generate',
      payload: {
        repoUrl: 'https://github.com/test-owner/test-repo',
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
