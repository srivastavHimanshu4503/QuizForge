import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { generateCodeQuizSchema, submitCodeAnswerSchema } from '@quiz-forge/shared';
import { codeQuizService, CodeQuizError } from '../services/code-quiz.service';
import { answerEvaluationService, AnswerEvaluationError } from '../services/answer-eval.service';

export const codeQuizRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All code quiz routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/code-quizzes/generate
  app.post('/generate', async (request, reply) => {
    const parseResult = generateCodeQuizSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid code quiz parameters.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const result = await codeQuizService.generateAndSaveCodeQuiz(
        request.user!.id,
        parseResult.data
      );
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof CodeQuizError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        });
      }
      throw err;
    }
  });

  // POST /api/code-quizzes/:quizId/restart or /api/code-quizzes/quizzes/:quizId/restart
  const handleRestart = async (
    request: import('fastify').FastifyRequest<{ Params: { quizId: string } }>,
    reply: import('fastify').FastifyReply
  ) => {
    try {
      const result = await codeQuizService.restartCodeQuiz(
        request.user!.id,
        request.params.quizId
      );
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof CodeQuizError) {
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
  };

  app.post<{ Params: { quizId: string } }>('/:quizId/restart', handleRestart);
  app.post<{ Params: { quizId: string } }>('/quizzes/:quizId/restart', handleRestart);

  // GET /api/code-quizzes/attempts/:attemptId
  app.get<{ Params: { attemptId: string } }>('/attempts/:attemptId', async (request, reply) => {
    try {
      const attempt = await codeQuizService.getActiveCodeAttempt(
        request.user!.id,
        request.params.attemptId
      );
      return reply.status(200).send({
        success: true,
        data: attempt,
      });
    } catch (err: unknown) {
      if (err instanceof CodeQuizError) {
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

  // POST /api/code-quizzes/attempts/:attemptId/answers (Submit & Auto-evaluate)
  app.post<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/answers',
    async (request, reply) => {
      const parseResult = submitCodeAnswerSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid answer format.',
            details: parseResult.error.format(),
          },
        });
      }

      try {
        const result = await answerEvaluationService.evaluateAndSaveAnswer(
          request.user!.id,
          request.params.attemptId,
          parseResult.data.questionId,
          parseResult.data.answer
        );
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        if (err instanceof AnswerEvaluationError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
            },
          });
        }
        throw err;
      }
    }
  );

  // POST /api/code-quizzes/attempts/:attemptId/submit (Finalize score)
  app.post<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/submit',
    async (request, reply) => {
      try {
        const result = await answerEvaluationService.submitCodeAttempt(
          request.user!.id,
          request.params.attemptId
        );
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        if (err instanceof AnswerEvaluationError) {
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

  // GET /api/code-quizzes/attempts/:attemptId/results
  app.get<{ Params: { attemptId: string } }>(
    '/attempts/:attemptId/results',
    async (request, reply) => {
      try {
        const result = await answerEvaluationService.getCompletedCodeResults(
          request.user!.id,
          request.params.attemptId
        );
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        if (err instanceof AnswerEvaluationError) {
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
};
