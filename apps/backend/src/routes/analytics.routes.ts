import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { analyticsService, AnalyticsError } from '../services/analytics.service';
import { generateRemedialQuizSchema } from '@quiz-forge/shared';

export const analyticsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All analytics routes require authentication
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /api/analytics/mastery-heatmap
   * Returns the student's personal topic mastery matrix, knowledge gaps,
   * difficulty breakdown, and recent activity.
   */
  app.get('/mastery-heatmap', async (request, reply) => {
    try {
      const data = await analyticsService.getStudentHeatmap(request.user!.id);
      return reply.status(200).send({
        success: true,
        data,
      });
    } catch (err: unknown) {
      if (err instanceof AnalyticsError) {
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

  /**
   * GET /api/analytics/classroom/:classroomId/heatmap
   * Returns classroom-wide aggregate mastery matrix and struggling topics for teacher inspection.
   */
  app.get<{ Params: { classroomId: string } }>(
    '/classroom/:classroomId/heatmap',
    async (request, reply) => {
      try {
        const data = await analyticsService.getClassroomHeatmap(
          request.user!.id,
          request.params.classroomId
        );
        return reply.status(200).send({
          success: true,
          data,
        });
      } catch (err: unknown) {
        if (err instanceof AnalyticsError) {
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
    }
  );

  /**
   * POST /api/analytics/remedial-quiz
   * Generates a targeted remedial practice quiz focusing on the student's identified gaps.
   */
  app.post<{
    Body: {
      targetTopic?: string;
      questionCount?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
      provider?: string;
    };
  }>('/remedial-quiz', async (request, reply) => {
    try {
      const parsed = generateRemedialQuizSchema.parse(request.body || {});
      const data = await analyticsService.generateRemedialQuiz(request.user!.id, parsed);
      return reply.status(201).send({
        success: true,
        data,
      });
    } catch (err: unknown) {
      if (err instanceof AnalyticsError) {
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
