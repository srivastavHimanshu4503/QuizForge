import { z } from 'zod';

export const difficultyEnum = z.enum(['easy', 'medium', 'hard', 'mixed']);
export type QuizDifficulty = z.infer<typeof difficultyEnum>;

export const choiceIdEnum = z.enum(['A', 'B', 'C', 'D']);
export type ChoiceId = z.infer<typeof choiceIdEnum>;

export const generateQuizSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(2, 'Topic must be at least 2 characters')
    .max(255, 'Topic cannot exceed 255 characters'),
  questionCount: z
    .number()
    .int('Question count must be an integer')
    .min(1, 'Minimum question count is 1')
    .max(30, 'Maximum question count is 30')
    .default(5),
  difficulty: difficultyEnum.default('mixed'),
  provider: z.string().optional(),
  context: z.string().optional(),
});

export const rawChoiceSchema = z.object({
  choice_id: choiceIdEnum,
  option_text: z.string().trim().min(1, 'Option text cannot be empty'),
});

export const generatedQuestionSchema = z
  .object({
    question_id: z.string().min(1),
    question: z.string().trim().min(5, 'Question text must be at least 5 characters'),
    choices: z.array(rawChoiceSchema).length(4, 'Each question must have exactly 4 choices'),
    correct_answer_id: choiceIdEnum,
    explanation: z.string().trim().min(5, 'Explanation must be at least 5 characters'),
  })
  .refine(
    (q) => {
      const choiceIds = new Set(q.choices.map((c) => c.choice_id));
      return choiceIds.size === 4 && choiceIds.has('A') && choiceIds.has('B') && choiceIds.has('C') && choiceIds.has('D');
    },
    { message: 'Choices must contain unique IDs A, B, C, and D' }
  )
  .refine(
    (q) => {
      const uniqueTexts = new Set(q.choices.map((c) => c.option_text.toLowerCase()));
      return uniqueTexts.size === 4;
    },
    { message: 'Option texts must be distinct' }
  );

export const generatedQuizResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1),
});

export const clientChoiceSchema = z.object({
  choice_id: choiceIdEnum,
  option_text: z.string(),
});

export const clientQuestionSchema = z.object({
  question_id: z.string(),
  question: z.string(),
  choices: z.array(clientChoiceSchema).length(4),
});

export const quizMetadataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.string(),
  difficulty: difficultyEnum,
  questionCount: z.number().int(),
  aiModel: z.string(),
  createdAt: z.string(),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type RawChoice = z.infer<typeof rawChoiceSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuizResponse = z.infer<typeof generatedQuizResponseSchema>;
export type ClientChoice = z.infer<typeof clientChoiceSchema>;
export type ClientQuestion = z.infer<typeof clientQuestionSchema>;
export type QuizMetadata = z.infer<typeof quizMetadataSchema>;
