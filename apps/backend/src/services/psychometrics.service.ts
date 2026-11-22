import { db } from '../db/index';
import { quizzes, questions, quizAttempts, attemptAnswers } from '../db/schema/index';
import { eq, and, inArray } from 'drizzle-orm';
import {
  QuizPsychometricsDto,
  ItemPsychometricsDto,
  ScoreDistributionBucket,
  calculateCronbachAlpha,
  calculatePointBiserial,
  classifyDiscrimination,
  classifyReliability,
} from '@quiz-forge/shared';

export class PsychometricsError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'PsychometricsError';
  }
}

export class PsychometricsService {
  /**
   * Computes comprehensive test-level and item-level psychometric statistics for a quiz.
   */
  async getQuizPsychometrics(quizId: string, database = db): Promise<QuizPsychometricsDto> {
    const quiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, quizId))
      .get();

    if (!quiz) {
      throw new PsychometricsError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .all()
      .sort((a, b) => a.questionOrder - b.questionOrder);

    if (quizQuestions.length === 0) {
      throw new PsychometricsError('Quiz has no questions.', 400, 'NO_QUESTIONS');
    }

    // Fetch all completed attempts for this quiz
    const completedAttempts = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.status, 'completed')))
      .all();

    const sampleSize = completedAttempts.length;

    // Default response if no completed attempts exist yet
    if (sampleSize === 0) {
      const emptyItems: ItemPsychometricsDto[] = quizQuestions.map((q) => ({
        questionId: q.id,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        difficultyTier: q.difficultyTier || 'medium',
        totalResponses: 0,
        correctResponses: 0,
        facilityIndex: 0.5,
        discriminationIndex: 0.0,
        discriminationRating: 'fair',
      }));

      return {
        quizId: quiz.id,
        topic: quiz.topic,
        sampleSize: 0,
        meanScore: 0,
        medianScore: 0,
        standardDeviation: 0,
        cronbachAlpha: 0,
        reliabilityClassification: 'unacceptable',
        standardErrorOfMeasurement: 0,
        scoreDistribution: [
          { range: '0-20%', min: 0, max: 20, count: 0, percentage: 0 },
          { range: '21-40%', min: 21, max: 40, count: 0, percentage: 0 },
          { range: '41-60%', min: 41, max: 60, count: 0, percentage: 0 },
          { range: '61-80%', min: 61, max: 80, count: 0, percentage: 0 },
          { range: '81-100%', min: 81, max: 100, count: 0, percentage: 0 },
        ],
        items: emptyItems,
        recommendations: [
          'No candidate submissions recorded yet. Administer the assessment to generate empirical psychometric calibration.',
        ],
      };
    }

    const attemptIds = completedAttempts.map((a) => a.id);

    // Fetch all answers for these completed attempts
    const answers = database
      .select()
      .from(attemptAnswers)
      .where(inArray(attemptAnswers.attemptId, attemptIds))
      .all();

    // Map: attemptId -> Map<questionId, boolean isCorrect>
    const answerMap = new Map<string, Map<string, boolean>>();
    for (const ans of answers) {
      let qMap = answerMap.get(ans.attemptId);
      if (!qMap) {
        qMap = new Map<string, boolean>();
        answerMap.set(ans.attemptId, qMap);
      }
      qMap.set(ans.questionId, Boolean(ans.isCorrect));
    }

    // Build data matrices for examinees
    const totalScores: number[] = [];
    const itemScoresMatrix: number[][] = []; // [examineeIndex][questionIndex]

    for (const attempt of completedAttempts) {
      const qMap = answerMap.get(attempt.id) || new Map<string, boolean>();
      const examineeRow: number[] = [];
      let totalExamineeScore = 0;

      for (const q of quizQuestions) {
        const isRight = qMap.get(q.id) === true;
        const score = isRight ? 1 : 0;
        examineeRow.push(score);
        totalExamineeScore += score;
      }

      itemScoresMatrix.push(examineeRow);
      totalScores.push(totalExamineeScore);
    }

    // 1. Calculate Test-Level Distribution
    const meanScore =
      Math.round((totalScores.reduce((acc, v) => acc + v, 0) / sampleSize) * 100) / 100;

    const sortedScores = [...totalScores].sort((a, b) => a - b);
    const mid = Math.floor(sampleSize / 2);
    const medianScore =
      sampleSize % 2 !== 0
        ? sortedScores[mid]!
        : Math.round(((sortedScores[mid - 1]! + sortedScores[mid]!) / 2) * 100) / 100;

    const variance =
      totalScores.reduce((acc, v) => acc + Math.pow(v - meanScore, 2), 0) /
      Math.max(1, sampleSize - 1);
    const standardDeviation = Math.round(Math.sqrt(variance) * 100) / 100;

    // 2. Cronbach's Alpha & SEM
    const cronbachAlpha = calculateCronbachAlpha(itemScoresMatrix, totalScores);
    const reliabilityClassification = classifyReliability(cronbachAlpha);
    const standardErrorOfMeasurement =
      Math.round(standardDeviation * Math.sqrt(Math.max(0, 1 - cronbachAlpha)) * 100) / 100;

    // 3. Item-Level Statistics
    const items: ItemPsychometricsDto[] = [];
    const recommendations: string[] = [];

    quizQuestions.forEach((q, colIdx) => {
      const itemAnswersCol = itemScoresMatrix.map((row) => row[colIdx] ?? 0);
      const correctCount = itemAnswersCol.filter((v) => v === 1).length;
      const facilityIndex =
        sampleSize > 0 ? Math.round((correctCount / sampleSize) * 1000) / 1000 : 0.5;

      const discriminationIndex = calculatePointBiserial(itemAnswersCol, totalScores);
      const discriminationRating = classifyDiscrimination(discriminationIndex);

      items.push({
        questionId: q.id,
        questionOrder: q.questionOrder,
        questionText: q.questionText,
        difficultyTier: q.difficultyTier || 'medium',
        totalResponses: sampleSize,
        correctResponses: correctCount,
        facilityIndex,
        discriminationIndex,
        discriminationRating,
      });

      // Generate contextual pedagogical recommendations
      if (discriminationIndex < 0.0) {
        recommendations.push(
          `Question ${q.questionOrder} exhibits negative discrimination (r_pb = ${discriminationIndex}). Top scorers failed this item more frequently than low scorers; inspect choice distractors for misleading phrasing.`
        );
      } else if (discriminationIndex < 0.2 && sampleSize >= 10) {
        recommendations.push(
          `Question ${q.questionOrder} has low discrimination (r_pb = ${discriminationIndex}). Consider revising distractors to better separate high and low ability examinees.`
        );
      }

      if (facilityIndex < 0.15 && sampleSize >= 5) {
        recommendations.push(
          `Question ${q.questionOrder} has extreme difficulty (facility index = ${(facilityIndex * 100).toFixed(0)}%). Consider clarifying the prompt or providing scaffolding.`
        );
      } else if (facilityIndex > 0.95 && sampleSize >= 5) {
        recommendations.push(
          `Question ${q.questionOrder} has ceiling facility (${(facilityIndex * 100).toFixed(0)}% correct). Provides minimal variance for discriminating top talent.`
        );
      }
    });

    // Reliability recommendation
    if (cronbachAlpha >= 0.8) {
      recommendations.unshift(
        `High internal consistency reliability (α = ${cronbachAlpha.toFixed(2)}). The assessment demonstrates strong measurement consistency.`
      );
    } else if (cronbachAlpha < 0.6 && sampleSize >= 10) {
      recommendations.unshift(
        `Internal consistency reliability is low (α = ${cronbachAlpha.toFixed(2)}). Increasing test length or removing poorly discriminating items will boost assessment reliability.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        `Assessment demonstrates balanced discrimination and difficulty across candidate cohort (Mean: ${meanScore}/${quizQuestions.length}).`
      );
    }

    // 4. Score Distribution Buckets (0-20%, 21-40%, 41-60%, 61-80%, 81-100%)
    const maxPossibleScore = Math.max(1, quizQuestions.length);
    const buckets: ScoreDistributionBucket[] = [
      { range: '0-20%', min: 0, max: 20, count: 0, percentage: 0 },
      { range: '21-40%', min: 21, max: 40, count: 0, percentage: 0 },
      { range: '41-60%', min: 41, max: 60, count: 0, percentage: 0 },
      { range: '61-80%', min: 61, max: 80, count: 0, percentage: 0 },
      { range: '81-100%', min: 81, max: 100, count: 0, percentage: 0 },
    ];

    for (const score of totalScores) {
      const pct = Math.round((score / maxPossibleScore) * 100);
      if (pct <= 20) buckets[0]!.count++;
      else if (pct <= 40) buckets[1]!.count++;
      else if (pct <= 60) buckets[2]!.count++;
      else if (pct <= 80) buckets[3]!.count++;
      else buckets[4]!.count++;
    }

    buckets.forEach((b) => {
      b.percentage = sampleSize > 0 ? Math.round((b.count / sampleSize) * 100) : 0;
    });

    return {
      quizId: quiz.id,
      topic: quiz.topic,
      sampleSize,
      meanScore,
      medianScore,
      standardDeviation,
      cronbachAlpha,
      reliabilityClassification,
      standardErrorOfMeasurement,
      scoreDistribution: buckets,
      items,
      recommendations,
    };
  }
}

export const psychometricsService = new PsychometricsService();
