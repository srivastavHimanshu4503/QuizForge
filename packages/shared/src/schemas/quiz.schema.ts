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
  image: z
    .object({
      base64: z.string(),
      mimeType: z.string(),
    })
    .optional(),
});

export const rawChoiceSchema = z.object({
  choice_id: choiceIdEnum,
  option_text: z.string().trim().min(1, 'Option text cannot be empty'),
});

export function normalizeRawQuestion(raw: unknown, fallbackIndex = 0): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const item = raw as Record<string, unknown>;

  const question_id = item.question_id ?? item.id ?? `q_${fallbackIndex + 1}`;
  const question = item.question ?? item.question_text ?? item.prompt ?? item.text;

  // Normalize choices: handle strings, key-value objects, or alternative property names
  const choiceLetters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const rawChoices = item.choices ?? item.options ?? item.answers;
  let parsedChoices: unknown = rawChoices;

  if (Array.isArray(rawChoices)) {
    parsedChoices = rawChoices.map((c: unknown, idx: number) => {
      const letter = choiceLetters[idx] || 'A';
      if (typeof c === 'string') {
        const cleanText = c.replace(/^[A-Da-d][\)\.:\-]\s*/, '').trim() || c.trim();
        return { choice_id: letter, option_text: cleanText };
      }
      if (typeof c === 'object' && c !== null) {
        const obj = c as Record<string, unknown>;
        const rawId = obj.choice_id ?? obj.id ?? obj.choice ?? obj.label ?? letter;
        const rawText = obj.option_text ?? obj.text ?? obj.option ?? obj.value ?? obj.answer;
        return {
          choice_id: typeof rawId === 'string' ? rawId.toUpperCase().trim() : rawId,
          option_text: typeof rawText === 'string' ? rawText.trim() : rawText,
        };
      }
      return c;
    });
  } else if (typeof rawChoices === 'object' && rawChoices !== null) {
    const obj = rawChoices as Record<string, unknown>;
    const extracted: Array<{ choice_id: string; option_text: string }> = [];
    for (const letter of choiceLetters) {
      const val = obj[letter] ?? obj[letter.toLowerCase()];
      if (val !== undefined) {
        extracted.push({ choice_id: letter, option_text: String(val).trim() });
      }
    }
    if (extracted.length > 0) {
      parsedChoices = extracted;
    }
  }

  // Normalize correct_answer_id (handles alternative keys and letter extraction like "B)")
  let correct_answer_id =
    item.correct_answer_id ??
    item.correctAnswerId ??
    item.correct_answer ??
    item.correctAnswer ??
    item.answer ??
    item.correct ??
    item.correct_choice ??
    item.correctOption;

  if (typeof correct_answer_id === 'string') {
    const match = correct_answer_id.trim().toUpperCase().match(/^[A-D]/);
    if (match) {
      correct_answer_id = match[0];
    }
  }

  // Normalize explanation
  const explanation =
    item.explanation ??
    item.reason ??
    item.reasoning ??
    item.rationale ??
    item.justification ??
    item.description;

  return {
    ...item,
    question_id,
    question,
    choices: parsedChoices,
    correct_answer_id,
    explanation,
  };
}

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

export const generatedQuizResponseSchema = z.preprocess(
  (input: unknown) => {
    if (typeof input !== 'object' || input === null) return input;
    const obj = input as Record<string, unknown>;
    const questions = Array.isArray(obj.questions) ? obj.questions : [];
    return {
      ...obj,
      questions: questions.map((q, idx) => normalizeRawQuestion(q, idx)),
    };
  },
  z.object({
    questions: z.array(generatedQuestionSchema).min(1),
  })
);

export const clientChoiceSchema = z.object({
  choice_id: choiceIdEnum,
  option_text: z.string(),
});

export const clientQuestionSchema = z.object({
  question_id: z.string(),
  question: z.string(),
  choices: z.array(clientChoiceSchema).length(4),
});

export const quizStatusEnum = z.enum(['draft', 'published']);
export type QuizStatus = z.infer<typeof quizStatusEnum>;

export const studioChoiceSchema = z.object({
  choice_id: choiceIdEnum,
  option_text: z.string().trim().min(1, 'Choice text cannot be empty'),
});
export type StudioChoice = z.infer<typeof studioChoiceSchema>;

export const studioQuestionSchema = z
  .object({
    id: z.string().optional(),
    questionText: z.string().trim().min(5, 'Question text must be at least 5 characters'),
    choices: z.array(studioChoiceSchema).length(4, 'Each question must have exactly 4 choices'),
    correctChoiceId: choiceIdEnum,
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
export type StudioQuestion = z.infer<typeof studioQuestionSchema>;

export const updateQuizStudioSchema = z.object({
  topic: z.string().trim().min(2).max(255).optional(),
  difficulty: difficultyEnum.optional(),
  isPublic: z.boolean().optional(),
  questions: z.array(studioQuestionSchema).min(1, 'Quiz must have at least 1 question'),
});
export type UpdateQuizStudioInput = z.infer<typeof updateQuizStudioSchema>;

export const quizMetadataSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  topic: z.string(),
  difficulty: difficultyEnum,
  questionCount: z.number().int(),
  aiModel: z.string(),
  status: quizStatusEnum.default('published'),
  isPublic: z.boolean().default(false),
  shareCode: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const quizStudioPayloadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  topic: z.string(),
  difficulty: difficultyEnum,
  questionCount: z.number().int(),
  aiModel: z.string(),
  status: quizStatusEnum,
  isPublic: z.boolean(),
  shareCode: z.string().nullable(),
  createdAt: z.string(),
  questions: z.array(studioQuestionSchema),
});
export type QuizStudioPayload = z.infer<typeof quizStudioPayloadSchema>;

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type RawChoice = z.infer<typeof rawChoiceSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuizResponse = z.infer<typeof generatedQuizResponseSchema>;
export type ClientChoice = z.infer<typeof clientChoiceSchema>;
export type ClientQuestion = z.infer<typeof clientQuestionSchema>;
export type QuizMetadata = z.infer<typeof quizMetadataSchema>;
