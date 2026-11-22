import { z } from 'zod';

export const scormVersionEnum = z.enum(['1.2', '2004_4th', 'xapi']);
export type ScormVersion = z.infer<typeof scormVersionEnum>;

export const scormExportConfigSchema = z.object({
  scormVersion: scormVersionEnum.default('1.2'),
  passingScorePercentage: z.number().min(0).max(100).default(70),
  masteryStatusOnPassing: z.enum(['passed', 'completed']).default('passed'),
  timeLimitMinutes: z.number().int().min(1).max(300).nullable().optional(),
  includeExplanations: z.boolean().default(true),
  trackInteractions: z.boolean().default(true),
});
export type ScormExportConfig = z.infer<typeof scormExportConfigSchema>;

export const itemDiscriminationRatingEnum = z.enum([
  'excellent',
  'good',
  'fair',
  'poor',
  'flawed',
]);
export type ItemDiscriminationRating = z.infer<typeof itemDiscriminationRatingEnum>;

export const itemPsychometricsDtoSchema = z.object({
  questionId: z.string(),
  questionOrder: z.number().int(),
  questionText: z.string(),
  difficultyTier: z.string().optional(),
  totalResponses: z.number().int(),
  correctResponses: z.number().int(),
  facilityIndex: z.number(), // p-value: proportion correct [0, 1]
  discriminationIndex: z.number(), // Point-biserial correlation r_pb [-1, 1]
  discriminationRating: itemDiscriminationRatingEnum,
});
export type ItemPsychometricsDto = z.infer<typeof itemPsychometricsDtoSchema>;

export const testReliabilityClassificationEnum = z.enum([
  'unacceptable',
  'questionable',
  'acceptable',
  'good',
  'excellent',
]);
export type TestReliabilityClassification = z.infer<typeof testReliabilityClassificationEnum>;

export const scoreDistributionBucketSchema = z.object({
  range: z.string(),
  min: z.number(),
  max: z.number(),
  count: z.number().int(),
  percentage: z.number(),
});
export type ScoreDistributionBucket = z.infer<typeof scoreDistributionBucketSchema>;

export const quizPsychometricsDtoSchema = z.object({
  quizId: z.string(),
  topic: z.string(),
  sampleSize: z.number().int(), // number of completed attempts
  meanScore: z.number(),
  medianScore: z.number(),
  standardDeviation: z.number(),
  cronbachAlpha: z.number(), // internal consistency reliability
  reliabilityClassification: testReliabilityClassificationEnum,
  standardErrorOfMeasurement: z.number(), // SEM = SD * sqrt(1 - alpha)
  scoreDistribution: z.array(scoreDistributionBucketSchema),
  items: z.array(itemPsychometricsDtoSchema),
  recommendations: z.array(z.string()),
});
export type QuizPsychometricsDto = z.infer<typeof quizPsychometricsDtoSchema>;

export const ltiGradePassbackInputSchema = z.object({
  attemptId: z.string().uuid(),
  score: z.number().min(0),
  maxScore: z.number().min(1),
  lineItemUrl: z.string().url(),
  activityProgress: z.enum(['Initialized', 'Started', 'InProgress', 'Submitted', 'Completed']).default('Completed'),
  gradingProgress: z.enum(['FullyGraded', 'Pending', 'PendingManual', 'Failed', 'NotReady']).default('FullyGraded'),
  comment: z.string().optional(),
});
export type LtiGradePassbackInput = z.infer<typeof ltiGradePassbackInputSchema>;

/**
 * Calculates Cronbach's Alpha internal consistency reliability coefficient.
 * alpha = (k / (k - 1)) * (1 - (sum(var_items) / var_total))
 */
export function calculateCronbachAlpha(
  itemScoresMatrix: number[][], // rows: examinees, cols: items (0 or 1)
  totalScores: number[]
): number {
  const k = itemScoresMatrix[0]?.length ?? 0;
  const n = itemScoresMatrix.length;

  if (k <= 1 || n <= 2) return 0.0;

  // Total variance
  const meanTotal = totalScores.reduce((acc, v) => acc + v, 0) / n;
  const totalVariance =
    totalScores.reduce((acc, v) => acc + Math.pow(v - meanTotal, 2), 0) / (n - 1);

  if (totalVariance <= 0) return 0.0;

  // Sum of individual item variances
  let sumItemVariances = 0;
  for (let j = 0; j < k; j++) {
    const itemColumn = itemScoresMatrix.map((row) => row[j] ?? 0);
    const meanItem = itemColumn.reduce((acc, v) => acc + v, 0) / n;
    // For dichotomous items, Var = p * (1 - p)
    const itemVar = itemColumn.reduce((acc, v) => acc + Math.pow(v - meanItem, 2), 0) / (n - 1);
    sumItemVariances += itemVar;
  }

  const alpha = (k / (k - 1)) * (1 - sumItemVariances / totalVariance);
  // Bounded between 0.0 and 1.0 (negative alpha indicates serious scoring inversion)
  return Math.max(0.0, Math.min(1.0, Math.round(alpha * 1000) / 1000));
}

/**
 * Calculates Point-Biserial Correlation (r_pb) for item discrimination.
 * r_pb = ((M1 - M0) / SD_total) * sqrt(p * q)
 * M1 = mean total score of examinees answering item correctly
 * M0 = mean total score of examinees answering item incorrectly
 * p = proportion answering correctly, q = 1 - p
 * SD_total = standard deviation of total scores
 */
export function calculatePointBiserial(
  itemAnswers: number[], // 0 or 1 for each examinee
  totalScores: number[]
): number {
  const n = itemAnswers.length;
  if (n <= 2) return 0.0;

  const correctIndices: number[] = [];
  const incorrectIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    if (itemAnswers[i] === 1) {
      correctIndices.push(i);
    } else {
      incorrectIndices.push(i);
    }
  }

  // If everyone got it right or everyone got it wrong, discrimination is 0
  if (correctIndices.length === 0 || incorrectIndices.length === 0) {
    return 0.0;
  }

  const p = correctIndices.length / n;
  const q = 1 - p;

  const m1 =
    correctIndices.reduce((acc, idx) => acc + (totalScores[idx] ?? 0), 0) / correctIndices.length;
  const m0 =
    incorrectIndices.reduce((acc, idx) => acc + (totalScores[idx] ?? 0), 0) / incorrectIndices.length;

  const meanTotal = totalScores.reduce((acc, v) => acc + v, 0) / n;
  const varianceTotal =
    totalScores.reduce((acc, v) => acc + Math.pow(v - meanTotal, 2), 0) / n;
  const sdTotal = Math.sqrt(varianceTotal);

  if (sdTotal <= 0) return 0.0;

  const r_pb = ((m1 - m0) / sdTotal) * Math.sqrt(p * q);
  return Math.max(-1.0, Math.min(1.0, Math.round(r_pb * 1000) / 1000));
}

/**
 * Classifies discrimination index into standard psychometric ratings.
 */
export function classifyDiscrimination(r_pb: number): ItemDiscriminationRating {
  if (r_pb >= 0.4) return 'excellent';
  if (r_pb >= 0.3) return 'good';
  if (r_pb >= 0.2) return 'fair';
  if (r_pb >= 0.0) return 'poor';
  return 'flawed';
}

/**
 * Classifies Cronbach's Alpha into standard psychometric reliability.
 */
export function classifyReliability(alpha: number): TestReliabilityClassification {
  if (alpha >= 0.9) return 'excellent';
  if (alpha >= 0.8) return 'good';
  if (alpha >= 0.7) return 'acceptable';
  if (alpha >= 0.6) return 'questionable';
  return 'unacceptable';
}
