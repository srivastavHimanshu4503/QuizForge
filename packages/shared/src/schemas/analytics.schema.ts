import { z } from 'zod';

export type MasteryLevel = 'mastered' | 'proficient' | 'developing' | 'gap';

export interface TopicMasteryDto {
  topic: string;
  totalQuestions: number;
  correctCount: number;
  accuracyPercentage: number;
  masteryLevel: MasteryLevel;
  attemptsCount: number;
  lastAttemptAt: string | null;
}

export interface DifficultyBreakdownDto {
  difficulty: 'easy' | 'medium' | 'hard';
  totalQuestions: number;
  correctCount: number;
  accuracyPercentage: number;
}

export interface KnowledgeGapDto {
  topic: string;
  accuracyPercentage: number;
  missedQuestionsCount: number;
  priority: 'critical' | 'high' | 'moderate';
  sampleMissedQuestions: Array<{
    questionId: string;
    questionText: string;
    explanation: string;
  }>;
}

export interface StudentHeatmapResponseDto {
  summary: {
    totalAttempts: number;
    totalQuestionsAnswered: number;
    overallAccuracy: number;
    masteredTopicsCount: number;
    identifiedGapsCount: number;
  };
  topicHeatmap: TopicMasteryDto[];
  knowledgeGaps: KnowledgeGapDto[];
  difficultyBreakdown: DifficultyBreakdownDto[];
  recentActivity: Array<{
    attemptId: string;
    quizId: string;
    topic: string;
    difficulty: string;
    accuracyPercentage: number;
    completedAt: string;
  }>;
}

export interface ClassroomTopicHeatmapDto {
  topic: string;
  studentCount: number;
  avgAccuracy: number;
  distribution: {
    mastered: number;
    proficient: number;
    developing: number;
    gap: number;
  };
}

export interface ClassroomHeatmapResponseDto {
  classroomId: string;
  classroomName: string;
  totalStudents: number;
  totalSubmissions: number;
  averageClassAccuracy: number;
  topicHeatmap: ClassroomTopicHeatmapDto[];
  identifiedWeakPoints: Array<{
    topic: string;
    avgAccuracy: number;
    strugglingStudentsCount: number;
  }>;
}

export const generateRemedialQuizSchema = z.object({
  targetTopic: z.string().optional(),
  questionCount: z.number().int().min(1).max(20).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  provider: z.string().optional(),
});

export type GenerateRemedialQuizInput = z.infer<typeof generateRemedialQuizSchema>;

export interface RemedialQuizResponseDto {
  quizId: string;
  attemptId: string;
  topic: string;
  targetedGaps: string[];
  questionCount: number;
  focusSummary: string;
}
