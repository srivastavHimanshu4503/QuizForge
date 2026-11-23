import { z } from 'zod';

export const studyRoomStatusSchema = z.enum(['active', 'ended']);
export type StudyRoomStatus = z.infer<typeof studyRoomStatusSchema>;

export const createStudyRoomSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(100, 'Title cannot exceed 100 characters'),
  quizId: z.string().optional().nullable(),
  maxParticipants: z.number().int().min(2).max(30).default(10),
});
export type CreateStudyRoomInput = z.infer<typeof createStudyRoomSchema>;

export const whiteboardPointSchema = z.object({
  x: z.number(), // normalized 0 to 1
  y: z.number(), // normalized 0 to 1
});
export type WhiteboardPoint = z.infer<typeof whiteboardPointSchema>;

export const whiteboardStrokeSchema = z.object({
  id: z.string(),
  tool: z.enum(['pen', 'eraser']),
  color: z.string(),
  size: z.number().min(1).max(32),
  points: z.array(whiteboardPointSchema),
  userId: z.string(),
  userName: z.string(),
});
export type WhiteboardStroke = z.infer<typeof whiteboardStrokeSchema>;

export const studyRoomParticipantSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  role: z.enum(['host', 'participant']),
  joinedAt: z.string(),
  isMuted: z.boolean().default(false),
  isHandRaised: z.boolean().default(false),
});
export type StudyRoomParticipant = z.infer<typeof studyRoomParticipantSchema>;

export const studyRoomDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  hostUserId: z.string(),
  hostName: z.string().optional(),
  quizId: z.string().nullable().optional(),
  quizTitle: z.string().nullable().optional(),
  status: studyRoomStatusSchema,
  maxParticipants: z.number(),
  createdAt: z.union([z.string(), z.date()]),
  endedAt: z.union([z.string(), z.date()]).nullable().optional(),
  activeParticipantsCount: z.number().default(0),
  activeParticipants: z.array(studyRoomParticipantSchema).optional(),
  quizData: z
    .object({
      id: z.string(),
      title: z.string(),
      topic: z.string(),
      questions: z.array(
        z.object({
          id: z.string(),
          questionText: z.string(),
          explanation: z.string().nullable().optional(),
          choices: z.array(
            z.object({
              id: z.string(),
              choiceText: z.string(),
              isCorrect: z.boolean().optional(),
            })
          ),
        })
      ),
    })
    .nullable()
    .optional(),
});
export type StudyRoomDto = z.infer<typeof studyRoomDtoSchema>;

export const chatMessageSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  text: z.string().min(1).max(1000),
  timestamp: z.string(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

// WebSocket Message Schemas
export type StudyRoomWsClientMessage =
  | { type: 'JOIN_ROOM'; roomIdOrCode: string; userId: string; userName: string }
  | { type: 'LEAVE_ROOM'; roomId: string }
  | { type: 'WB_STROKE'; roomId: string; stroke: WhiteboardStroke }
  | { type: 'WB_CLEAR'; roomId: string }
  | { type: 'WB_UNDO'; roomId: string; strokeId?: string }
  | { type: 'WB_CURSOR'; roomId: string; x: number; y: number }
  | { type: 'SELECT_QUESTION'; roomId: string; questionIndex: number }
  | { type: 'TOGGLE_HAND'; roomId: string; raised: boolean }
  | { type: 'AUDIO_STATE'; roomId: string; isMuted: boolean }
  | { type: 'CHAT_MESSAGE'; roomId: string; text: string }
  | { type: 'WEBRTC_SIGNAL'; roomId: string; targetUserId: string; signal: any }
  | { type: 'PING' };

export type StudyRoomWsServerMessage =
  | {
      type: 'ROOM_STATE';
      room: StudyRoomDto;
      strokes: WhiteboardStroke[];
      activeQuestionIndex: number;
      participants: StudyRoomParticipant[];
    }
  | { type: 'PARTICIPANT_JOINED'; participant: StudyRoomParticipant }
  | { type: 'PARTICIPANT_LEFT'; userId: string }
  | { type: 'WB_STROKE_BROADCAST'; stroke: WhiteboardStroke }
  | { type: 'WB_CLEAR_BROADCAST' }
  | { type: 'WB_UNDO_BROADCAST'; strokeId?: string }
  | { type: 'WB_CURSOR_BROADCAST'; userId: string; userName: string; x: number; y: number }
  | { type: 'QUESTION_SYNC'; questionIndex: number }
  | { type: 'PARTICIPANT_UPDATE'; participant: StudyRoomParticipant }
  | { type: 'CHAT_BROADCAST'; message: ChatMessage }
  | { type: 'WEBRTC_SIGNAL_FORWARD'; fromUserId: string; signal: any }
  | { type: 'ROOM_ENDED' }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' };
