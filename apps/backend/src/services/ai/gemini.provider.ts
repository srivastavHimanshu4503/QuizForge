import { GoogleGenAI, Type } from '@google/genai';
import { GeneratedQuestion } from '@quiz-forge/shared';
import { env } from '../../config/env';
import { GenerateQuestionsParams, IAIQuestionGenerator, AIProviderError } from './ai.interface';
import { buildQuizPrompt } from './prompts';

export class GeminiQuestionGenerator implements IAIQuestionGenerator {
  private client: GoogleGenAI;
  private modelName: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    maxRetries?: number;
    timeoutMs?: number;
  }) {
    const key = options?.apiKey || env.GEMINI_API_KEY;
    this.client = new GoogleGenAI({
      apiKey: key,
      apiVersion: 'v1beta',
    });
    this.modelName = options?.model || env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.maxRetries = options?.maxRetries ?? 3;
    this.timeoutMs = options?.timeoutMs ?? 30000;
  }

  async generateQuestions(params: GenerateQuestionsParams): Promise<GeneratedQuestion[]> {
    const prompt = buildQuizPrompt(params);

    const schema = {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question_id: { type: Type.STRING },
              question: { type: Type.STRING },
              choices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    choice_id: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
                    option_text: { type: Type.STRING },
                  },
                  required: ['choice_id', 'option_text'],
                },
              },
              correct_answer_id: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
              explanation: { type: Type.STRING },
            },
            required: ['question_id', 'question', 'choices', 'correct_answer_id', 'explanation'],
          },
        },
      },
      required: ['questions'],
    };

    let attempt = 0;
    let delay = 500;

    while (attempt <= this.maxRetries) {
      try {
        const result = await this.callGeminiWithTimeout(prompt, schema);
        return result;
      } catch (err: unknown) {
        attempt++;

        const isRateLimit =
          err instanceof AIProviderError && err.code === 'AI_RATE_LIMIT';
        const isTransient =
          err instanceof AIProviderError &&
          (err.code === 'AI_SERVICE_UNAVAILABLE' || err.code === 'AI_RATE_LIMIT');

        if (attempt <= this.maxRetries && (isRateLimit || isTransient)) {
          console.warn(
            `[GeminiProvider] Transient error on attempt ${attempt}. Retrying in ${delay}ms...`
          );
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2;
          continue;
        }

        throw err;
      }
    }

    throw new AIProviderError(
      'Maximum retries exceeded communicating with Gemini API.',
      'AI_PROVIDER_ERROR',
      502
    );
  }

  private async callGeminiWithTimeout(
    prompt: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: any
  ): Promise<GeneratedQuestion[]> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new AIProviderError(
            `Gemini API request timed out after ${this.timeoutMs}ms`,
            'AI_TIMEOUT',
            504
          )
        );
      }, this.timeoutMs);
    });

    const generatePromise = (async () => {
      try {
        const response = await this.client.models.generateContent({
          model: this.modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.7,
          },
        });

        const text = response.text;
        if (!text) {
          throw new AIProviderError(
            'Gemini API returned an empty response.',
            'AI_INVALID_RESPONSE',
            502
          );
        }

        let parsed: { questions?: GeneratedQuestion[] };
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr) {
          throw new AIProviderError(
            'Failed to parse JSON response from Gemini API.',
            'AI_INVALID_RESPONSE',
            502,
            jsonErr
          );
        }

        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new AIProviderError(
            'Gemini response format is missing questions array.',
            'AI_INVALID_RESPONSE',
            502
          );
        }

        return parsed.questions;
      } catch (err: unknown) {
        if (err instanceof AIProviderError) {
          throw err;
        }

        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
          throw new AIProviderError(
            'Gemini API rate limit exceeded. Please wait a moment and try again.',
            'AI_RATE_LIMIT',
            429
          );
        }

        if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('api key')) {
          throw new AIProviderError(
            'Invalid or missing Gemini API key.',
            'AI_AUTHENTICATION_ERROR',
            401
          );
        }

        if (msg.includes('503') || msg.toLowerCase().includes('unavailable')) {
          throw new AIProviderError(
            'Gemini service temporarily unavailable. Please retry.',
            'AI_SERVICE_UNAVAILABLE',
            503
          );
        }

        throw new AIProviderError(
          `Gemini API request failed: ${msg}`,
          'AI_PROVIDER_ERROR',
          502,
          err
        );
      }
    })();

    try {
      return await Promise.race([generatePromise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}
