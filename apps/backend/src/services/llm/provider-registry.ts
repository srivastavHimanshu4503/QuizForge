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
    const displayMeta: Record<string, { displayName: string; description: string }> = {
      groq: {
        displayName: 'Groq (GPT-OSS-120B)',
        description: 'Ultra-fast LPU inference powered by GPT-OSS-120B.',
      },
      nvidia: {
        displayName: 'NVIDIA NIM (Llama 3.3 70B)',
        description: 'Enterprise AI microservices powered by NVIDIA accelerated compute.',
      },
      gemini: {
        displayName: 'Google Gemini (2.5 Flash)',
        description: 'High-throughput multimodal intelligence with large context window.',
      },
      mock: {
        displayName: 'Mock Provider (Test)',
        description: 'Local deterministic mock provider for testing.',
      },
    };

    return Array.from(this.providers.values()).map((p) => {
      const meta = displayMeta[p.name] || {
        displayName: p.name.toUpperCase(),
        description: `${p.name} LLM Provider`,
      };
      return {
        id: p.name,
        name: p.name,
        displayName: meta.displayName,
        defaultModel: p.defaultModel,
        isAvailable: p.isAvailable,
        supportsVision: p.supportsVision,
        description: meta.description,
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
