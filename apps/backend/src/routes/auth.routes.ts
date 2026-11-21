import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { loginSchema, registerSchema } from '@quiz-forge/shared';
import { authService, AuthError } from '../services/auth.service';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '../plugins/auth.plugin';
import { generateCaptcha, verifyCaptcha } from '../utils/captcha';

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/auth/captcha
  app.get('/captcha', async (_request, reply) => {
    const captcha = generateCaptcha();
    return reply.status(200).send({
      success: true,
      data: captcha,
    });
  });

  // POST /api/auth/register
  app.post('/register', async (request, reply) => {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration input.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const { user, token } = await authService.register(parseResult.data);
      reply.setCookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
      return reply.status(201).send({
        success: true,
        data: { user },
      });
    } catch (err) {
      if (err instanceof AuthError) {
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

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login credentials format.',
          details: parseResult.error.format(),
        },
      });
    }

    const { captchaId, captchaAnswer } = parseResult.data;
    if (!verifyCaptcha(captchaId, captchaAnswer)) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'INVALID_CAPTCHA',
          message: 'Incorrect CAPTCHA answer. Please try again.',
        },
      });
    }

    try {
      const { user, token } = await authService.login(parseResult.data);
      reply.setCookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
      return reply.status(200).send({
        success: true,
        data: { user },
      });
    } catch (err) {
      if (err instanceof AuthError) {
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

  // POST /api/auth/logout
  app.post('/logout', async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
    });
    return reply.status(200).send({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  });

  // GET /api/auth/me (Protected)
  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const user = await authService.getUserProfile(request.user!.id);
        return reply.status(200).send({
          success: true,
          data: { user },
        });
      } catch (err) {
        if (err instanceof AuthError) {
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
