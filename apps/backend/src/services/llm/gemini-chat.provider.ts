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
  readonly supportsVision = true;
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
    const timeoutMs = options?.timeoutMs ?? (options?.image ? 90000 : 45000);

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

    const textContent = nonSystemMsgs.length > 0 ? nonSystemMsgs.map((m) => m.content).join('\n\n') : prompt;

    // Build multimodal contents
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any;
    if (options?.image) {
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

    // Direct REST API fallback helper
    const callDirectRestApi = async (): Promise<string> => {
      const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      const restBody = {
        contents: options?.image
          ? [
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
            ]
          : [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.3,
          responseMimeType: options?.responseFormat?.type === 'json_object' ? 'application/json' : undefined,
        },
        systemInstruction: systemMsg?.content ? { parts: [{ text: systemMsg.content }] } : undefined,
      };

      const restController = new AbortController();
      const restTimer = setTimeout(() => restController.abort(), timeoutMs);

      try {
        const res = await fetch(restUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(restBody),
          signal: restController.signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Direct REST error (${res.status}): ${errText}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = (await res.json()) as any;
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== 'string') {
          throw new Error('Gemini REST API returned invalid response format.');
        }
        return text;
      } finally {
        clearTimeout(restTimer);
      }
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt++) {
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
        clearTimeout(timer);

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
        clearTimeout(timer);
        lastError = err;

        if (err instanceof LLMProviderError) {
          throw err;
        }

        const msg = err instanceof Error ? err.message : String(err);
        const isAbort =
          err instanceof Error &&
          (err.name === 'AbortError' ||
            (err as any)?.cause?.name === 'AbortError' ||
            controller.signal.aborted);

        if (isAbort) {
          throw new LLMProviderError(
            `Gemini request timed out after ${timeoutMs}ms.`,
            this.name,
            'TIMEOUT',
            504
          );
        }

        // On transient network or fetch error, try fallback to direct REST API before throwing
        if (msg.includes('fetch failed') || msg.includes('ECONNRESET')) {
          try {
            const restContent = await callDirectRestApi();
            return {
              content: restContent,
              model,
              provider: this.name,
            };
          } catch (restErr: unknown) {
            lastError = restErr;
          }
        }

        if (attempt === 1) {
          await new Promise((res) => setTimeout(res, 1200));
        }
      }
    }

    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      throw new LLMProviderError(
        'Gemini rate limit exceeded. Please wait a moment and retry.',
        this.name,
        'RATE_LIMIT',
        429,
        lastError
      );
    }
    if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('api key')) {
      throw new LLMProviderError(
        'Invalid Gemini API key.',
        this.name,
        'AUTHENTICATION_ERROR',
        401,
        lastError
      );
    }

    const causeMsg = (lastError as any)?.cause?.message ? ` (${(lastError as any).cause.message})` : '';
    throw new LLMProviderError(
      `Gemini API error: ${msg}${causeMsg}`,
      this.name,
      'API_ERROR',
      502,
      lastError
    );
  }
}
