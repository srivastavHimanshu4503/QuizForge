import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import {
  createArenaSessionSchema,
  joinArenaSchema,
  submitArenaAnswerSchema,
  ArenaWsClientMessage,
  ArenaWsServerMessage,
} from '@quiz-forge/shared';
import { arenaService, ArenaError } from '../services/arena.service';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';
import { verifyToken } from '../utils/token';

async function getOptionalUserId(request: any): Promise<string | undefined> {
  const token =
    request.cookies?.[AUTH_COOKIE_NAME] ||
    (typeof request.headers?.authorization === 'string' &&
    request.headers.authorization.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : undefined);

  if (!token) return undefined;
  try {
    const payload = await verifyToken(token);
    return payload?.sub;
  } catch {
    return undefined;
  }
}

// In-Memory Real-Time Room Registry
const roomSockets = new Map<string, Set<WebSocket>>();

export function broadcastToRoom(pin: string, message: ArenaWsServerMessage) {
  const sockets = roomSockets.get(pin.trim());
  if (!sockets) return;
  const payload = JSON.stringify(message);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

export const arenaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // WebSocket endpoint for real-time live events
  app.get('/ws', { websocket: true }, (socket: WebSocket /*, req */) => {
    let currentPin: string | null = null;

    socket.on('message', async (rawMsg: string | Buffer) => {
      try {
        const text = rawMsg.toString();
        const msg = JSON.parse(text) as ArenaWsClientMessage;

        if (msg.type === 'PING') {
          socket.send(JSON.stringify({ type: 'PONG' }));
          return;
        }

        if (msg.type === 'JOIN' || msg.type === 'HOST_CONNECT') {
          const pin = msg.pin.trim();
          currentPin = pin;
          if (!roomSockets.has(pin)) {
            roomSockets.set(pin, new Set());
          }
          roomSockets.get(pin)!.add(socket);

          // Send current state immediately
          const state = await arenaService.getArenaState(pin);
          socket.send(JSON.stringify({ type: 'STATE_UPDATE', state }));
          return;
        }

        if (msg.type === 'HOST_START_GAME') {
          const pin = msg.pin.trim();
          const state = await arenaService.getArenaState(pin);
          await arenaService.startGame(state.hostId, pin);
          const updatedState = await arenaService.getArenaState(pin);
          broadcastToRoom(pin, { type: 'STATE_UPDATE', state: updatedState });
          return;
        }

        if (msg.type === 'SUBMIT_ANSWER') {
          const res = await arenaService.submitAnswer(
            msg.pin.trim(),
            msg.participantId,
            msg.questionId,
            msg.selectedChoiceId,
            msg.responseTimeMs
          );

          broadcastToRoom(msg.pin.trim(), {
            type: 'PLAYER_ANSWERED',
            participantId: msg.participantId,
            totalAnswered: res.totalAnswers,
            totalPlayers: res.totalPlayers,
          });

          // If all participants have answered, automatically end question early!
          if (res.allAnswered) {
            const state = await arenaService.getArenaState(msg.pin.trim());
            const endState = await arenaService.endQuestion(state.hostId, msg.pin.trim());
            broadcastToRoom(msg.pin.trim(), { type: 'STATE_UPDATE', state: endState });
          }
          return;
        }

        if (msg.type === 'HOST_END_QUESTION') {
          const state = await arenaService.getArenaState(msg.pin.trim());
          const endState = await arenaService.endQuestion(state.hostId, msg.pin.trim());
          broadcastToRoom(msg.pin.trim(), { type: 'STATE_UPDATE', state: endState });
          return;
        }

        if (msg.type === 'HOST_NEXT_QUESTION') {
          const state = await arenaService.getArenaState(msg.pin.trim());
          const nextState = await arenaService.nextQuestionOrFinish(state.hostId, msg.pin.trim());
          broadcastToRoom(msg.pin.trim(), { type: 'STATE_UPDATE', state: nextState });
          return;
        }
      } catch (err: any) {
        socket.send(
          JSON.stringify({
            type: 'ERROR',
            message: err.message || 'Error processing arena message',
            code: err.code || 'ARENA_ERROR',
          })
        );
      }
    });

    socket.on('close', () => {
      if (currentPin && roomSockets.has(currentPin)) {
        roomSockets.get(currentPin)!.delete(socket);
        if (roomSockets.get(currentPin)!.size === 0) {
          roomSockets.delete(currentPin);
        }
      }
    });
  });

  // REST Endpoints
  // 1. Host creates a session (Authenticated)
  app.post('/sessions', { preHandler: app.authenticate }, async (request, reply) => {
    try {
      const parsed = createArenaSessionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
        });
      }

      const result = await arenaService.createSession(
        request.user!.id,
        parsed.data.quizId,
        parsed.data.timePerQuestionSeconds
      );

      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof ArenaError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // 2. Player joins an arena (Public / Authenticated)
  app.post('/join', async (request, reply) => {
    try {
      const parsed = joinArenaSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
        });
      }

      // Check optional user auth if logged in
      const userId = await getOptionalUserId(request);

      const { session, participant } = await arenaService.joinSession(
        parsed.data.pin,
        parsed.data.nickname,
        userId
      );

      // Broadcast join event
      const state = await arenaService.getArenaState(session.pin);
      broadcastToRoom(session.pin, {
        type: 'PLAYER_JOINED',
        participant: {
          id: participant.id,
          nickname: participant.nickname,
          score: participant.score,
          streak: participant.streak,
        },
        totalPlayers: state.participants.length,
      });

      return reply.status(200).send({
        success: true,
        data: {
          sessionId: session.id,
          pin: session.pin,
          participantId: participant.id,
          nickname: participant.nickname,
          status: session.status,
        },
      });
    } catch (err: any) {
      if (err instanceof ArenaError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // 3. Get arena state
  app.get<{ Params: { pin: string } }>('/:pin/state', async (request, reply) => {
    try {
      const userId = await getOptionalUserId(request);
      const state = await arenaService.getArenaState(request.params.pin, userId);
      return reply.status(200).send({
        success: true,
        data: state,
      });
    } catch (err: any) {
      if (err instanceof ArenaError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // 4. Host starts game
  app.post<{ Params: { pin: string } }>(
    '/:pin/start',
    { preHandler: app.authenticate },
    async (request, reply) => {
      try {
        const state = await arenaService.startGame(request.user!.id, request.params.pin);
        broadcastToRoom(request.params.pin, { type: 'STATE_UPDATE', state });
        return reply.status(200).send({
          success: true,
          data: state,
        });
      } catch (err: any) {
        if (err instanceof ArenaError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // 5. Submit answer
  app.post<{ Params: { pin: string } }>('/:pin/answer', async (request, reply) => {
    try {
      const parsed = submitArenaAnswerSchema.safeParse({
        pin: request.params.pin,
        ...(request.body as object),
      });

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message },
        });
      }

      const res = await arenaService.submitAnswer(
        parsed.data.pin,
        parsed.data.participantId,
        parsed.data.questionId,
        parsed.data.selectedChoiceId,
        parsed.data.responseTimeMs
      );

      broadcastToRoom(request.params.pin, {
        type: 'PLAYER_ANSWERED',
        participantId: parsed.data.participantId,
        totalAnswered: res.totalAnswers,
        totalPlayers: res.totalPlayers,
      });

      if (res.allAnswered) {
        const state = await arenaService.getArenaState(request.params.pin);
        const endState = await arenaService.endQuestion(state.hostId, request.params.pin);
        broadcastToRoom(request.params.pin, { type: 'STATE_UPDATE', state: endState });
      }

      return reply.status(200).send({
        success: true,
        data: res,
      });
    } catch (err: any) {
      if (err instanceof ArenaError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // 6. Host ends question countdown
  app.post<{ Params: { pin: string } }>(
    '/:pin/end-question',
    { preHandler: app.authenticate },
    async (request, reply) => {
      try {
        const state = await arenaService.endQuestion(request.user!.id, request.params.pin);
        broadcastToRoom(request.params.pin, { type: 'STATE_UPDATE', state });
        return reply.status(200).send({
          success: true,
          data: state,
        });
      } catch (err: any) {
        if (err instanceof ArenaError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // 7. Host next question or finishes
  app.post<{ Params: { pin: string } }>(
    '/:pin/next',
    { preHandler: app.authenticate },
    async (request, reply) => {
      try {
        const state = await arenaService.nextQuestionOrFinish(request.user!.id, request.params.pin);
        broadcastToRoom(request.params.pin, { type: 'STATE_UPDATE', state });
        return reply.status(200).send({
          success: true,
          data: state,
        });
      } catch (err: any) {
        if (err instanceof ArenaError) {
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
