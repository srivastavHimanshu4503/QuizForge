import { z } from 'zod';
import { ClientQuestion } from './quiz.schema.js';

export type AdaptiveAbilityTier = 'Novice' | 'Developing' | 'Proficient' | 'Advanced' | 'Master';

export type QuestionDifficultyTier = 'easy' | 'medium' | 'hard' | 'expert';

export interface AdaptiveAbilityPointDto {
  step: number;
  questionId: string;
  questionText: string;
  isCorrect: boolean;
  theta: number;
  standardError: number;
  difficultyParam: number;
  difficultyTier: QuestionDifficultyTier;
}

export interface AdaptiveAttemptSummaryDto {
  attemptId: string;
  isAdaptive: boolean;
  finalTheta: number;
  standardError: number;
  percentile: number;
  abilityTier: AdaptiveAbilityTier;
  totalSteps: number;
  trajectory: AdaptiveAbilityPointDto[];
}

export interface AdaptiveNextQuestionDto {
  question: ClientQuestion | null;
  step: number;
  maxSteps: number;
  currentTheta: number;
  standardError: number;
  currentDifficultyTier: QuestionDifficultyTier;
  isComplete: boolean;
}

export const generateAdaptiveQuizSchema = z.object({
  topic: z.string().trim().min(2, 'Topic must be at least 2 characters').max(255),
  itemPoolSize: z.number().int().min(6).max(30).default(12),
  maxTestLength: z.number().int().min(4).max(15).default(8),
  provider: z.string().optional(),
});

export type GenerateAdaptiveQuizInput = z.infer<typeof generateAdaptiveQuizSchema>;

/**
 * Rasch 1-PL Item Response Theory logistic probability function:
 * P(theta) = 1 / (1 + exp(-a * (theta - b)))
 */
export function calculateIrtProbability(theta: number, b: number, a: number = 1.0): number {
  const z = a * (theta - b);
  return 1 / (1 + Math.exp(-z));
}

/**
 * Item Fisher Information:
 * I(theta) = a^2 * P(theta) * (1 - P(theta))
 * Maximized when b == theta.
 */
export function calculateFisherInformation(theta: number, b: number, a: number = 1.0): number {
  const p = calculateIrtProbability(theta, b, a);
  return a * a * p * (1 - p);
}

/**
 * Calibrated ability update with step damping to prevent oscillation:
 * Increases theta when correct, decreases when incorrect, scaled by item difficulty.
 */
export function updateAbilityEstimate(
  currentTheta: number,
  currentSE: number,
  isCorrect: boolean,
  b: number,
  a: number = 1.0
): { newTheta: number; newSE: number } {
  const p = calculateIrtProbability(currentTheta, b, a);
  const u = isCorrect ? 1.0 : 0.0;

  // Damped gradient step
  const rawDelta = (u - p) / (a * p * (1 - p) + 0.25);
  const clampedDelta = Math.max(-0.75, Math.min(0.75, rawDelta));

  const newTheta = Math.round(Math.max(-3.5, Math.min(3.5, currentTheta + clampedDelta)) * 100) / 100;

  // Update Standard Error of Measurement: SE reduces as Fisher information accumulates
  const info = calculateFisherInformation(currentTheta, b, a);
  const newSE = Math.round(Math.max(0.2, currentSE / Math.sqrt(1 + info * 1.5)) * 100) / 100;

  return { newTheta, newSE };
}

/**
 * Classifies latent ability theta into human-readable proficiency tier.
 */
export function classifyTheta(theta: number): AdaptiveAbilityTier {
  if (theta < -1.0) return 'Novice';
  if (theta < 0.0) return 'Developing';
  if (theta < 1.0) return 'Proficient';
  if (theta < 2.0) return 'Advanced';
  return 'Master';
}

/**
 * Normal CDF approximation mapping ability theta to standard normative percentile.
 */
export function calculatePercentile(theta: number): number {
  // Logistic approximation to normal distribution Phi(theta)
  const p = 1 / (1 + Math.exp(-1.702 * theta));
  return Math.round(Math.max(1, Math.min(99, p * 100)));
}

/**
 * Maps difficulty parameter to tier label.
 */
export function getDifficultyTierFromParam(b: number): QuestionDifficultyTier {
  if (b < -0.75) return 'easy';
  if (b <= 0.75) return 'medium';
  if (b <= 1.75) return 'hard';
  return 'expert';
}
