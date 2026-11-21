import { env } from '../../config/env';
import {
  ChatMessage,
  ILLMProvider,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderError,
} from './llm.interface';

export class GroqProvider implements ILLMProvider {
  readonly name = 'groq';
  readonly defaultModel: string;
  private apiKey?: string;
  private baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.apiKey = options?.apiKey !== undefined ? options.apiKey : env.GROQ_API_KEY;
    this.defaultModel = options?.defaultModel || env.GROQ_MODEL || 'openai/gpt-oss-120b';
  }

  get isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.apiKey.startsWith('gsk_your_'));
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    if (!this.isAvailable) {
      throw new LLMProviderError(
        'Groq API key is not configured or invalid.',
        this.name,
        'PROVIDER_UNAVAILABLE',
        400
      );
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 4096;
    const timeoutMs = options?.timeoutMs ?? 45000;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    if (options?.responseFormat?.type === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedErr: unknown = errorText;
        try {
          parsedErr = JSON.parse(errorText);
        } catch {
          // Keep raw text
        }

        if (response.status === 413) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detailMsg = (parsedErr as any)?.error?.message || errorText;
          throw new LLMProviderError(
            `Groq request exceeded token limit: ${detailMsg}`,
            this.name,
            'REQUEST_TOO_LARGE',
            413,
            parsedErr
          );
        }

        if (response.status === 429) {
          throw new LLMProviderError(
            'Groq API rate limit exceeded. Please retry in a few moments.',
            this.name,
            'RATE_LIMIT',
            429,
            parsedErr
          );
        }

        if (response.status === 401) {
          throw new LLMProviderError(
            'Invalid Groq API key.',
            this.name,
            'AUTHENTICATION_ERROR',
            401,
            parsedErr
          );
        }

        throw new LLMProviderError(
          `Groq API error (${response.status}): ${typeof parsedErr === 'object' ? JSON.stringify(parsedErr) : errorText}`,
          this.name,
          'API_ERROR',
          response.status,
          parsedErr
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;

      if (typeof content !== 'string') {
        throw new LLMProviderError(
          'Groq returned an empty or invalid completion format.',
          this.name,
          'INVALID_RESPONSE',
          502,
          data
        );
      }

      return {
        content,
        model: data.model || model,
        provider: this.name,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      };
    } catch (err: unknown) {
      if (err instanceof LLMProviderError) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LLMProviderError(
          `Groq API request timed out after ${timeoutMs}ms.`,
          this.name,
          'TIMEOUT',
          504
        );
      }
      throw new LLMProviderError(
        `Failed to reach Groq API: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
        'NETWORK_ERROR',
        502,
        err
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
