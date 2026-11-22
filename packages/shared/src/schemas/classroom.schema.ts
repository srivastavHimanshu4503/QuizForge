import { z } from 'zod';

export const createClassroomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Classroom name must be at least 2 characters')
    .max(100, 'Classroom name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

export const joinClassroomSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(4, 'Classroom join code must be at least 4 characters')
    .max(12, 'Classroom join code cannot exceed 12 characters'),
});

export const assignmentQuizTypeEnum = z.enum(['mcq', 'code_review']);
export type AssignmentQuizType = z.infer<typeof assignmentQuizTypeEnum>;

export const createAssignmentSchema = z.object({
  classroomId: z.string().uuid('Invalid classroom ID'),
  quizId: z.string().uuid('Invalid quiz ID'),
  quizType: assignmentQuizTypeEnum.default('mcq'),
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(150, 'Title cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  dueDate: z
    .string()
    .datetime({ message: 'Due date must be a valid ISO datetime' })
    .optional()
    .nullable(),
  maxAttempts: z
    .number()
    .int('Max attempts must be an integer')
    .min(1, 'Max attempts must be at least 1')
    .max(10, 'Max attempts cannot exceed 10')
    .default(1),
  timeLimitMinutes: z
    .number()
    .int('Time limit must be an integer')
    .min(1, 'Time limit must be at least 1 minute')
    .max(300, 'Time limit cannot exceed 300 minutes')
    .optional()
    .nullable(),
  showFeedbackImmediately: z.boolean().default(true),
});

export const updateAssignmentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, 'Title must be at least 2 characters')
    .max(150, 'Title cannot exceed 150 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, 'Description cannot exceed 500 characters')
    .optional()
    .nullable(),
  dueDate: z
    .string()
    .datetime({ message: 'Due date must be a valid ISO datetime' })
    .optional()
    .nullable(),
  maxAttempts: z
    .number()
    .int('Max attempts must be an integer')
    .min(1, 'Max attempts must be at least 1')
    .max(10, 'Max attempts cannot exceed 10')
    .optional(),
  timeLimitMinutes: z
    .number()
    .int('Time limit must be an integer')
    .min(1, 'Time limit must be at least 1 minute')
    .max(300, 'Time limit cannot exceed 300 minutes')
    .optional()
    .nullable(),
  showFeedbackImmediately: z.boolean().optional(),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;
export type JoinClassroomInput = z.infer<typeof joinClassroomSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;

export interface CreatedQuizSummaryDto {
  id: string;
  topic: string;
  difficulty: string;
  questionCount: number;
  quizType: 'mcq' | 'code_review';
  status?: string;
  shareCode?: string | null;
  createdAt: string;
}

export interface ClassroomAssignmentSummaryDto {
  id: string;
  quizId: string;
  quizType: AssignmentQuizType;
  title: string;
  description?: string | null;
  dueDate: string | null;
  maxAttempts: number;
  timeLimitMinutes?: number | null;
  shareCode?: string | null;
  createdAt: string;
}

export interface ClassroomDto {
  id: string;
  teacherId: string;
  teacherName: string;
  name: string;
  description?: string | null;
  code: string;
  memberCount: number;
  assignmentCount: number;
  createdAt: string;
}

export interface ClassroomMemberDto {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  joinedAt: string;
}

export interface AssignmentDto {
  id: string;
  classroomId: string;
  classroomName: string;
  quizId: string;
  quizType: AssignmentQuizType;
  quizTopic: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  maxAttempts: number;
  timeLimitMinutes?: number | null;
  showFeedbackImmediately: boolean;
  myAttemptsCount: number;
  myBestScore?: number | null;
  isCompleted: boolean;
  isOverdue: boolean;
  createdAt: string;
}

export interface StudentSubmissionDto {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptsCount: number;
  bestScore: number | null;
  lastAttemptAt: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
}
