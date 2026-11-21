import { GeneratedQuestion } from '@quiz-forge/shared';
import { GenerateQuestionsParams, IAIQuestionGenerator, AIProviderError } from './ai.interface';

export interface MockProviderOptions {
  simulateDelayMs?: number;
  simulateRateLimit?: boolean;
  simulateTimeout?: boolean;
  simulateInvalidResponse?: boolean;
  simulateDuplicateOptions?: boolean;
  failureCountBeforeSuccess?: number;
}

export class MockQuestionGenerator implements IAIQuestionGenerator {
  private failureCounter = 0;

  constructor(private options: MockProviderOptions = {}) {}

  setOptions(options: MockProviderOptions) {
    this.options = { ...this.options, ...options };
    this.failureCounter = 0;
  }

  async generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestion[]> {
    const { topic, questionCount, difficulty } = params;

    // Simulate transient failure that succeeds after N attempts
    if (
      this.options.failureCountBeforeSuccess &&
      this.failureCounter < this.options.failureCountBeforeSuccess
    ) {
      this.failureCounter++;
      throw new AIProviderError(
        'Simulated transient 429 rate limit exceeded',
        'AI_RATE_LIMIT',
        429
      );
    }

    if (this.options.simulateRateLimit) {
      throw new AIProviderError(
        'Gemini API rate limit reached. Please retry shortly.',
        'AI_RATE_LIMIT',
        429
      );
    }

    if (this.options.simulateTimeout) {
      throw new AIProviderError(
        'Request to Gemini API timed out.',
        'AI_TIMEOUT',
        504
      );
    }

    if (this.options.simulateDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.simulateDelayMs));
    }

    if (this.options.simulateDuplicateOptions) {
      return [
        {
          question_id: 'mock_q_dup',
          question: `Duplicate test for ${topic}`,
          choices: [
            { choice_id: 'A', option_text: 'Same option text' },
            { choice_id: 'B', option_text: 'Same option text' }, // duplicate text!
            { choice_id: 'C', option_text: 'Option C' },
            { choice_id: 'D', option_text: 'Option D' },
          ],
          correct_answer_id: 'A',
          explanation: 'Testing duplicate rejection.',
        },
      ];
    }

    if (this.options.simulateInvalidResponse) {
      // Missing choices or invalid correct answer id
      return [
        {
          question_id: 'mock_q_invalid',
          question: `Invalid test for ${topic}`,
          choices: [{ choice_id: 'A' as const, option_text: 'Only one choice' }],
          correct_answer_id: 'Z' as unknown as 'A',
          explanation: 'Invalid',
        },
      ];
    }

    // Generate valid questions
    const questions: GeneratedQuestion[] = [];

    for (let i = 1; i <= questionCount; i++) {
      const qIndex = String(i).padStart(3, '0');
      const correctChoiceId = (['A', 'B', 'C', 'D'][i % 4] ?? 'A') as 'A' | 'B' | 'C' | 'D';

      questions.push({
        question_id: `q_${qIndex}`,
        question: `Question ${i}: In the context of ${topic} (${difficulty}), which of the following statements is accurate?`,
        choices: [
          {
            choice_id: 'A',
            option_text: `Option A provides a primary foundational insight into ${topic} principle #${i}.`,
          },
          {
            choice_id: 'B',
            option_text: `Option B posits an alternative perspective regarding ${topic} architecture #${i}.`,
          },
          {
            choice_id: 'C',
            option_text: `Option C describes a specialized technique utilized in ${topic} design #${i}.`,
          },
          {
            choice_id: 'D',
            option_text: `Option D outlines a standard convention applied across ${topic} workflows #${i}.`,
          },
        ],
        correct_answer_id: correctChoiceId,
        explanation: `Choice ${correctChoiceId} is correct because it accurately adheres to the core mechanics of ${topic} at the ${difficulty} difficulty tier.`,
      });
    }

    return questions;
  }
}
