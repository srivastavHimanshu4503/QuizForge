import { env } from '../../config/env';
import {
  ChatMessage,
  ILLMProvider,
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProviderError,
} from './llm.interface';

export class NvidiaProvider implements ILLMProvider {
  readonly name = 'nvidia';
  readonly defaultModel: string;
  readonly supportsVision = true;
  private apiKey?: string;
  private baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';

  constructor(options?: { apiKey?: string; defaultModel?: string }) {
    this.apiKey = options?.apiKey !== undefined ? options.apiKey : env.NVIDIA_API_KEY;
    this.defaultModel = options?.defaultModel || env.NVIDIA_MODEL || 'meta/llama-3.3-70b-instruct';
  }

  get isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0 && !this.apiKey.startsWith('nvapi-your_'));
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    if (!this.isAvailable) {
      throw new LLMProviderError(
        'NVIDIA NIM API key is not configured or invalid.',
        this.name,
        'PROVIDER_UNAVAILABLE',
        400
      );
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? 0.3;
    const maxTokens = options?.maxTokens ?? 4096;
    // Vision and reasoning models benefit from 90s timeout
    const timeoutMs = options?.timeoutMs ?? (options?.image ? 90000 : 45000);

    // Format messages: OpenAI multimodal format if image is provided
    let formattedMessages: unknown[] = messages;
    if (options?.image) {
      let lastUserIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') {
          lastUserIndex = i;
          break;
        }
      }
      formattedMessages = messages.map((msg, index) => {
        if (msg.role !== 'user' || index !== lastUserIndex) {
          return msg;
        }
        return {
          role: 'user',
          content: [
            { type: 'text', text: msg.content },
            {
              type: 'image_url',
              image_url: {
                url: `data:${options.image!.mimeType};base64,${options.image!.base64}`,
              },
            },
          ],
        };
      });
    }

    const body: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
    };

    if (options?.responseFormat?.type === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const executeFetch = async (attempt = 1): Promise<Response> => {
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
        clearTimeout(timer);
        return response;
      } catch (err: unknown) {
        clearTimeout(timer);
        const isAbort =
          err instanceof Error &&
          (err.name === 'AbortError' ||
            (err as any)?.cause?.name === 'AbortError' ||
            controller.signal.aborted);

        if (isAbort) {
          throw new LLMProviderError(
            `NVIDIA NIM API request timed out after ${timeoutMs}ms.`,
            this.name,
            'TIMEOUT',
            504
          );
        }

        // Retry on transient network/fetch failures
        if (attempt <= 2) {
          await new Promise((res) => setTimeout(res, 1200 * attempt));
          return executeFetch(attempt + 1);
        }

        const causeMsg = (err as any)?.cause?.message ? ` (${(err as any).cause.message})` : '';
        throw new LLMProviderError(
          `Failed to reach NVIDIA NIM API: ${err instanceof Error ? err.message : String(err)}${causeMsg}`,
          this.name,
          'NETWORK_ERROR',
          502,
          err
        );
      }
    };

    try {
      const response = await executeFetch();

      if (!response.ok) {
        const errorText = await response.text();
        let parsedErr: unknown = errorText;
        try {
          parsedErr = JSON.parse(errorText);
        } catch {
          // Keep raw text
        }

        if (response.status === 429) {
          throw new LLMProviderError(
            'NVIDIA NIM API rate limit exceeded. Please retry in a few moments.',
            this.name,
            'RATE_LIMIT',
            429,
            parsedErr
          );
        }

        if (response.status === 401) {
          throw new LLMProviderError(
            'Invalid NVIDIA NIM API key.',
            this.name,
            'AUTHENTICATION_ERROR',
            401,
            parsedErr
          );
        }

        throw new LLMProviderError(
          `NVIDIA NIM API error (${response.status}): ${typeof parsedErr === 'object' ? JSON.stringify(parsedErr) : errorText}`,
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
          'NVIDIA NIM returned an empty or invalid completion format.',
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
      const causeMsg = (err as any)?.cause?.message ? ` (${(err as any).cause.message})` : '';
      throw new LLMProviderError(
        `Failed to reach NVIDIA NIM API: ${err instanceof Error ? err.message : String(err)}${causeMsg}`,
        this.name,
        'NETWORK_ERROR',
        502,
        err
      );
    }
  }
}
