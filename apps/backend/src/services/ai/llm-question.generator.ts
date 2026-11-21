import { GeneratedQuestion } from '@quiz-forge/shared';
import { GenerateQuestionsParams, IAIQuestionGenerator, AIProviderError } from './ai.interface';
import { ILLMProvider, LLMProviderError } from '../llm/llm.interface';
import { buildQuizPrompt } from './prompts';

export class LLMQuestionGenerator implements IAIQuestionGenerator {
  constructor(private provider: ILLMProvider) {}

  getProviderName(): string {
    return this.provider.name;
  }

  async generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestion[]> {
    const userPrompt = buildQuizPrompt(params);

    const systemPrompt = `You are an expert educational assessment author and psychometrician.
Your task is to generate high-quality, rigorous multiple-choice questions (MCQs) strictly adhering to the requested topic, question count, and difficulty.

Return ONLY a valid JSON object strictly matching this schema:
{
  "questions": [
    {
      "question_id": "q1",
      "question": "Question text...",
      "choices": [
        { "choice_id": "A", "option_text": "Choice A text" },
        { "choice_id": "B", "option_text": "Choice B text" },
        { "choice_id": "C", "option_text": "Choice C text" },
        { "choice_id": "D", "option_text": "Choice D text" }
      ],
      "correct_answer_id": "A",
      "explanation": "Detailed pedagogical explanation of why this answer is correct..."
    }
  ]
}

Strict Rules:
1. Generate EXACTLY ${params.questionCount} questions.
2. Each question MUST have exactly 4 choices labeled 'A', 'B', 'C', 'D'.
3. Every option text within a single question must be distinct and non-empty.
4. 'correct_answer_id' must be one of 'A', 'B', 'C', 'D'.
5. Explanations must be thorough and educational.
6. Return pure JSON without markdown backticks or extra commentary.`;

    try {
      const response = await this.provider.chatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          responseFormat: { type: 'json_object' },
          temperature: 0.7,
        }
      );

      let text = response.content.trim();
      // Remove any leading/trailing markdown code fences if present
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }

      let parsed: { questions?: GeneratedQuestion[] };
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        throw new AIProviderError(
          `Failed to parse JSON response from ${this.provider.name}: ${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)}`,
          'AI_INVALID_RESPONSE',
          502,
          { rawContent: text }
        );
      }

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new AIProviderError(
          `${this.provider.name} response format is missing 'questions' array.`,
          'AI_INVALID_RESPONSE',
          502,
          parsed
        );
      }

      return parsed.questions;
    } catch (err: unknown) {
      if (err instanceof AIProviderError) {
        throw err;
      }

      if (err instanceof LLMProviderError) {
        if (err.statusCode === 429 || err.code === 'RATE_LIMIT') {
          throw new AIProviderError(err.message, 'AI_RATE_LIMIT', 429, err);
        }
        if (err.statusCode === 504 || err.code === 'TIMEOUT') {
          throw new AIProviderError(err.message, 'AI_TIMEOUT', 504, err);
        }
        if (err.statusCode === 503 || err.code === 'SERVICE_UNAVAILABLE') {
          throw new AIProviderError(err.message, 'AI_SERVICE_UNAVAILABLE', 503, err);
        }
        if (err.statusCode === 401 || err.code === 'AUTHENTICATION_ERROR') {
          throw new AIProviderError(err.message, 'AI_AUTHENTICATION_ERROR', 401, err);
        }
        throw new AIProviderError(err.message, 'AI_PROVIDER_ERROR', err.statusCode || 502, err);
      }

      const msg = err instanceof Error ? err.message : String(err);
      throw new AIProviderError(`Unexpected error generating questions: ${msg}`, 'AI_PROVIDER_ERROR', 502, err);
    }
  }
}
