import {
  GeneratedQuestion,
  GenerateQuizInput,
  generateQuizSchema,
  generatedQuizResponseSchema,
} from '@quiz-forge/shared';
import { env } from '../../config/env';
import { IAIQuestionGenerator, AIProviderError } from './ai.interface';
import { MockQuestionGenerator } from './mock.provider';
import { LLMQuestionGenerator } from './llm-question.generator';
import { providerRegistry } from '../llm/provider-registry';

export class AIService {
  private provider: IAIQuestionGenerator;

  constructor(customProvider?: IAIQuestionGenerator) {
    if (customProvider) {
      this.provider = customProvider;
    } else if (env.NODE_ENV === 'test') {
      // In tests, default to Mock provider
      this.provider = new MockQuestionGenerator();
    } else {
      // Production / runtime: use unified LLM provider registry default
      const defaultLLM = providerRegistry.getDefaultProvider();
      this.provider = new LLMQuestionGenerator(defaultLLM);
    }
  }

  setProvider(provider: IAIQuestionGenerator) {
    this.provider = provider;
  }

  getProvider(): IAIQuestionGenerator {
    return this.provider;
  }

  async generateQuizQuestions(
    input: GenerateQuizInput,
    preferredProvider?: string
  ): Promise<GeneratedQuestion[]> {
    // 1. Validate generation parameters
    const params = generateQuizSchema.parse(input);

    // 2. Select provider: either explicitly requested, or current provider
    let activeGenerator = this.provider;
    const requestedProvider = preferredProvider || input.provider;
    if (requestedProvider && requestedProvider.trim().length > 0) {
      const llm = providerRegistry.get(requestedProvider);
      activeGenerator = new LLMQuestionGenerator(llm);
    }

    // 3. Delegate to AI Provider
    const rawQuestions = await activeGenerator.generateQuestions({
      topic: params.topic,
      questionCount: params.questionCount,
      difficulty: params.difficulty,
      context: params.context,
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
