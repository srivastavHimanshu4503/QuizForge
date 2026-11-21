import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { attemptService, AttemptError } from '../services/attempt.service';

export const historyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All history routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/history?page=1&limit=10&type=all|mcq|code
  app.get<{ Querystring: { page?: string; limit?: string; type?: 'all' | 'mcq' | 'code' } }>('/', async (request, reply) => {
    const page = request.query.page ? parseInt(request.query.page, 10) : 1;
    const limit = request.query.limit ? parseInt(request.query.limit, 10) : 10;
    const filterType = request.query.type || 'all';

    try {
      const history = await attemptService.getUserHistory(
        request.user!.id,
        isNaN(page) ? 1 : page,
        isNaN(limit) ? 10 : limit,
        filterType
      );
      return reply.status(200).send({
        success: true,
        data: history,
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
