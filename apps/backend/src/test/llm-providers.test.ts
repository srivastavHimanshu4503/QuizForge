import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GroqProvider } from '../services/llm/groq.provider';
import { NvidiaProvider } from '../services/llm/nvidia.provider';
import { GeminiChatProvider } from '../services/llm/gemini-chat.provider';
import { LLMProviderRegistry } from '../services/llm/provider-registry';
import { LLMProviderError } from '../services/llm/llm.interface';
import { MockLLMProvider } from '../services/llm/mock-llm.provider';
import { LLMQuestionGenerator } from '../services/ai/llm-question.generator';
import { AIProviderError } from '../services/ai/ai.interface';

describe('LLM Providers & Registry', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('GroqProvider', () => {
    it('reports availability based on API key validity', () => {
      const withKey = new GroqProvider({ apiKey: 'gsk_real_key_123' });
      expect(withKey.isAvailable).toBe(true);

      const placeholderKey = new GroqProvider({ apiKey: 'gsk_your_groq_api_key_here' });
      expect(placeholderKey.isAvailable).toBe(false);

      const emptyKey = new GroqProvider({ apiKey: '' });
      expect(emptyKey.isAvailable).toBe(false);
    });

    it('successfully calls Groq OpenAI-compatible endpoint with JSON format', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'llama-3.3-70b-versatile',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '{"questions": []}',
            },
          },
        ],
        usage: {
          prompt_tokens: 25,
          completion_tokens: 10,
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const provider = new GroqProvider({ apiKey: 'gsk_valid_key' });
      const result = await provider.chatCompletion(
        [{ role: 'user', content: 'Hello Groq' }],
        { responseFormat: { type: 'json_object' } }
      );

      expect(result.content).toBe('{"questions": []}');
      expect(result.provider).toBe('groq');
      expect(result.model).toBe('llama-3.3-70b-versatile');
      expect(result.promptTokens).toBe(25);
      expect(result.completionTokens).toBe(10);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer gsk_valid_key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws LLMProviderError on 429 rate limit', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'Rate limit reached' } }),
      } as Response);

      const provider = new GroqProvider({ apiKey: 'gsk_valid_key' });
      await expect(
        provider.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow(LLMProviderError);
    });

    it('throws LLMProviderError on 401 unauthorized', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      } as Response);

      const provider = new GroqProvider({ apiKey: 'gsk_invalid_key' });
      await expect(
        provider.chatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('Invalid Groq API key.');
    });
  });

  describe('NvidiaProvider', () => {
    it('reports availability based on API key validity', () => {
      const withKey = new NvidiaProvider({ apiKey: 'nvapi-valid-token' });
      expect(withKey.isAvailable).toBe(true);

      const placeholderKey = new NvidiaProvider({ apiKey: 'nvapi-your_nvidia_api_key_here' });
      expect(placeholderKey.isAvailable).toBe(false);
    });

    it('successfully calls NVIDIA NIM OpenAI-compatible endpoint', async () => {
      const mockResponse = {
        model: 'meta/llama-3.3-70b-instruct',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '{"response": "ok"}',
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const provider = new NvidiaProvider({ apiKey: 'nvapi-valid-token' });
      const result = await provider.chatCompletion([
        { role: 'user', content: 'Hello NVIDIA' },
      ]);

      expect(result.content).toBe('{"response": "ok"}');
      expect(result.provider).toBe('nvidia');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        expect.anything()
      );
    });
  });

  describe('GeminiChatProvider', () => {
    it('initializes with default model and checks key', () => {
      const provider = new GeminiChatProvider();
      expect(provider.name).toBe('gemini');
      expect(provider.defaultModel).toBeDefined();
    });
  });

  describe('LLMProviderRegistry', () => {
    it('registers and retrieves providers case-insensitively', () => {
      const registry = new LLMProviderRegistry();
      const groq = registry.get('GROQ');
      expect(groq.name).toBe('groq');

      const nvidia = registry.get('Nvidia');
      expect(nvidia.name).toBe('nvidia');

      const gemini = registry.get('gemini');
      expect(gemini.name).toBe('gemini');
    });

    it('throws on unknown provider', () => {
      const registry = new LLMProviderRegistry();
      expect(() => registry.get('unknown-ai')).toThrow("LLM Provider 'unknown-ai' is not registered");
    });

    it('returns available providers list for UI dropdown with metadata', () => {
      const registry = new LLMProviderRegistry();
      const list = registry.getAvailableProviders();
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(list.some((p) => p.id === 'groq')).toBe(true);
      expect(list.some((p) => p.id === 'nvidia')).toBe(true);
      expect(list.some((p) => p.id === 'gemini')).toBe(true);
    });
  });

  describe('LLMQuestionGenerator (Unified AI Layer)', () => {
    it('generates valid MCQ questions from ILLMProvider and strips markdown fences', async () => {
      const mockLLM = new MockLLMProvider('mock-mcq');
      const sampleJSON = JSON.stringify({
        questions: [
          {
            question_id: 'q_gen_1',
            question: 'What is the primary role of a reverse proxy like NGINX?',
            choices: [
              { choice_id: 'A', option_text: 'Load balancing and SSL termination' },
              { choice_id: 'B', option_text: 'Direct hard-drive formatting' },
              { choice_id: 'C', option_text: 'Executing GPU shader code' },
              { choice_id: 'D', option_text: 'Recompiling kernel binaries' },
            ],
            correct_answer_id: 'A',
            explanation: 'Reverse proxies act as intermediaries to handle TLS, caching, and traffic distribution.',
          },
        ],
      });

      // Wrap in markdown code fence to test fence stripper
      mockLLM.setMockResponse(`\`\`\`json\n${sampleJSON}\n\`\`\``);

      const generator = new LLMQuestionGenerator(mockLLM);
      const questions = await generator.generateQuestions({
        topic: 'Reverse Proxies',
        questionCount: 1,
        difficulty: 'medium',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.question_id).toBe('q_gen_1');
      expect(questions[0]?.choices).toHaveLength(4);
      expect(questions[0]?.correct_answer_id).toBe('A');
    });

    it('maps LLMProviderError rate limits to AIProviderError (429)', async () => {
      const failingLLM = {
        name: 'failing-mock',
        defaultModel: 'model-fail',
        isAvailable: true,
        supportsVision: false,
        async chatCompletion(): Promise<never> {
          throw new LLMProviderError('Groq rate limit exceeded', 'failing-mock', 'RATE_LIMIT', 429);
        },
      };

      const generator = new LLMQuestionGenerator(failingLLM);
      await expect(
        generator.generateQuestions({
          topic: 'Failure Test',
          questionCount: 1,
          difficulty: 'easy',
        })
      ).rejects.toThrow(AIProviderError);

      try {
        await generator.generateQuestions({
          topic: 'Failure Test',
          questionCount: 1,
          difficulty: 'easy',
        });
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AIProviderError);
        expect((err as AIProviderError).code).toBe('AI_RATE_LIMIT');
        expect((err as AIProviderError).statusCode).toBe(429);
      }
    });

    it('maps LLMProviderError timeouts to AIProviderError (504)', async () => {
      const timeoutLLM = {
        name: 'timeout-mock',
        defaultModel: 'model-timeout',
        isAvailable: true,
        supportsVision: false,
        async chatCompletion(): Promise<never> {
          throw new LLMProviderError('Request timed out after 45000ms', 'timeout-mock', 'TIMEOUT', 504);
        },
      };

      const generator = new LLMQuestionGenerator(timeoutLLM);
      try {
        await generator.generateQuestions({
          topic: 'Timeout Test',
          questionCount: 1,
          difficulty: 'hard',
        });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AIProviderError);
        expect((err as AIProviderError).code).toBe('AI_TIMEOUT');
        expect((err as AIProviderError).statusCode).toBe(504);
      }
    });

    it('throws AI_INVALID_RESPONSE if LLM returns malformed JSON', async () => {
      const malformedLLM = new MockLLMProvider('malformed-mock');
      malformedLLM.setMockResponse('This is not JSON at all');

      const generator = new LLMQuestionGenerator(malformedLLM);
      await expect(
        generator.generateQuestions({
          topic: 'JSON Failure',
          questionCount: 1,
          difficulty: 'easy',
        })
      ).rejects.toThrow(/Failed to parse JSON response/i);
    });
  });
});
