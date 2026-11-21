import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { generateQuizSchema, updateQuizStudioSchema } from '@quiz-forge/shared';
import { quizService, QuizError } from '../services/quiz.service';

export const quizRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All quiz routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/quizzes/generate
  app.post('/generate', async (request, reply) => {
    const parseResult = generateQuizSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid quiz generation input.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const result = await quizService.generateAndSaveQuiz(
        request.user!.id,
        parseResult.data
      );
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // GET /api/quizzes/:quizId
  app.get<{ Params: { quizId: string } }>('/:quizId', async (request, reply) => {
    try {
      const quiz = await quizService.getQuizMetadata(
        request.user!.id,
        request.params.quizId
      );
      return reply.status(200).send({
        success: true,
        data: { quiz },
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // POST /api/quizzes/:quizId/restart
  app.post<{ Params: { quizId: string } }>('/:quizId/restart', async (request, reply) => {
    try {
      const result = await quizService.restartQuiz(
        request.user!.id,
        request.params.quizId
      );
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // GET /api/quizzes/:quizId/studio
  app.get<{ Params: { quizId: string } }>('/:quizId/studio', async (request, reply) => {
    try {
      const payload = await quizService.getQuizStudioPayload(
        request.user!.id,
        request.params.quizId
      );
      return reply.status(200).send({
        success: true,
        data: payload,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // PUT /api/quizzes/:quizId/studio
  app.put<{ Params: { quizId: string } }>('/:quizId/studio', async (request, reply) => {
    const parseResult = updateQuizStudioSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid quiz studio update data.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const updated = await quizService.updateQuizStudio(
        request.user!.id,
        request.params.quizId,
        parseResult.data
      );
      return reply.status(200).send({
        success: true,
        data: updated,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // POST /api/quizzes/:quizId/publish
  app.post<{ Params: { quizId: string } }>('/:quizId/publish', async (request, reply) => {
    try {
      const result = await quizService.publishQuiz(
        request.user!.id,
        request.params.quizId
      );
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // POST /api/quizzes/:quizId/unpublish
  app.post<{ Params: { quizId: string } }>('/:quizId/unpublish', async (request, reply) => {
    try {
      const result = await quizService.unpublishQuiz(
        request.user!.id,
        request.params.quizId
      );
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // GET /api/quizzes/share/:shareCode
  app.get<{ Params: { shareCode: string } }>('/share/:shareCode', async (request, reply) => {
    try {
      const result = await quizService.getPublicQuizByShareCode(request.params.shareCode);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });

  // POST /api/quizzes/share/:shareCode/start
  app.post<{ Params: { shareCode: string } }>('/share/:shareCode/start', async (request, reply) => {
    try {
      const result = await quizService.startPublicQuizAttempt(
        request.user!.id,
        request.params.shareCode
      );
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof QuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });
};
