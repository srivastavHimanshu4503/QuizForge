import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index';
import {
  quizzes,
  questions,
  choices,
  quizAttempts,
  attemptAnswers,
} from '../db/schema/index';
import { aiService } from './ai/ai.service';
import { env } from '../config/env';
import {
  GenerateAdaptiveQuizInput,
  AdaptiveAttemptSummaryDto,
  AdaptiveNextQuestionDto,
  AdaptiveAbilityPointDto,
  ChoiceId,
  ClientQuestion,
  calculatePercentile,
  classifyTheta,
  updateAbilityEstimate,
  calculateFisherInformation,
  QuestionDifficultyTier,
} from '@quiz-forge/shared';

export class CatError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'CatError';
  }
}

export class CatService {
  /**
   * Generates an adaptive quiz with a stratified difficulty question bank (Item Pool).
   */
  async generateAdaptiveQuiz(
    userId: string,
    input: GenerateAdaptiveQuizInput,
    database = db
  ): Promise<{
    quizId: string;
    attemptId: string;
    topic: string;
    itemPoolSize: number;
    maxTestLength: number;
  }> {
    const itemPoolSize = input.itemPoolSize || 12;
    const maxTestLength = Math.min(input.maxTestLength || 8, itemPoolSize);

    // Context instructing AI to generate questions across distinct difficulty tiers
    const catPromptContext = `COMPUTERIZED ADAPTIVE TESTING (CAT) ITEM POOL:
Generate a diverse item pool of ${itemPoolSize} questions for topic "${input.topic}".
Stratify questions evenly across 4 difficulty tiers:
1. Foundational/Easy (Basic definitions, core recall)
2. Intermediate/Medium (Practical application, common scenarios)
3. Advanced/Hard (Edge cases, architectural tradeoffs, deep diagnostics)
4. Expert (Complex problem-solving, subtle pitfalls)`;

    const generated = await aiService.generateQuizQuestions(
      {
        topic: input.topic,
        questionCount: itemPoolSize,
        difficulty: 'mixed',
        provider: input.provider,
        context: catPromptContext,
      },
      input.provider
    );

    const quizId = crypto.randomUUID();
    const attemptId = crypto.randomUUID();

    // Map questions to calibrated difficulty parameters (b) and tiers
    // Evenly distribute across Easy (-1.5), Medium (0.0), Hard (+1.5), Expert (+2.5)
    const tieredParams: Array<{ tier: QuestionDifficultyTier; b: number }> = [
      { tier: 'easy', b: -1.5 },
      { tier: 'medium', b: 0.0 },
      { tier: 'hard', b: 1.5 },
      { tier: 'expert', b: 2.5 },
    ];

    database.transaction((tx) => {
      // 1. Insert Quiz
      tx.insert(quizzes)
        .values({
          id: quizId,
          userId,
          topic: `${input.topic} (Adaptive CAT)`,
          difficulty: 'mixed',
          questionCount: maxTestLength,
          aiModel: input.provider || env.GEMINI_MODEL,
          isAdaptive: true,
        })
        .run();

      const createdQuestionIds: string[] = [];

      // 2. Insert Questions with Difficulty Parameters
      generated.forEach((q, idx) => {
        const qId = crypto.randomUUID();
        createdQuestionIds.push(qId);

        const tierIndex = Math.floor((idx / generated.length) * tieredParams.length);
        const { tier, b } = tieredParams[tierIndex] || { tier: 'medium', b: 0.0 };

        tx.insert(questions)
          .values({
            id: qId,
            quizId,
            questionOrder: idx + 1,
            questionText: q.question,
            correctChoiceId: (q.correct_answer_id || 'A') as ChoiceId,
            explanation: q.explanation,
            difficultyTier: tier,
            difficultyParam: b,
            discriminationParam: 1.0,
          })
          .run();

        // Choices
        const choiceRecords = (q.choices || []).map((c) => ({
          id: crypto.randomUUID(),
          questionId: qId,
          choiceId: c.choice_id as ChoiceId,
          optionText: c.option_text,
        }));

        if (choiceRecords.length > 0) {
          tx.insert(choices).values(choiceRecords).run();
        }
      });

      // 3. Insert Initial Adaptive Attempt
      tx.insert(quizAttempts)
        .values({
          id: attemptId,
          quizId,
          userId,
          attemptNumber: 1,
          status: 'in_progress',
          shuffledOrder: createdQuestionIds,
          totalQuestions: maxTestLength,
          isAdaptive: true,
          currentTheta: 0.0,
          standardError: 1.0,
          abilityHistory: [],
        })
        .run();
    });

    return {
      quizId,
      attemptId,
      topic: `${input.topic} (Adaptive CAT)`,
      itemPoolSize: generated.length,
      maxTestLength,
    };
  }

  /**
   * Selects and returns the optimal next adaptive question maximizing Fisher Information.
   */
  async getNextAdaptiveQuestion(
    userId: string,
    attemptId: string,
    database = db
  ): Promise<AdaptiveNextQuestionDto> {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new CatError('Quiz attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    const currentTheta = attempt.currentTheta ?? 0.0;
    const standardError = attempt.standardError ?? 1.0;
    const maxSteps = attempt.totalQuestions;

    // Fetch all answers already submitted in this attempt
    const answeredList = database
      .select({ questionId: attemptAnswers.questionId })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId))
      .all();

    const answeredIds = new Set(answeredList.map((a) => a.questionId));
    const stepNumber = answeredIds.size + 1;

    // Check test termination criteria (max steps reached or test completed)
    if (attempt.status === 'completed' || answeredIds.size >= maxSteps) {
      return {
        question: null,
        step: maxSteps,
        maxSteps,
        currentTheta,
        standardError,
        currentDifficultyTier: 'medium',
        isComplete: true,
      };
    }

    // Fetch all available questions in this quiz's item pool
    const allQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, attempt.quizId))
      .all();

    const unansweredQuestions = allQuestions.filter((q) => !answeredIds.has(q.id));

    if (unansweredQuestions.length === 0) {
      return {
        question: null,
        step: answeredIds.size,
        maxSteps,
        currentTheta,
        standardError,
        currentDifficultyTier: 'medium',
        isComplete: true,
      };
    }

    // Item Selection: Select the question whose difficulty b maximizes Fisher Information
    // (i.e., minimizes |b - currentTheta|)
    let bestQuestion = unansweredQuestions[0]!;
    let bestInfo = -1;

    for (const q of unansweredQuestions) {
      const b = q.difficultyParam ?? 0.0;
      const a = q.discriminationParam ?? 1.0;
      const info = calculateFisherInformation(currentTheta, b, a);
      if (info > bestInfo) {
        bestInfo = info;
        bestQuestion = q;
      }
    }

    // Fetch choices for the selected question
    const qChoices = database
      .select()
      .from(choices)
      .where(eq(choices.questionId, bestQuestion.id))
      .all();

    const clientQuestion: ClientQuestion = {
      question_id: bestQuestion.id,
      question: bestQuestion.questionText,
      choices: qChoices.map((c) => ({
        choice_id: c.choiceId as ChoiceId,
        option_text: c.optionText,
      })),
    };

    return {
      question: clientQuestion,
      step: stepNumber,
      maxSteps,
      currentTheta,
      standardError,
      currentDifficultyTier: (bestQuestion.difficultyTier as QuestionDifficultyTier) || 'medium',
      isComplete: false,
    };
  }

  /**
   * Records an answer in an adaptive attempt, updates latent ability theta using IRT,
   * updates the trajectory history, and checks stopping criteria.
   */
  async recordAdaptiveAnswer(
    userId: string,
    attemptId: string,
    questionId: string,
    selectedChoiceId: ChoiceId,
    database = db
  ): Promise<{
    isCorrect: boolean;
    newTheta: number;
    newSE: number;
    abilityTier: string;
    step: number;
    isComplete: boolean;
  }> {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new CatError('Quiz attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    const question = database
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!question) {
      throw new CatError('Question not found.', 404, 'QUESTION_NOT_FOUND');
    }

    const isCorrect = question.correctChoiceId === selectedChoiceId;
    const b = question.difficultyParam ?? 0.0;
    const a = question.discriminationParam ?? 1.0;

    const currentTheta = attempt.currentTheta ?? 0.0;
    const currentSE = attempt.standardError ?? 1.0;

    // Update ability theta and standard error via IRT calibration
    const { newTheta, newSE } = updateAbilityEstimate(currentTheta, currentSE, isCorrect, b, a);

    // Save answer
    const existingAnswer = database
      .select()
      .from(attemptAnswers)
      .where(and(eq(attemptAnswers.attemptId, attemptId), eq(attemptAnswers.questionId, questionId)))
      .get();

    if (existingAnswer) {
      database
        .update(attemptAnswers)
        .set({
          selectedChoiceId,
          isCorrect,
          answeredAt: new Date().toISOString(),
        })
        .where(eq(attemptAnswers.id, existingAnswer.id))
        .run();
    } else {
      database
        .insert(attemptAnswers)
        .values({
          attemptId,
          questionId,
          selectedChoiceId,
          isCorrect,
        })
        .run();
    }

    // Read full answered count
    const answers = database
      .select({ isCorrect: attemptAnswers.isCorrect })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attemptId))
      .all();

    const step = answers.length;
    const isComplete = step >= attempt.totalQuestions;

    const existingHistory = (attempt.abilityHistory as any) || [];
    const newPoint: AdaptiveAbilityPointDto = {
      step,
      questionId,
      questionText: question.questionText,
      isCorrect,
      theta: newTheta,
      standardError: newSE,
      difficultyParam: b,
      difficultyTier: (question.difficultyTier as QuestionDifficultyTier) || 'medium',
    };

    const updatedHistory = [...existingHistory, newPoint];

    const correctCount = answers.filter((ans) => ans.isCorrect === true).length;
    const incorrectCount = answers.filter((ans) => ans.isCorrect === false).length;
    const accuracy = step > 0 ? Math.round((correctCount / step) * 100) : 0;

    database
      .update(quizAttempts)
      .set({
        currentTheta: newTheta,
        standardError: newSE,
        abilityHistory: updatedHistory,
        score: correctCount,
        correctCount,
        incorrectCount,
        accuracyPercentage: accuracy,
        status: isComplete ? 'completed' : 'in_progress',
        completedAt: isComplete ? new Date().toISOString() : null,
      })
      .where(eq(quizAttempts.id, attemptId))
      .run();

    return {
      isCorrect,
      newTheta,
      newSE,
      abilityTier: classifyTheta(newTheta),
      step,
      isComplete,
    };
  }

  /**
   * Fetches the full CAT diagnostic trajectory and ability classification report.
   */
  async getAdaptiveTrajectory(
    userId: string,
    attemptId: string,
    database = db
  ): Promise<AdaptiveAttemptSummaryDto> {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, attemptId), eq(quizAttempts.userId, userId)))
      .get();

    if (!attempt) {
      throw new CatError('Quiz attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    const finalTheta = attempt.currentTheta ?? 0.0;
    const finalSE = attempt.standardError ?? 0.5;
    const trajectory = (attempt.abilityHistory as any) || [];

    return {
      attemptId,
      isAdaptive: Boolean(attempt.isAdaptive),
      finalTheta,
      standardError: finalSE,
      percentile: calculatePercentile(finalTheta),
      abilityTier: classifyTheta(finalTheta),
      totalSteps: trajectory.length,
      trajectory,
    };
  }
}

export const catService = new CatService();
