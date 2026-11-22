import { z } from 'zod';
import { choiceIdEnum, clientChoiceSchema, clientQuestionSchema, difficultyEnum } from './quiz.schema.js';

export const attemptStatusEnum = z.enum(['in_progress', 'completed', 'abandoned']);
export type AttemptStatus = z.infer<typeof attemptStatusEnum>;

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  selectedChoiceId: choiceIdEnum.nullable(),
});

export const activeAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  quizId: z.string().uuid(),
  attemptNumber: z.number().int(),
  topic: z.string(),
  difficulty: difficultyEnum,
  status: attemptStatusEnum,
  totalQuestions: z.number().int(),
  questions: z.array(clientQuestionSchema),
  savedAnswers: z.record(z.string(), choiceIdEnum.nullable()),
  timeLimitMinutes: z.number().int().nullable().optional(),
  startedAt: z.string().optional(),
  tabSwitchCount: z.number().int().optional(),
  isTimedOut: z.boolean().optional(),
  isAdaptive: z.boolean().optional(),
  currentTheta: z.number().optional(),
  standardError: z.number().optional(),
});

export const submitAttemptPayloadSchema = z.object({
  isTimedOut: z.boolean().optional(),
  tabSwitchCount: z.number().int().min(0).optional(),
});
export type SubmitAttemptPayload = z.infer<typeof submitAttemptPayloadSchema>;

export const questionReviewSchema = z.object({
  question_id: z.string(),
  question: z.string(),
  choices: z.array(clientChoiceSchema),
  selected_choice_id: choiceIdEnum.nullable(),
  correct_choice_id: choiceIdEnum,
  is_correct: z.boolean(),
  explanation: z.string(),
});

export const attemptResultSchema = z.object({
  attemptId: z.string().uuid(),
  quizId: z.string().uuid(),
  topic: z.string(),
  difficulty: difficultyEnum,
  attemptNumber: z.number().int(),
  score: z.number().int(),
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  incorrectCount: z.number().int(),
  unansweredCount: z.number().int(),
  accuracyPercentage: z.number(),
  completedAt: z.string(),
  review: z.array(questionReviewSchema),
  timeLimitMinutes: z.number().int().nullable().optional(),
  startedAt: z.string().optional(),
  durationSeconds: z.number().int().optional(),
  tabSwitchCount: z.number().int().optional(),
  isTimedOut: z.boolean().optional(),
  isAdaptive: z.boolean().optional(),
  currentTheta: z.number().optional(),
  standardError: z.number().optional(),
});

export const historyItemTypeEnum = z.enum(['mcq', 'code_review']);
export type HistoryItemType = z.infer<typeof historyItemTypeEnum>;

export const historyItemSchema = z.object({
  attemptId: z.string().uuid(),
  quizId: z.string().uuid(),
  type: historyItemTypeEnum.default('mcq'),
  topic: z.string(),
  difficulty: z.string(),
  attemptNumber: z.number().int().default(1),
  score: z.number(),
  maxScore: z.number().optional().nullable(),
  totalQuestions: z.number().int(),
  accuracyPercentage: z.number(),
  completedAt: z.string(),
  repoUrl: z.string().optional().nullable(),
  repoOwner: z.string().optional().nullable(),
  repoName: z.string().optional().nullable(),
});

export const historyResponseSchema = z.object({
  items: z.array(historyItemSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type ActiveAttempt = z.infer<typeof activeAttemptSchema>;
export type QuestionReview = z.infer<typeof questionReviewSchema>;
export type AttemptResult = z.infer<typeof attemptResultSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
