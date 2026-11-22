import { z } from 'zod';
import { ChoiceId } from './quiz.schema.js';

export type ArenaStatus = 'lobby' | 'question' | 'leaderboard' | 'finished' | 'abandoned';

export const createArenaSessionSchema = z.object({
  quizId: z.string().uuid('Invalid quiz ID'),
  timePerQuestionSeconds: z
    .number()
    .int()
    .min(10, 'Time per question must be at least 10 seconds')
    .max(120, 'Time per question cannot exceed 120 seconds')
    .default(30),
});

export type CreateArenaSessionInput = z.infer<typeof createArenaSessionSchema>;

export const joinArenaSchema = z.object({
  pin: z
    .string()
    .trim()
    .min(4, 'PIN must be at least 4 digits')
    .max(8, 'PIN cannot exceed 8 digits'),
  nickname: z
    .string()
    .trim()
    .min(2, 'Nickname must be at least 2 characters')
    .max(25, 'Nickname cannot exceed 25 characters'),
});

export type JoinArenaInput = z.infer<typeof joinArenaSchema>;

export const submitArenaAnswerSchema = z.object({
  pin: z.string().trim(),
  participantId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedChoiceId: z.enum(['A', 'B', 'C', 'D']),
  responseTimeMs: z.number().int().min(0),
});

export type SubmitArenaAnswerInput = z.infer<typeof submitArenaAnswerSchema>;

export interface ArenaParticipantDto {
  id: string;
  nickname: string;
  score: number;
  streak: number;
  rank?: number;
  hasAnswered?: boolean;
}

export interface ArenaLeaderboardEntry {
  participantId: string;
  nickname: string;
  score: number;
  rank: number;
  streak: number;
  lastPointsEarned?: number;
  isCorrect?: boolean;
}

export interface ArenaQuestionState {
  index: number;
  total: number;
  questionId: string;
  questionText: string;
  choices: Array<{ choice_id: ChoiceId; option_text: string }>;
  timeLimitSeconds: number;
  startedAt: string;
}

export interface ArenaQuestionEndState {
  questionId: string;
  correctChoiceId: ChoiceId;
  explanation: string;
  distribution: Record<ChoiceId, number>;
  totalAnswers: number;
}

export interface ArenaStateDto {
  sessionId: string;
  quizId: string;
  quizTopic: string;
  pin: string;
  status: ArenaStatus;
  hostId: string;
  isHost: boolean;
  participants: ArenaParticipantDto[];
  currentQuestion?: ArenaQuestionState | null;
  questionEnd?: ArenaQuestionEndState | null;
  leaderboard?: ArenaLeaderboardEntry[];
  podium?: ArenaLeaderboardEntry[];
}

export type ArenaWsClientMessage =
  | { type: 'JOIN'; pin: string; participantId: string }
  | { type: 'HOST_CONNECT'; pin: string; hostId: string }
  | {
      type: 'SUBMIT_ANSWER';
      pin: string;
      participantId: string;
      questionId: string;
      selectedChoiceId: ChoiceId;
      responseTimeMs: number;
    }
  | { type: 'HOST_START_GAME'; pin: string }
  | { type: 'HOST_NEXT_QUESTION'; pin: string }
  | { type: 'HOST_END_QUESTION'; pin: string }
  | { type: 'PING' };

export type ArenaWsServerMessage =
  | { type: 'STATE_UPDATE'; state: ArenaStateDto }
  | { type: 'PLAYER_JOINED'; participant: ArenaParticipantDto; totalPlayers: number }
  | { type: 'PLAYER_ANSWERED'; participantId: string; totalAnswered: number; totalPlayers: number }
  | { type: 'QUESTION_START'; question: ArenaQuestionState }
  | { type: 'QUESTION_END'; questionEnd: ArenaQuestionEndState; leaderboard: ArenaLeaderboardEntry[] }
  | { type: 'GAME_OVER'; podium: ArenaLeaderboardEntry[]; fullLeaderboard: ArenaLeaderboardEntry[] }
  | { type: 'ERROR'; message: string; code: string }
  | { type: 'PONG' };
