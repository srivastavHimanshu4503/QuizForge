import { FastifyPluginAsync } from 'fastify';
import { scormService, ScormError } from '../services/scorm.service';
import { psychometricsService, PsychometricsError } from '../services/psychometrics.service';
import { ltiService, LtiError } from '../services/lti.service';
import { scormExportConfigSchema, ltiGradePassbackInputSchema } from '@quiz-forge/shared';

export const lmsRoutes: FastifyPluginAsync = async (app) => {
  // Authentication Guard for LMS & export features
  app.addHook('preHandler', app.authenticate);

  // GET /api/quizzes/:quizId/export/scorm
  app.get<{
    Params: { quizId: string };
    Querystring: {
      version?: string;
      passingScore?: string;
      masteryStatus?: string;
      timeLimitMinutes?: string;
      includeExplanations?: string;
      trackInteractions?: string;
    };
  }>('/quizzes/:quizId/export/scorm', async (request, reply) => {
    try {
      const { quizId } = request.params;
      const q = request.query;

      const config = scormExportConfigSchema.parse({
        scormVersion: q.version || '1.2',
        passingScorePercentage: q.passingScore ? Number(q.passingScore) : 70,
        masteryStatusOnPassing: q.masteryStatus || 'passed',
        timeLimitMinutes: q.timeLimitMinutes ? Number(q.timeLimitMinutes) : null,
        includeExplanations: q.includeExplanations !== 'false',
        trackInteractions: q.trackInteractions !== 'false',
      });

      const scormPackage = await scormService.exportScormPackage(quizId, config);

      reply.header('Content-Type', scormPackage.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${scormPackage.filename}"`);
      reply.header('Content-Length', scormPackage.buffer.length);

      return reply.send(scormPackage.buffer);
    } catch (err: unknown) {
      if (err instanceof ScormError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // GET /api/quizzes/:quizId/psychometrics
  app.get<{ Params: { quizId: string } }>(
    '/quizzes/:quizId/psychometrics',
    async (request, reply) => {
      try {
        const { quizId } = request.params;
        const data = await psychometricsService.getQuizPsychometrics(quizId);
        return reply.status(200).send({
          success: true,
          data,
        });
      } catch (err: unknown) {
        if (err instanceof PsychometricsError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/lti/platforms (Register Platform)
  app.post<{
    Body: {
      name: string;
      issuer: string;
      clientId: string;
      authEndpoint: string;
      tokenEndpoint: string;
      keySetEndpoint: string;
      deploymentId: string;
    };
  }>('/lti/platforms', async (request, reply) => {
    try {
      const platform = await ltiService.registerPlatform(request.body);
      return reply.status(201).send({
        success: true,
        data: platform,
      });
    } catch (err: unknown) {
      if (err instanceof LtiError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // GET /api/lti/platforms (List Platforms)
  app.get('/lti/platforms', async (_request, reply) => {
    const platforms = await ltiService.listPlatforms();
    return reply.status(200).send({
      success: true,
      data: { platforms },
    });
  });

  // POST /api/lti/grade-passback (LTI 1.3 Advantage AGS Grade Passback)
  app.post('/lti/grade-passback', async (request, reply) => {
    const parseResult = ltiGradePassbackInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid grade passback payload.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const result = await ltiService.submitGradePassback(parseResult.data, request.user!.id);
      return reply.status(200).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof LtiError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
};
