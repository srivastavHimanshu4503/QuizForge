import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WebSocket } from 'ws';
import {
  createStudyRoomSchema,
  StudyRoomWsClientMessage,
  StudyRoomWsServerMessage,
  WhiteboardStroke,
  StudyRoomParticipant,
  ChatMessage,
} from '@quiz-forge/shared';
import { studyRoomService, StudyRoomError } from '../services/study-room.service';

// In-Memory Room Registries
// Map: roomId -> Map<userId, { ws: WebSocket; participant: StudyRoomParticipant }>
const roomSockets = new Map<string, Map<string, { ws: WebSocket; participant: StudyRoomParticipant }>>();
// Map: roomId -> WhiteboardStroke[]
const roomStrokes = new Map<string, WhiteboardStroke[]>();
// Map: roomId -> number (current active question index)
const roomQuestionIndex = new Map<string, number>();

export function getActiveParticipantCount(roomId: string): number {
  return roomSockets.get(roomId)?.size || 0;
}

export function broadcastToRoom(
  roomId: string,
  message: StudyRoomWsServerMessage,
  excludeUserId?: string
) {
  const participants = roomSockets.get(roomId);
  if (!participants) return;
  const payload = JSON.stringify(message);

  for (const [userId, session] of participants.entries()) {
    if (excludeUserId && userId === excludeUserId) continue;
    if (session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(payload);
    }
  }
}

export const studyRoomRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // WebSocket endpoint for real-time collaboration
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    let currentRoomId: string | null = null;
    let currentUserId: string | null = null;

    const cleanup = () => {
      if (currentRoomId && currentUserId) {
        const participants = roomSockets.get(currentRoomId);
        if (participants) {
          participants.delete(currentUserId);
          if (participants.size === 0) {
            roomSockets.delete(currentRoomId);
            // keep strokes in memory for reconnection, or let them stay
          } else {
            broadcastToRoom(currentRoomId, {
              type: 'PARTICIPANT_LEFT',
              userId: currentUserId,
            });
          }
        }
      }
    };

    socket.on('close', () => {
      cleanup();
    });

    socket.on('error', () => {
      cleanup();
    });

    socket.on('message', async (rawMsg: string | Buffer) => {
      try {
        const text = rawMsg.toString();
        const msg = JSON.parse(text) as StudyRoomWsClientMessage;

        if (msg.type === 'PING') {
          socket.send(JSON.stringify({ type: 'PONG' }));
          return;
        }

        if (msg.type === 'JOIN_ROOM') {
          try {
            const room = await studyRoomService.getRoom(msg.roomIdOrCode);
            if (room.status === 'ended') {
              socket.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: 'This study room has already ended.',
                })
              );
              return;
            }

            const roomId = room.id;
            currentRoomId = roomId;
            currentUserId = msg.userId;

            if (!roomSockets.has(roomId)) {
              roomSockets.set(roomId, new Map());
            }

            const participantsMap = roomSockets.get(roomId)!;

            if (participantsMap.size >= room.maxParticipants && !participantsMap.has(msg.userId)) {
              socket.send(
                JSON.stringify({
                  type: 'ERROR',
                  message: 'Study room is at full capacity.',
                })
              );
              return;
            }

            const isHost = room.hostUserId === msg.userId;
            const participant: StudyRoomParticipant = {
              userId: msg.userId,
              userName: msg.userName || (isHost ? 'Host' : 'Participant'),
              role: isHost ? 'host' : 'participant',
              joinedAt: new Date().toISOString(),
              isMuted: false,
              isHandRaised: false,
            };

            participantsMap.set(msg.userId, { ws: socket, participant });

            if (!roomStrokes.has(roomId)) {
              roomStrokes.set(roomId, []);
            }
            if (!roomQuestionIndex.has(roomId)) {
              roomQuestionIndex.set(roomId, 0);
            }

            // Send full room state to the newly joined peer
            const existingStrokes = roomStrokes.get(roomId) || [];
            const activeIndex = roomQuestionIndex.get(roomId) || 0;
            const allParticipants = Array.from(participantsMap.values()).map((p) => p.participant);

            socket.send(
              JSON.stringify({
                type: 'ROOM_STATE',
                room: {
                  ...room,
                  activeParticipantsCount: allParticipants.length,
                },
                strokes: existingStrokes,
                activeQuestionIndex: activeIndex,
                participants: allParticipants,
              })
            );

            // Broadcast join to all other room members
            broadcastToRoom(
              roomId,
              {
                type: 'PARTICIPANT_JOINED',
                participant,
              },
              msg.userId
            );
          } catch (err) {
            socket.send(
              JSON.stringify({
                type: 'ERROR',
                message: err instanceof Error ? err.message : 'Failed to join room',
              })
            );
          }
          return;
        }

        if (msg.type === 'LEAVE_ROOM') {
          cleanup();
          currentRoomId = null;
          currentUserId = null;
          return;
        }

        if (msg.type === 'WB_STROKE') {
          if (!currentRoomId) return;
          const strokes = roomStrokes.get(currentRoomId) || [];
          strokes.push(msg.stroke);
          // Keep stroke buffer bounded to 2000 strokes
          if (strokes.length > 2000) {
            strokes.shift();
          }
          roomStrokes.set(currentRoomId, strokes);

          broadcastToRoom(
            currentRoomId,
            {
              type: 'WB_STROKE_BROADCAST',
              stroke: msg.stroke,
            },
            currentUserId || undefined
          );
          return;
        }

        if (msg.type === 'WB_CLEAR') {
          if (!currentRoomId) return;
          roomStrokes.set(currentRoomId, []);
          broadcastToRoom(currentRoomId, { type: 'WB_CLEAR_BROADCAST' });
          return;
        }

        if (msg.type === 'WB_UNDO') {
          if (!currentRoomId) return;
          const strokes = roomStrokes.get(currentRoomId) || [];
          if (strokes.length > 0) {
            const popped = msg.strokeId
              ? strokes.filter((s) => s.id !== msg.strokeId)
              : strokes.slice(0, -1);
            roomStrokes.set(currentRoomId, popped);
            broadcastToRoom(currentRoomId, {
              type: 'WB_UNDO_BROADCAST',
              strokeId: msg.strokeId || strokes[strokes.length - 1]?.id,
            });
          }
          return;
        }

        if (msg.type === 'WB_CURSOR') {
          if (!currentRoomId || !currentUserId) return;
          const participant = roomSockets.get(currentRoomId)?.get(currentUserId)?.participant;
          broadcastToRoom(
            currentRoomId,
            {
              type: 'WB_CURSOR_BROADCAST',
              userId: currentUserId,
              userName: participant?.userName || 'Peer',
              x: msg.x,
              y: msg.y,
            },
            currentUserId
          );
          return;
        }

        if (msg.type === 'SELECT_QUESTION') {
          if (!currentRoomId) return;
          roomQuestionIndex.set(currentRoomId, msg.questionIndex);
          broadcastToRoom(currentRoomId, {
            type: 'QUESTION_SYNC',
            questionIndex: msg.questionIndex,
          });
          return;
        }

        if (msg.type === 'TOGGLE_HAND') {
          if (!currentRoomId || !currentUserId) return;
          const userSession = roomSockets.get(currentRoomId)?.get(currentUserId);
          if (userSession) {
            userSession.participant.isHandRaised = msg.raised;
            broadcastToRoom(currentRoomId, {
              type: 'PARTICIPANT_UPDATE',
              participant: userSession.participant,
            });
          }
          return;
        }

        if (msg.type === 'AUDIO_STATE') {
          if (!currentRoomId || !currentUserId) return;
          const userSession = roomSockets.get(currentRoomId)?.get(currentUserId);
          if (userSession) {
            userSession.participant.isMuted = msg.isMuted;
            broadcastToRoom(currentRoomId, {
              type: 'PARTICIPANT_UPDATE',
              participant: userSession.participant,
            });
          }
          return;
        }

        if (msg.type === 'CHAT_MESSAGE') {
          if (!currentRoomId || !currentUserId) return;
          const participant = roomSockets.get(currentRoomId)?.get(currentUserId)?.participant;
          const message: ChatMessage = {
            id: crypto.randomUUID(),
            userId: currentUserId,
            userName: participant?.userName || 'Peer',
            text: msg.text.slice(0, 1000),
            timestamp: new Date().toISOString(),
          };
          broadcastToRoom(currentRoomId, {
            type: 'CHAT_BROADCAST',
            message,
          });
          return;
        }

        if (msg.type === 'WEBRTC_SIGNAL') {
          if (!currentRoomId || !currentUserId) return;
          const targetSession = roomSockets.get(currentRoomId)?.get(msg.targetUserId);
          if (targetSession && targetSession.ws.readyState === WebSocket.OPEN) {
            targetSession.ws.send(
              JSON.stringify({
                type: 'WEBRTC_SIGNAL_FORWARD',
                fromUserId: currentUserId,
                signal: msg.signal,
              })
            );
          }
          return;
        }
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: 'ERROR',
            message: 'Failed to process message',
          })
        );
      }
    });
  });

  // REST Routes

  // POST /api/study-rooms (Create study room, auth required)
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parseResult = createStudyRoomSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid study room data',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const room = await studyRoomService.createRoom(request.user!.id, parseResult.data);
      return reply.status(201).send({
        success: true,
        data: room,
      });
    } catch (err: unknown) {
      if (err instanceof StudyRoomError) {
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

  // GET /api/study-rooms/active (List active rooms)
  app.get('/active', async (_request, reply) => {
    try {
      const rooms = await studyRoomService.listActiveRooms();
      const enriched = rooms.map((r) => ({
        ...r,
        activeParticipantsCount: getActiveParticipantCount(r.id),
      }));
      return reply.status(200).send({
        success: true,
        data: enriched,
      });
    } catch (err: unknown) {
      if (err instanceof StudyRoomError) {
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

  // GET /api/study-rooms/:roomIdOrCode (Get room details)
  app.get('/:roomIdOrCode', async (request, reply) => {
    const { roomIdOrCode } = request.params as { roomIdOrCode: string };
    try {
      const room = await studyRoomService.getRoom(roomIdOrCode);
      const activeCount = getActiveParticipantCount(room.id);
      const participantSessions = roomSockets.get(room.id);
      const activeParticipants = participantSessions
        ? Array.from(participantSessions.values()).map((p) => p.participant)
        : [];

      return reply.status(200).send({
        success: true,
        data: {
          ...room,
          activeParticipantsCount: activeCount,
          activeParticipants,
        },
      });
    } catch (err: unknown) {
      if (err instanceof StudyRoomError) {
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

  // POST /api/study-rooms/:roomId/end (Host ends study room)
  app.post('/:roomId/end', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    try {
      const room = await studyRoomService.endRoom(request.user!.id, roomId);
      broadcastToRoom(room.id, { type: 'ROOM_ENDED' });
      return reply.status(200).send({
        success: true,
        data: room,
      });
    } catch (err: unknown) {
      if (err instanceof StudyRoomError) {
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
