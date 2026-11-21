import {
  GeneratedQuestion,
  GenerateQuizInput,
  generateQuizSchema,
  generatedQuizResponseSchema,
} from '@quiz-forge/shared';
import { env } from '../../config/env';
import { IAIQuestionGenerator, AIProviderError } from './ai.interface';
import { GeminiQuestionGenerator } from './gemini.provider';
import { MockQuestionGenerator } from './mock.provider';

export class AIService {
  private provider: IAIQuestionGenerator;

  constructor(customProvider?: IAIQuestionGenerator) {
    if (customProvider) {
      this.provider = customProvider;
    } else if (
      env.NODE_ENV === 'test' ||
      !env.GEMINI_API_KEY ||
      env.GEMINI_API_KEY === 'dev_gemini_key'
    ) {
      // In tests or when key is dummy/missing, default to Mock provider
      this.provider = new MockQuestionGenerator();
    } else {
      this.provider = new GeminiQuestionGenerator();
    }
  }

  setProvider(provider: IAIQuestionGenerator) {
    this.provider = provider;
  }

  getProvider(): IAIQuestionGenerator {
    return this.provider;
  }

  async generateQuizQuestions(input: GenerateQuizInput): Promise<GeneratedQuestion[]> {
    // 1. Validate generation parameters
    const params = generateQuizSchema.parse(input);

    // 2. Delegate to AI Provider
    const rawQuestions = await this.provider.generateQuestions({
      topic: params.topic,
      questionCount: params.questionCount,
      difficulty: params.difficulty,
    });

    // 3. Strict Runtime Schema Validation
    const validationResult = generatedQuizResponseSchema.safeParse({
      questions: rawQuestions,
    });

    if (!validationResult.success) {
      throw new AIProviderError(
        'Generated questions failed strict data contract validation.',
        'AI_INVALID_RESPONSE',
        502,
        validationResult.error.format()
      );
    }

    const questions = validationResult.data.questions;

    // 4. Cross-Question Duplicate Text Guard
    const questionTexts = new Set<string>();
    for (const q of questions) {
      const normalized = q.question.trim().toLowerCase();
      if (questionTexts.has(normalized)) {
        throw new AIProviderError(
          'AI generated duplicate questions within the same quiz batch.',
          'AI_INVALID_RESPONSE',
          502
        );
      }
      questionTexts.add(normalized);
    }

    return questions;
  }
}

export const aiService = new AIService();
