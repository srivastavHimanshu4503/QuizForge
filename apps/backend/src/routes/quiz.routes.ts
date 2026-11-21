import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { generateQuizSchema } from '@quiz-forge/shared';
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
};
