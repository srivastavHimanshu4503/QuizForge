import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { jobQueueService } from '../services/jobs/job-queue.service';

export const jobRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All job routes require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/jobs/:id (silent log level to prevent polling clutter)
  app.get<{ Params: { id: string } }>('/:id', { logLevel: 'silent' }, async (request, reply) => {
    const job = jobQueueService.getJob(request.params.id, request.user!.id);
    if (!job) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'JOB_NOT_FOUND',
          message: 'Job ID not found or unauthorized.',
        },
      });
    }

    return reply.status(200).send({
      success: true,
      data: job,
    });
  });
};
