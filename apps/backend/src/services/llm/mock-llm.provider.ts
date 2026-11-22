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
  readonly supportsVision = true;
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

    const promptCombined = _messages.map((m) => m.content).join('\n');
    const isMCQ = promptCombined.includes('choices') && promptCombined.includes('correct_answer_id');

    if (isMCQ) {
      const mockMCQ = JSON.stringify({
        questions: [
          {
            question_id: 'mock_mcq_1',
            question: 'What is the primary benefit of Write-Ahead Logging (WAL) in SQLite?',
            choices: [
              { choice_id: 'A', option_text: 'Concurrent reads while writes occur' },
              { choice_id: 'B', option_text: 'Disables ACID compliance' },
              { choice_id: 'C', option_text: 'Decreases disk storage by 90%' },
              { choice_id: 'D', option_text: 'Replaces the file system entirely' },
            ],
            correct_answer_id: 'A',
            explanation: 'WAL mode allows concurrent readers while a write transaction is executing.',
          },
        ],
      });

      return {
        content: mockMCQ,
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
