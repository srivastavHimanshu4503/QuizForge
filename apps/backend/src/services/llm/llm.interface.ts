export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: 'json_object' } | { type: 'text' };
  timeoutMs?: number;
  image?: ImageAttachment;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly isAvailable: boolean;
  readonly supportsVision: boolean;

  chatCompletion(
    messages: ChatMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;
}

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: string,
    public statusCode: number = 502,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LLMProviderError';
  }
}
