import { eq, and, inArray, desc } from 'drizzle-orm';
import { db } from '../db/index';
import {
  quizAttempts,
  attemptAnswers,
  questions,
  quizzes,
  classrooms,
  classroomMembers,
} from '../db/schema/index';
import { quizService } from './quiz.service';
import {
  StudentHeatmapResponseDto,
  TopicMasteryDto,
  KnowledgeGapDto,
  DifficultyBreakdownDto,
  ClassroomHeatmapResponseDto,
  ClassroomTopicHeatmapDto,
  GenerateRemedialQuizInput,
  RemedialQuizResponseDto,
  MasteryLevel,
} from '@quiz-forge/shared';

export class AnalyticsError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export class AnalyticsService {
  /**
   * Computes personalized topic mastery heatmap, detected knowledge gaps,
   * difficulty breakdowns, and recent activity for an individual student.
   */
  async getStudentHeatmap(
    userId: string,
    database = db
  ): Promise<StudentHeatmapResponseDto> {
    // 1. Fetch all completed quiz attempts for the user
    const completedAttempts = database
      .select({
        attemptId: quizAttempts.id,
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        totalQuestions: quizAttempts.totalQuestions,
        correctCount: quizAttempts.correctCount,
        accuracyPercentage: quizAttempts.accuracyPercentage,
        completedAt: quizAttempts.completedAt,
        topic: quizzes.topic,
        difficulty: quizzes.difficulty,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(and(eq(quizAttempts.userId, userId), eq(quizAttempts.status, 'completed')))
      .orderBy(desc(quizAttempts.completedAt))
      .all();

    if (completedAttempts.length === 0) {
      return {
        summary: {
          totalAttempts: 0,
          totalQuestionsAnswered: 0,
          overallAccuracy: 0,
          masteredTopicsCount: 0,
          identifiedGapsCount: 0,
        },
        topicHeatmap: [],
        knowledgeGaps: [],
        difficultyBreakdown: [],
        recentActivity: [],
      };
    }

    const attemptIds = completedAttempts.map((a) => a.attemptId);

    // 2. Fetch all user answers across these attempts with question details
    const userAnswers = database
      .select({
        attemptId: attemptAnswers.attemptId,
        questionId: attemptAnswers.questionId,
        isCorrect: attemptAnswers.isCorrect,
        questionText: questions.questionText,
        explanation: questions.explanation,
        quizId: questions.quizId,
        topic: quizzes.topic,
        difficulty: quizzes.difficulty,
      })
      .from(attemptAnswers)
      .innerJoin(questions, eq(attemptAnswers.questionId, questions.id))
      .innerJoin(quizzes, eq(questions.quizId, quizzes.id))
      .where(inArray(attemptAnswers.attemptId, attemptIds))
      .all();

    // 3. Aggregate topic performance
    interface TopicStats {
      topic: string;
      total: number;
      correct: number;
      attemptsCount: number;
      lastAttemptAt: string | null;
      missedQuestions: Array<{
        questionId: string;
        questionText: string;
        explanation: string;
      }>;
    }

    const topicMap = new Map<string, TopicStats>();

    // Seed topic attempts count & date from completed attempts
    for (const a of completedAttempts) {
      const existing = topicMap.get(a.topic) || {
        topic: a.topic,
        total: 0,
        correct: 0,
        attemptsCount: 0,
        lastAttemptAt: a.completedAt,
        missedQuestions: [],
      };
      existing.attemptsCount += 1;
      if (!existing.lastAttemptAt || (a.completedAt && a.completedAt > existing.lastAttemptAt)) {
        existing.lastAttemptAt = a.completedAt;
      }
      topicMap.set(a.topic, existing);
    }

    // Accumulate question-level stats
    for (const ans of userAnswers) {
      const stats = topicMap.get(ans.topic);
      if (!stats) continue;
      stats.total += 1;
      if (ans.isCorrect === true) {
        stats.correct += 1;
      } else {
        // Collect unique missed questions
        if (!stats.missedQuestions.some((m) => m.questionId === ans.questionId)) {
          stats.missedQuestions.push({
            questionId: ans.questionId,
            questionText: ans.questionText,
            explanation: ans.explanation,
          });
        }
      }
    }

    // 4. Construct Topic Mastery DTOs
    const topicHeatmap: TopicMasteryDto[] = [];
    const knowledgeGaps: KnowledgeGapDto[] = [];

    let totalAnsweredCount = 0;
    let totalCorrectCount = 0;
    let masteredCount = 0;
    let gapsCount = 0;

    for (const [, stats] of topicMap.entries()) {
      const total = stats.total > 0 ? stats.total : 1;
      const accuracy = Math.round((stats.correct / total) * 100);

      totalAnsweredCount += stats.total;
      totalCorrectCount += stats.correct;

      let masteryLevel: MasteryLevel;
      if (accuracy >= 85) {
        masteryLevel = 'mastered';
        masteredCount += 1;
      } else if (accuracy >= 70) {
        masteryLevel = 'proficient';
      } else if (accuracy >= 50) {
        masteryLevel = 'developing';
      } else {
        masteryLevel = 'gap';
        gapsCount += 1;
      }

      topicHeatmap.push({
        topic: stats.topic,
        totalQuestions: stats.total,
        correctCount: stats.correct,
        accuracyPercentage: accuracy,
        masteryLevel,
        attemptsCount: stats.attemptsCount,
        lastAttemptAt: stats.lastAttemptAt,
      });

      // If accuracy is below 70% or there are missed questions, record knowledge gap
      if (accuracy < 70 || stats.missedQuestions.length > 0) {
        let priority: 'critical' | 'high' | 'moderate' = 'moderate';
        if (accuracy < 50 || stats.missedQuestions.length >= 3) {
          priority = 'critical';
        } else if (accuracy < 70 || stats.missedQuestions.length >= 2) {
          priority = 'high';
        }

        knowledgeGaps.push({
          topic: stats.topic,
          accuracyPercentage: accuracy,
          missedQuestionsCount: stats.missedQuestions.length,
          priority,
          sampleMissedQuestions: stats.missedQuestions.slice(0, 3),
        });
      }
    }

    // Sort heatmaps by priority / accuracy
    topicHeatmap.sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);
    knowledgeGaps.sort((a, b) => {
      const prioWeight = { critical: 3, high: 2, moderate: 1 };
      if (prioWeight[b.priority] !== prioWeight[a.priority]) {
        return prioWeight[b.priority] - prioWeight[a.priority];
      }
      return a.accuracyPercentage - b.accuracyPercentage;
    });

    // 5. Difficulty Breakdown
    const difficultyMap: Record<'easy' | 'medium' | 'hard', { total: number; correct: number }> = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };

    for (const ans of userAnswers) {
      const diff = ans.difficulty as 'easy' | 'medium' | 'hard';
      if (difficultyMap[diff]) {
        difficultyMap[diff].total += 1;
        if (ans.isCorrect === true) {
          difficultyMap[diff].correct += 1;
        }
      }
    }

    const difficultyBreakdown: DifficultyBreakdownDto[] = (['easy', 'medium', 'hard'] as const).map(
      (diff) => {
        const stats = difficultyMap[diff];
        const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        return {
          difficulty: diff,
          totalQuestions: stats.total,
          correctCount: stats.correct,
          accuracyPercentage: acc,
        };
      }
    );

    // 6. Recent Activity
    const recentActivity = completedAttempts.slice(0, 8).map((a) => ({
      attemptId: a.attemptId,
      quizId: a.quizId,
      topic: a.topic,
      difficulty: a.difficulty,
      accuracyPercentage: Math.round(a.accuracyPercentage ?? (a.totalQuestions > 0 ? ((a.score ?? 0) / a.totalQuestions) * 100 : 0)),
      completedAt: a.completedAt ?? new Date().toISOString(),
    }));

    const overallAccuracy =
      totalAnsweredCount > 0 ? Math.round((totalCorrectCount / totalAnsweredCount) * 100) : 0;

    return {
      summary: {
        totalAttempts: completedAttempts.length,
        totalQuestionsAnswered: totalAnsweredCount,
        overallAccuracy,
        masteredTopicsCount: masteredCount,
        identifiedGapsCount: gapsCount,
      },
      topicHeatmap,
      knowledgeGaps,
      difficultyBreakdown,
      recentActivity,
    };
  }

  /**
   * Computes classroom-level aggregate topic mastery matrix and identified
   * class-wide weak points for teacher inspection.
   */
  async getClassroomHeatmap(
    teacherId: string,
    classroomId: string,
    database = db
  ): Promise<ClassroomHeatmapResponseDto> {
    // 1. Verify classroom exists and teacher owns it
    const classroom = database
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId))
      .get();

    if (!classroom) {
      throw new AnalyticsError('Classroom not found.', 404, 'CLASSROOM_NOT_FOUND');
    }

    if (classroom.teacherId !== teacherId) {
      throw new AnalyticsError(
        'Forbidden: You are not the teacher of this classroom.',
        403,
        'FORBIDDEN'
      );
    }

    // 2. Fetch classroom members
    const members = database
      .select({ studentId: classroomMembers.studentId })
      .from(classroomMembers)
      .where(eq(classroomMembers.classroomId, classroomId))
      .all();

    const studentIds = members.map((m) => m.studentId);

    if (studentIds.length === 0) {
      return {
        classroomId,
        classroomName: classroom.name,
        totalStudents: 0,
        totalSubmissions: 0,
        averageClassAccuracy: 0,
        topicHeatmap: [],
        identifiedWeakPoints: [],
      };
    }

    // 3. Fetch completed attempts for all classroom students
    const studentAttempts = database
      .select({
        attemptId: quizAttempts.id,
        userId: quizAttempts.userId,
        quizId: quizAttempts.quizId,
        score: quizAttempts.score,
        totalQuestions: quizAttempts.totalQuestions,
        accuracyPercentage: quizAttempts.accuracyPercentage,
        topic: quizzes.topic,
      })
      .from(quizAttempts)
      .innerJoin(quizzes, eq(quizAttempts.quizId, quizzes.id))
      .where(
        and(
          inArray(quizAttempts.userId, studentIds),
          eq(quizAttempts.status, 'completed')
        )
      )
      .all();

    if (studentAttempts.length === 0) {
      return {
        classroomId,
        classroomName: classroom.name,
        totalStudents: studentIds.length,
        totalSubmissions: 0,
        averageClassAccuracy: 0,
        topicHeatmap: [],
        identifiedWeakPoints: [],
      };
    }

    // 4. Group by topic and calculate student mastery distributions
    interface ClassroomTopicStats {
      topic: string;
      studentScores: Map<string, number[]>; // studentId -> array of accuracies
    }

    const topicMap = new Map<string, ClassroomTopicStats>();

    for (const a of studentAttempts) {
      const stats = topicMap.get(a.topic) || {
        topic: a.topic,
        studentScores: new Map<string, number[]>(),
      };

      const acc = a.accuracyPercentage ?? (a.totalQuestions > 0 ? ((a.score ?? 0) / a.totalQuestions) * 100 : 0);
      const studentAccs = stats.studentScores.get(a.userId) || [];
      studentAccs.push(acc);
      stats.studentScores.set(a.userId, studentAccs);
      topicMap.set(a.topic, stats);
    }

    const topicHeatmap: ClassroomTopicHeatmapDto[] = [];
    const identifiedWeakPoints: Array<{
      topic: string;
      avgAccuracy: number;
      strugglingStudentsCount: number;
    }> = [];

    let classAccuracySum = 0;
    let classSubmissionCount = 0;

    for (const [, stats] of topicMap.entries()) {
      let topicAccuracySum = 0;
      let topicStudentCount = 0;
      const distribution = {
        mastered: 0,
        proficient: 0,
        developing: 0,
        gap: 0,
      };

      let strugglingCount = 0;

      for (const [, scores] of stats.studentScores.entries()) {
        const studentAvg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        topicAccuracySum += studentAvg;
        topicStudentCount += 1;

        if (studentAvg >= 85) {
          distribution.mastered += 1;
        } else if (studentAvg >= 70) {
          distribution.proficient += 1;
        } else if (studentAvg >= 50) {
          distribution.developing += 1;
          strugglingCount += 1;
        } else {
          distribution.gap += 1;
          strugglingCount += 1;
        }
      }

      const avgAccuracy =
        topicStudentCount > 0 ? Math.round(topicAccuracySum / topicStudentCount) : 0;

      classAccuracySum += topicAccuracySum;
      classSubmissionCount += topicStudentCount;

      topicHeatmap.push({
        topic: stats.topic,
        studentCount: topicStudentCount,
        avgAccuracy,
        distribution,
      });

      if (avgAccuracy < 70 || strugglingCount > 0) {
        identifiedWeakPoints.push({
          topic: stats.topic,
          avgAccuracy,
          strugglingStudentsCount: strugglingCount,
        });
      }
    }

    topicHeatmap.sort((a, b) => a.avgAccuracy - b.avgAccuracy);
    identifiedWeakPoints.sort((a, b) => a.avgAccuracy - b.avgAccuracy);

    const averageClassAccuracy =
      classSubmissionCount > 0 ? Math.round(classAccuracySum / classSubmissionCount) : 0;

    return {
      classroomId,
      classroomName: classroom.name,
      totalStudents: studentIds.length,
      totalSubmissions: studentAttempts.length,
      averageClassAccuracy,
      topicHeatmap,
      identifiedWeakPoints,
    };
  }

  /**
   * Generates a targeted remedial practice quiz focusing specifically on
   * the student's identified knowledge gaps and past missed concepts.
   */
  async generateRemedialQuiz(
    userId: string,
    input: GenerateRemedialQuizInput,
    database = db
  ): Promise<RemedialQuizResponseDto> {
    // 1. Analyze student's current heatmap to identify target knowledge gap
    const heatmap = await this.getStudentHeatmap(userId, database);

    let targetTopic = input.targetTopic?.trim();
    let sampleExplanations: string[] = [];

    if (!targetTopic) {
      if (heatmap.knowledgeGaps.length > 0) {
        // Automatically target the highest-priority knowledge gap
        const topGap = heatmap.knowledgeGaps[0]!;
        targetTopic = topGap.topic;
        sampleExplanations = topGap.sampleMissedQuestions.map(
          (q) => `"${q.questionText}": ${q.explanation}`
        );
      } else if (heatmap.topicHeatmap.length > 0) {
        // Fall back to the topic with lowest accuracy
        targetTopic = heatmap.topicHeatmap[0]!.topic;
      } else {
        // Default topic if user hasn't completed any quizzes yet
        targetTopic = 'General Knowledge and Problem Solving';
      }
    } else {
      // Find missed questions for the specified topic if available
      const matchingGap = heatmap.knowledgeGaps.find(
        (g) => g.topic.toLowerCase() === targetTopic!.toLowerCase()
      );
      if (matchingGap) {
        sampleExplanations = matchingGap.sampleMissedQuestions.map(
          (q) => `"${q.questionText}": ${q.explanation}`
        );
      }
    }

    // 2. Build pedagogical gap-remediation context
    const contextPrompt = sampleExplanations.length > 0
      ? `TARGETED REMEDIAL PRACTICE: The student previously struggled with the following key concepts in ${targetTopic}:\n- ${sampleExplanations.join('\n- ')}\nGenerate questions specifically designed to test, reinforce, and close these knowledge gaps with deep pedagogical step-by-step explanations.`
      : `TARGETED REMEDIAL PRACTICE: Reinforce core concepts in ${targetTopic} with progressive difficulty and clear didactic explanations.`;

    // 3. Generate and save the remedial quiz
    const generated = await quizService.generateAndSaveQuiz(
      userId,
      {
        topic: `${targetTopic} (Remedial Practice)`,
        questionCount: input.questionCount || 5,
        difficulty: input.difficulty || 'medium',
        provider: input.provider,
        context: contextPrompt,
      },
      database
    );

    return {
      quizId: generated.quizId,
      attemptId: generated.attemptId,
      topic: `${targetTopic} (Remedial Practice)`,
      targetedGaps: sampleExplanations.length > 0 ? sampleExplanations : [targetTopic],
      questionCount: generated.totalQuestions,
      focusSummary: `Remedial quiz generated to close knowledge gaps in ${targetTopic}.`,
    };
  }
}

export const analyticsService = new AnalyticsService();
