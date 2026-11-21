import { GeneratedQuestion, QuizDifficulty } from '@quiz-forge/shared';

export interface GenerateQuestionsParams {
  topic: string;
  questionCount: number;
  difficulty: QuizDifficulty;
  context?: string;
  image?: {
    base64: string;
    mimeType: string;
  };
}

export interface IAIQuestionGenerator {
  generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestion[]>;
}

export type AIErrorCode =
  | 'AI_RATE_LIMIT'
  | 'AI_TIMEOUT'
  | 'AI_SERVICE_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'AI_AUTHENTICATION_ERROR'
  | 'AI_PROVIDER_ERROR';

export class AIProviderError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public statusCode: number = 502,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
