import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { env } from './config/env';
import { sqlite } from './db/index';
import { authPlugin } from './plugins/auth.plugin';
import { authRoutes } from './routes/auth.routes';
import { quizRoutes } from './routes/quiz.routes';
import { pdfQuizRoutes } from './routes/pdf-quiz.routes';
import { urlQuizRoutes } from './routes/url-quiz.routes';
import { imageQuizRoutes } from './routes/image-quiz.routes';
import { attemptRoutes } from './routes/attempt.routes';
import { historyRoutes } from './routes/history.routes';
import { llmRoutes } from './routes/llm.routes';
import { codeQuizRoutes } from './routes/code-quiz.routes';
import { classroomRoutes } from './routes/classroom.routes';
import { jobRoutes } from './routes/job.routes';
import { certificateRoutes } from './routes/certificate.routes';
import { arenaRoutes } from './routes/arena.routes';
import { flashcardsRoutes } from './routes/flashcards.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  // Security Headers (OWASP recommendations)
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  });

  // Rate Limiting (Abuse prevention)
  await app.register(rateLimit, {
    max: env.NODE_ENV === 'test' ? 1000 : 120,
    timeWindow: '1 minute',
    allowList: (req) => req.url === '/api/health',
  });

  // CORS Configuration
  await app.register(cors, {
    origin: [env.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  });

  // Cookie Parser
  await app.register(cookie, {
    secret: env.JWT_SECRET,
  });

  // Multipart Parser (15 MB file cap)
  await app.register(multipart, {
    limits: {
      fileSize: 15 * 1024 * 1024,
      files: 1,
    },
  });

  // WebSocket Plugin
  await app.register(websocket);

  // Gracefully handle empty JSON body without error
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string, done) => {
    if (!body || body.trim() === '') {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Invalid JSON');
      (error as Error & { statusCode?: number }).statusCode = 400;
      done(error, undefined);
    }
  });

  // Authentication Plugin
  await app.register(authPlugin);

  // Authentication Routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  // Quiz Engine Routes
  await app.register(quizRoutes, { prefix: '/api/quizzes' });
  await app.register(pdfQuizRoutes, { prefix: '/api/quizzes' });
  await app.register(urlQuizRoutes, { prefix: '/api/quizzes' });
  await app.register(imageQuizRoutes, { prefix: '/api/quizzes' });
  await app.register(attemptRoutes, { prefix: '/api/attempts' });
  await app.register(historyRoutes, { prefix: '/api/history' });
  await app.register(llmRoutes, { prefix: '/api/llm' });
  await app.register(codeQuizRoutes, { prefix: '/api/code-quizzes' });
  await app.register(classroomRoutes, { prefix: '/api/classrooms' });
  await app.register(jobRoutes, { prefix: '/api/jobs' });
  await app.register(certificateRoutes, { prefix: '/api/certificates' });
  await app.register(arenaRoutes, { prefix: '/api/arena' });
  await app.register(flashcardsRoutes, { prefix: '/api/flashcards' });

  // Global Error Handler
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    request.log.error(error);
    const statusCode = 'statusCode' in error && error.statusCode ? error.statusCode : 500;
    const message = statusCode === 500 && env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

    reply.status(statusCode).send({
      success: false,
      error: {
        code: ('code' in error && error.code) ? String(error.code) : 'INTERNAL_ERROR',
        message,
      },
    });
  });

  // Health Check Endpoint (silent log level to prevent terminal clutter)
  app.get('/api/health', { logLevel: 'silent' }, async () => {
    let dbStatus = 'healthy';
    let dbError: string | null = null;

    try {
      const result = sqlite.prepare('SELECT 1 as test').get() as { test: number };
      if (result.test !== 1) {
        dbStatus = 'degraded';
      }
    } catch (err) {
      dbStatus = 'unhealthy';
      dbError = err instanceof Error ? err.message : 'Database check failed';
    }

    return {
      success: true,
      data: {
        status: dbStatus === 'healthy' ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database: {
          status: dbStatus,
          driver: 'better-sqlite3',
          wal: true,
          ...(dbError ? { error: dbError } : {}),
        },
      },
    };
  });

  return app;
}
