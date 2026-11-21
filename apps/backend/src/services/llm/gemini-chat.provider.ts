import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env';
import {
  ChatMessage,
  ILLMProvider,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderError,
} from './llm.interface';

export class GeminiChatProvider implements ILLMProvider {
  readonly name = 'gemini';
  readonly defaultModel: string;
  private client: GoogleGenAI;
  private apiKey?: string;

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.apiKey = options?.apiKey !== undefined ? options.apiKey : env.GEMINI_API_KEY;
    this.defaultModel = options?.defaultModel || env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.client = new GoogleGenAI({
      apiKey: this.apiKey || 'dev_gemini_key',
      apiVersion: 'v1beta',
    });
  }

  get isAvailable(): boolean {
    return Boolean(
      this.apiKey &&
        this.apiKey.trim().length > 0 &&
        this.apiKey !== 'dev_gemini_key' &&
        !this.apiKey.startsWith('your_gemini_')
    );
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    const model = options?.model || this.defaultModel;
    const timeoutMs = options?.timeoutMs ?? 45000;

    // Separate system message if present
    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystemMsgs = messages.filter((m) => m.role !== 'system');

    // Build prompt text from messages
    let prompt = '';
    if (systemMsg) {
      prompt += `System Instructions:\n${systemMsg.content}\n\n`;
    }
    for (const msg of nonSystemMsgs) {
      prompt += `${msg.role.toUpperCase()}:\n${msg.content}\n\n`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
        temperature: options?.temperature ?? 0.3,
        abortSignal: controller.signal,
      };

      if (options?.responseFormat?.type === 'json_object') {
        config.responseMimeType = 'application/json';
      }

      if (systemMsg?.content) {
        config.systemInstruction = systemMsg.content;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let contents: any;
      if (options?.image) {
        const textContent = nonSystemMsgs.length > 0 ? nonSystemMsgs.map((m) => m.content).join('\n\n') : prompt;
        contents = [
          {
            parts: [
              { text: textContent },
              {
                inlineData: {
                  mimeType: options.image.mimeType,
                  data: options.image.base64,
                },
              },
            ],
          },
        ];
      } else {
        contents = nonSystemMsgs.length > 0 ? nonSystemMsgs.map((m) => m.content).join('\n\n') : prompt;
      }

      const generatePromise = this.client.models.generateContent({
        model,
        contents,
        config,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(
            new LLMProviderError(
              `Gemini request timed out after ${timeoutMs}ms.`,
              this.name,
              'TIMEOUT',
              504
            )
          );
        });
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      const content = response.text;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new LLMProviderError(
          'Gemini returned an empty completion.',
          this.name,
          'INVALID_RESPONSE',
          502
        );
      }

      return {
        content,
        model,
        provider: this.name,
      };
    } catch (err: unknown) {
      if (err instanceof LLMProviderError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        throw new LLMProviderError(
          'Gemini rate limit exceeded. Please wait a moment and retry.',
          this.name,
          'RATE_LIMIT',
          429,
          err
        );
      }
      if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('api key')) {
        throw new LLMProviderError(
          'Invalid Gemini API key.',
          this.name,
          'AUTHENTICATION_ERROR',
          401,
          err
        );
      }
      throw new LLMProviderError(
        `Gemini API error: ${msg}`,
        this.name,
        'API_ERROR',
        502,
        err
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
