import { ILLMProvider, LLMProviderError } from './llm.interface';
import { GroqProvider } from './groq.provider';
import { NvidiaProvider } from './nvidia.provider';
import { GeminiChatProvider } from './gemini-chat.provider';
import { MockLLMProvider } from './mock-llm.provider';
import { env } from '../../config/env';

export interface ProviderInfo {
  id: string;
  name: string;
  displayName: string;
  defaultModel: string;
  isAvailable: boolean;
  supportsVision: boolean;
  description: string;
}

export class LLMProviderRegistry {
  private providers = new Map<string, ILLMProvider>();

  constructor() {
    this.initDefaultProviders();
  }

  private initDefaultProviders() {
    this.register(new GroqProvider());
    this.register(new NvidiaProvider());
    this.register(new GeminiChatProvider());

    if (env.NODE_ENV === 'test') {
      this.register(new MockLLMProvider('mock'));
    }
  }

  register(provider: ILLMProvider) {
    this.providers.set(provider.name.toLowerCase(), provider);
  }

  get(name: string): ILLMProvider {
    const key = name.toLowerCase();
    const provider = this.providers.get(key);
    if (!provider) {
      throw new LLMProviderError(
        `LLM Provider '${name}' is not registered. Available: ${Array.from(this.providers.keys()).join(', ')}`,
        name,
        'UNKNOWN_PROVIDER',
        400
      );
    }
    return provider;
  }

  getAvailableProviders(): ProviderInfo[] {
    return Array.from(this.providers.values()).map((p) => {
      // Dynamically extract model name from environment/provider default
      const rawModel = p.defaultModel || '';
      const cleanModel = rawModel.replace(/^(openai|meta|nvidia|google)\//i, '');

      let displayName: string;
      let description: string;

      switch (p.name.toLowerCase()) {
        case 'groq':
          displayName = `Groq (${cleanModel})`;
          description = `Ultra-fast LPU inference powered by ${cleanModel}.`;
          break;
        case 'nvidia':
          displayName = `NVIDIA NIM (${cleanModel})`;
          description = `Enterprise AI microservices powered by ${cleanModel}.`;
          break;
        case 'gemini':
          displayName = `Google Gemini (${cleanModel})`;
          description = `High-throughput multimodal intelligence with ${cleanModel}.`;
          break;
        case 'mock':
          displayName = `Mock Provider (${cleanModel})`;
          description = `Local deterministic mock provider for testing with ${cleanModel}.`;
          break;
        default:
          displayName = `${p.name.toUpperCase()} (${cleanModel})`;
          description = `${p.name} LLM Provider running ${cleanModel}.`;
          break;
      }

      return {
        id: p.name,
        name: p.name,
        displayName,
        defaultModel: p.defaultModel,
        isAvailable: p.isAvailable,
        supportsVision: p.supportsVision,
        description,
      };
    });
  }

  getVisionProvider(preferredName?: string): ILLMProvider {
    if (preferredName) {
      const p = this.providers.get(preferredName.toLowerCase());
      if (p && p.isAvailable && p.supportsVision) {
        return p;
      }
    }

    // In test environment, prioritize mock provider
    const priority = env.NODE_ENV === 'test'
      ? ['mock', 'gemini', 'nvidia']
      : ['gemini', 'nvidia', 'mock'];
    for (const key of priority) {
      const p = this.providers.get(key);
      if (p && p.isAvailable && p.supportsVision) {
        return p;
      }
    }

    return this.getDefaultProvider();
  }

  getDefaultProvider(): ILLMProvider {
    // Priority: Groq -> NVIDIA -> Gemini -> Mock
    const priority = ['groq', 'nvidia', 'gemini', 'mock'];
    for (const key of priority) {
      const p = this.providers.get(key);
      if (p && p.isAvailable) {
        return p;
      }
    }

    // In tests or if none configured, return mock or first registered
    const first = this.providers.values().next().value;
    if (first) return first;

    throw new LLMProviderError(
      'No LLM provider is currently available. Please configure GROQ_API_KEY, NVIDIA_API_KEY, or GEMINI_API_KEY in .env.',
      'registry',
      'NO_AVAILABLE_PROVIDER',
      503
    );
  }
}

export const llmRegistry = new LLMProviderRegistry();
export const providerRegistry = llmRegistry;
