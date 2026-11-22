import { z } from 'zod';

export type FlashcardState = 'new' | 'learning' | 'review' | 'mastered';
export type FlashcardRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface FlashcardDeckDto {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  quizId: string | null;
  quizTitle?: string | null;
  totalCards: number;
  dueCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  masteredCards: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlashcardCardDto {
  id: string;
  deckId: string;
  userId: string;
  questionId: string | null;
  front: string;
  back: string;
  explanation: string | null;
  repetitionNumber: number;
  easinessFactor: number;
  intervalDays: number;
  dueDate: string;
  state: FlashcardState;
  lastReviewedAt: string | null;
  reviewCount: number;
  lapses: number;
  createdAt: string;
}

export interface FlashcardReviewResultDto {
  cardId: string;
  rating: FlashcardRating;
  previousInterval: number;
  newInterval: number;
  previousEf: number;
  newEf: number;
  dueDate: string;
  state: FlashcardState;
  repetitionNumber: number;
}

export interface FlashcardStatsDto {
  totalDecks: number;
  totalCards: number;
  dueTodayCount: number;
  masteredCount: number;
  learningCount: number;
  newCount: number;
  streakDays: number;
  totalReviewsDone: number;
}

export const createFlashcardDeckSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional(),
  quizId: z.string().uuid().optional(),
});

export type CreateFlashcardDeckInput = z.infer<typeof createFlashcardDeckSchema>;

export const createFlashcardCardSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  front: z.string().trim().min(1, 'Front prompt is required').max(1000, 'Front prompt cannot exceed 1000 characters'),
  back: z.string().trim().min(1, 'Back answer is required').max(2000, 'Back answer cannot exceed 2000 characters'),
  explanation: z.string().trim().max(2000, 'Explanation cannot exceed 2000 characters').optional(),
  questionId: z.string().uuid().optional(),
});

export type CreateFlashcardCardInput = z.infer<typeof createFlashcardCardSchema>;

export const reviewFlashcardSchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

export type ReviewFlashcardInput = z.infer<typeof reviewFlashcardSchema>;

export const importMistakesSchema = z.object({
  quizId: z.string().uuid().optional(),
  deckTitle: z.string().trim().min(1).max(100).optional(),
});

export type ImportMistakesInput = z.infer<typeof importMistakesSchema>;

export const generateFromQuizSchema = z.object({
  quizId: z.string().uuid('Invalid quiz ID'),
  deckTitle: z.string().trim().min(1).max(100).optional(),
});

export type GenerateFromQuizInput = z.infer<typeof generateFromQuizSchema>;
