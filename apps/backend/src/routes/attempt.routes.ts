import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { saveAnswerSchema } from '@quiz-forge/shared';
import { attemptService, AttemptError } from '../services/attempt.service';

export const attemptRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All attempt routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/attempts/:attemptId
  app.get<{ Params: { attemptId: string } }>('/:attemptId', async (request, reply) => {
    try {
      const activeAttempt = await attemptService.getActiveAttempt(
        request.user!.id,
        request.params.attemptId
      );
      return reply.status(200).send({
        success: true,
        data: activeAttempt,
      });
    } catch (err: unknown) {
      if (err instanceof AttemptError) {
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

  // PATCH /api/attempts/:attemptId/answers
  app.patch<{ Params: { attemptId: string } }>('/:attemptId/answers', async (request, reply) => {
    const parseResult = saveAnswerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid answer payload.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const result = await attemptService.saveAnswer(
        request.user!.id,
        request.params.attemptId,
        parseResult.data.questionId,
        parseResult.data.selectedChoiceId
      );
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof AttemptError) {
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

  // POST /api/attempts/:attemptId/submit
  app.post<{ Params: { attemptId: string } }>('/:attemptId/submit', async (request, reply) => {
    try {
      const result = await attemptService.submitAttempt(
        request.user!.id,
        request.params.attemptId
      );
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof AttemptError) {
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

  // GET /api/attempts/:attemptId/results
  app.get<{ Params: { attemptId: string } }>('/:attemptId/results', async (request, reply) => {
    try {
      const result = await attemptService.getCompletedResults(
        request.user!.id,
        request.params.attemptId
      );
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof AttemptError) {
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
