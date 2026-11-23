import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  passkeyRegistrationVerifyInputSchema,
  passkeyAuthenticationVerifyInputSchema,
  renamePasskeyInputSchema,
} from '@quiz-forge/shared';
import { passkeyService, PasskeyError } from '../services/passkey.service';
import { AUTH_COOKIE_NAME, COOKIE_OPTIONS } from '../plugins/auth.plugin';
import { env } from '../config/env';

function extractClientWebAuthnContext(request: { headers: Record<string, string | string[] | undefined> }) {
  const originHeader = typeof request.headers.origin === 'string'
    ? request.headers.origin
    : (typeof request.headers.referer === 'string' ? new URL(request.headers.referer).origin : undefined);

  let rpId: string | undefined = undefined;
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      rpId = parsed.hostname;
    } catch {
      // ignore
    }
  }
  return { origin: originHeader, rpId };
}

export const passkeyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // 1. Generate Registration Options (Authenticated)
  app.post(
    '/register-options',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const { rpId } = extractClientWebAuthnContext(request);
        const options = await passkeyService.generateRegistrationOptions(request.user!.id, rpId);
        return reply.status(200).send({
          success: true,
          data: options,
        });
      } catch (err: unknown) {
        if (err instanceof PasskeyError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // 2. Verify Registration Attestation (Authenticated)
  app.post(
    '/register-verify',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parseResult = passkeyRegistrationVerifyInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid passkey registration payload',
            details: parseResult.error.format(),
          },
        });
      }

      try {
        const { origin, rpId } = extractClientWebAuthnContext(request);
        const passkey = await passkeyService.verifyRegistration(
          request.user!.id,
          parseResult.data,
          origin,
          rpId
        );
        return reply.status(201).send({
          success: true,
          data: passkey,
        });
      } catch (err: unknown) {
        if (err instanceof PasskeyError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // 3. Generate Authentication Assertion Options (Public)
  app.post('/login-options', async (request, reply) => {
    try {
      const { rpId } = extractClientWebAuthnContext(request);
      const options = await passkeyService.generateAuthenticationOptions(rpId);
      return reply.status(200).send({
        success: true,
        data: options,
      });
    } catch (err: unknown) {
      if (err instanceof PasskeyError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // 4. Verify Authentication Assertion (Public, sets auth cookie)
  app.post('/login-verify', async (request, reply) => {
    const parseResult = passkeyAuthenticationVerifyInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid passkey authentication payload',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const { origin, rpId } = extractClientWebAuthnContext(request);
      const { user, token } = await passkeyService.verifyAuthentication(
        parseResult.data,
        origin,
        rpId
      );

      // Set secure HTTP-only authentication cookie
      reply.setCookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);

      return reply.status(200).send({
        success: true,
        data: {
          user,
          token,
        },
      });
    } catch (err: unknown) {
      if (err instanceof PasskeyError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // 5. List User Passkeys (Authenticated)
  app.get(
    '/credentials',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        const credentials = await passkeyService.listUserPasskeys(request.user!.id);
        return reply.status(200).send({
          success: true,
          data: {
            rpId: env.WEBAUTHN_RP_ID,
            credentials,
          },
        });
      } catch (err: unknown) {
        if (err instanceof PasskeyError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // 6. Rename User Passkey (Authenticated)
  app.put<{ Params: { id: string } }>(
    '/credentials/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const parseResult = renamePasskeyInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid passkey name',
            details: parseResult.error.format(),
          },
        });
      }

      try {
        const updated = await passkeyService.renamePasskey(
          request.user!.id,
          request.params.id,
          parseResult.data.name
        );
        return reply.status(200).send({
          success: true,
          data: updated,
        });
      } catch (err: unknown) {
        if (err instanceof PasskeyError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // 7. Delete User Passkey (Authenticated)
  app.delete<{ Params: { id: string } }>(
    '/credentials/:id',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      try {
        await passkeyService.deletePasskey(request.user!.id, request.params.id);
        return reply.status(200).send({
          success: true,
          data: { deleted: true },
        });
      } catch (err: unknown) {
        if (err instanceof PasskeyError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );
};
