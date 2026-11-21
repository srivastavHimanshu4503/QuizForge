import {
  ChatMessage,
  ILLMProvider,
  LLMCompletionOptions,
  LLMCompletionResult,
} from './llm.interface';

export class MockLLMProvider implements ILLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly isAvailable = true;
  private customResponse?: string;

  constructor(name = 'mock', defaultModel = 'mock-model') {
    this.name = name;
    this.defaultModel = defaultModel;
  }

  setMockResponse(response: string) {
    this.customResponse = response;
  }

  async chatCompletion(
    _messages: ChatMessage[],
    _options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult> {
    if (this.customResponse) {
      return {
        content: this.customResponse,
        model: this.defaultModel,
        provider: this.name,
        promptTokens: 100,
        completionTokens: 50,
      };
    }

    // Default mock JSON response suitable for code quiz generation
    const mockJson = JSON.stringify({
      questions: [
        {
          question_id: 'mock_cq_1',
          question: 'What is the purpose of WAL mode in SQLite as implemented in this database setup?',
          code_snippet: {
            file_path: 'apps/backend/src/db/index.ts',
            start_line: 9,
            end_line: 12,
            code: "sqlite.pragma('journal_mode = WAL');\nsqlite.pragma('foreign_keys = ON');",
          },
          difficulty: 'medium',
          expected_concepts: ['Write-Ahead Logging', 'concurrent readers', 'crash recovery'],
        },
      ],
    });

    return {
      content: mockJson,
      model: this.defaultModel,
      provider: this.name,
      promptTokens: 100,
      completionTokens: 50,
    };
  }
}
