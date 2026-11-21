import { z } from 'zod';

export const llmProviderEnum = z.enum(['groq', 'nvidia', 'gemini', 'mock']);
export type LLMProviderType = z.infer<typeof llmProviderEnum>;

export const codeDifficultyEnum = z.enum(['easy', 'medium', 'hard', 'mixed']);
export type CodeDifficulty = z.infer<typeof codeDifficultyEnum>;

export const generateCodeQuizSchema = z.object({
  repoUrl: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .refine((url) => /github\.com\/[\w.-]+\/[\w.-]+/i.test(url), {
      message: 'Must be a valid GitHub repository URL (e.g., https://github.com/owner/repo)',
    }),
  questionCount: z
    .number()
    .int('Question count must be an integer')
    .min(3, 'Minimum 3 questions')
    .max(15, 'Maximum 15 questions')
    .default(5),
  subfolder: z.string().trim().optional(),
  llmProvider: llmProviderEnum.default('groq'),
  focusAreas: z.string().trim().max(500).optional(),
});

export const codeSnippetSchema = z.object({
  file_path: z.string(),
  start_line: z.number().int().optional(),
  end_line: z.number().int().optional(),
  code: z.string(),
});

export const generatedCodeQuestionSchema = z.object({
  question_id: z.string(),
  question: z.string().min(10, 'Question must be at least 10 characters'),
  code_snippet: codeSnippetSchema,
  difficulty: z.enum(['easy', 'medium', 'hard']),
  expected_concepts: z.array(z.string()).min(1, 'At least one expected concept is required'),
});

export const generatedCodeQuizResponseSchema = z.object({
  questions: z.array(generatedCodeQuestionSchema).min(1),
});

export const submitCodeAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z
    .string()
    .trim()
    .min(5, 'Answer must be at least 5 characters')
    .max(5000, 'Answer cannot exceed 5000 characters'),
});

export const answerEvaluationSchema = z.object({
  score: z.number().min(0).max(10),
  accuracy_score: z.number().min(0).max(4),
  depth_score: z.number().min(0).max(3),
  completeness_score: z.number().min(0).max(3),
  feedback: z.string().min(5),
  key_concepts_identified: z.array(z.string()),
  key_concepts_missed: z.array(z.string()),
});

export const activeCodeQuestionSchema = z.object({
  id: z.string().uuid(),
  questionOrder: z.number().int(),
  questionText: z.string(),
  codeSnippetPath: z.string(),
  codeSnippetContent: z.string(),
  codeSnippetStartLine: z.number().int().nullable().optional(),
  codeSnippetEndLine: z.number().int().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  userAnswer: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  feedback: z.string().nullable().optional(),
  evaluatedAt: z.string().nullable().optional(),
});

export const activeCodeAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  codeQuizId: z.string().uuid(),
  repoUrl: z.string(),
  repoOwner: z.string(),
  repoName: z.string(),
  status: z.enum(['in_progress', 'completed']),
  totalQuestions: z.number().int(),
  answeredQuestions: z.number().int(),
  totalScore: z.number().nullable(),
  maxPossibleScore: z.number(),
  questions: z.array(activeCodeQuestionSchema),
});

export type GenerateCodeQuizInput = z.infer<typeof generateCodeQuizSchema>;
export type CodeSnippet = z.infer<typeof codeSnippetSchema>;
export type GeneratedCodeQuestion = z.infer<typeof generatedCodeQuestionSchema>;
export type GeneratedCodeQuizResponse = z.infer<typeof generatedCodeQuizResponseSchema>;
export type SubmitCodeAnswerInput = z.infer<typeof submitCodeAnswerSchema>;
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;
export type ActiveCodeQuestion = z.infer<typeof activeCodeQuestionSchema>;
export type ActiveCodeAttempt = z.infer<typeof activeCodeAttemptSchema>;
