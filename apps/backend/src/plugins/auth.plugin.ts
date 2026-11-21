import fp from 'fastify-plugin';
import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { verifyToken } from '../utils/token';
import { env } from '../config/env';

export const AUTH_COOKIE_NAME = 'quizforge_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: 'student' | 'teacher' | 'admin';
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      allowedRoles: ('student' | 'teacher' | 'admin')[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPluginCallback: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.decorateRequest('user', undefined);

  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // 1. Try to get token from cookie
      let token = request.cookies[AUTH_COOKIE_NAME];

      // 2. Fallback: Authorization header (Bearer token)
      if (!token && request.headers.authorization) {
        const parts = request.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0]?.toLowerCase() === 'bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required. Please log in.',
          },
        });
        return;
      }

      const payload = await verifyToken(token);
      if (!payload) {
        reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired session. Please log in again.',
          },
        });
        return;
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        displayName: payload.displayName,
        role: payload.role,
      };
    }
  );

  app.decorate(
    'requireRole',
    (allowedRoles: ('student' | 'teacher' | 'admin')[]) => {
      return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!request.user) {
          reply.status(401).send({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required. Please log in.',
            },
          });
          return;
        }

        if (!allowedRoles.includes(request.user.role)) {
          reply.status(403).send({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}.`,
            },
          });
          return;
        }
      };
    }
  );
};

export const authPlugin = fp(authPluginCallback, {
  name: 'auth-plugin',
  dependencies: ['@fastify/cookie'],
});
