import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { generateUrlQuizOptionsSchema } from '@quiz-forge/shared';
import { urlQuizService } from '../services/url-quiz.service';
import { SSRFError } from '../services/ingestion/ssrf-protection.service';
import { URLIngestionError } from '../services/ingestion/url.adapter';

export const urlQuizRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All URL quiz generation requires authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/quizzes/generate/url
  app.post('/generate/url', async (request, reply) => {
    const parseResult = generateUrlQuizOptionsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid URL quiz generation options.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const result = await urlQuizService.generateQuizFromUrl(
        request.user!.id,
        parseResult.data
      );

      return reply.status(202).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof SSRFError || err instanceof URLIngestionError) {
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
