import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../services/ai/ai.service';
import { MockQuestionGenerator } from '../services/ai/mock.provider';
import { buildQuizPrompt } from '../services/ai/prompts';
import { AIProviderError } from '../services/ai/ai.interface';
import { generatedQuizResponseSchema } from '@quiz-forge/shared';

describe('AI Question Generator & Validation Subsystem', () => {
  let mockProvider: MockQuestionGenerator;
  let service: AIService;

  beforeEach(() => {
    mockProvider = new MockQuestionGenerator();
    service = new AIService(mockProvider);
  });

  it('generates the exact requested number of questions conforming to data contract', async () => {
    const questions = await service.generateQuizQuestions({
      topic: 'Quantum Computing',
      questionCount: 5,
      difficulty: 'hard',
    });

    expect(questions).toHaveLength(5);

    // Verify against Zod schema
    const parseResult = generatedQuizResponseSchema.safeParse({ questions });
    expect(parseResult.success).toBe(true);

    for (const q of questions) {
      expect(q.question_id).toBeDefined();
      expect(q.question).toContain('Quantum Computing');
      expect(q.choices).toHaveLength(4);

      // Verify unique choice IDs A, B, C, D
      const choiceIds = q.choices.map((c) => c.choice_id).sort();
      expect(choiceIds).toEqual(['A', 'B', 'C', 'D']);

      // Verify correct_answer_id is one of A, B, C, D
      expect(['A', 'B', 'C', 'D']).toContain(q.correct_answer_id);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  });

  it('generates questions across all difficulty levels (easy, medium, hard, mixed)', async () => {
    const difficulties = ['easy', 'medium', 'hard', 'mixed'] as const;

    for (const diff of difficulties) {
      const questions = await service.generateQuizQuestions({
        topic: 'Python Concurrency',
        questionCount: 3,
        difficulty: diff,
      });

      expect(questions).toHaveLength(3);
      expect(questions[0]?.question).toContain(diff);
    }
  });

  it('rejects malformed question structures (invalid choices or incorrect answer IDs)', async () => {
    mockProvider.setOptions({ simulateInvalidResponse: true });

    await expect(
      service.generateQuizQuestions({
        topic: 'Invalid Test',
        questionCount: 1,
        difficulty: 'easy',
      })
    ).rejects.toThrow(AIProviderError);

    try {
      await service.generateQuizQuestions({
        topic: 'Invalid Test',
        questionCount: 1,
        difficulty: 'easy',
      });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe('AI_INVALID_RESPONSE');
    }
  });

  it('rejects questions with duplicate option texts within a single question', async () => {
    mockProvider.setOptions({ simulateDuplicateOptions: true });

    await expect(
      service.generateQuizQuestions({
        topic: 'Duplicate Options',
        questionCount: 1,
        difficulty: 'easy',
      })
    ).rejects.toThrow(/data contract validation/i);
  });

  it('rejects batches containing duplicate questions', async () => {
    // Custom mock returning duplicate question texts
    const dupProvider = {
      async generateQuestions() {
        return [
          {
            question_id: 'q1',
            question: 'What is Node.js?',
            choices: [
              { choice_id: 'A' as const, option_text: 'Runtime' },
              { choice_id: 'B' as const, option_text: 'Browser' },
              { choice_id: 'C' as const, option_text: 'Database' },
              { choice_id: 'D' as const, option_text: 'Language' },
            ],
            correct_answer_id: 'A' as const,
            explanation: 'Runtime environment.',
          },
          {
            question_id: 'q2',
            question: 'What is Node.js?', // Duplicate!
            choices: [
              { choice_id: 'A' as const, option_text: 'Option 1' },
              { choice_id: 'B' as const, option_text: 'Option 2' },
              { choice_id: 'C' as const, option_text: 'Option 3' },
              { choice_id: 'D' as const, option_text: 'Option 4' },
            ],
            correct_answer_id: 'B' as const,
            explanation: 'Runtime duplicate.',
          },
        ];
      },
    };

    service.setProvider(dupProvider);

    await expect(
      service.generateQuizQuestions({
        topic: 'Node.js',
        questionCount: 2,
        difficulty: 'medium',
      })
    ).rejects.toThrow(/duplicate questions/i);
  });

  it('handles simulated rate limit errors with AI_RATE_LIMIT code', async () => {
    mockProvider.setOptions({ simulateRateLimit: true });

    try {
      await service.generateQuizQuestions({
        topic: 'Rate Limit Test',
        questionCount: 2,
        difficulty: 'medium',
      });
      expect.fail('Should have thrown an error');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe('AI_RATE_LIMIT');
      expect((err as AIProviderError).statusCode).toBe(429);
    }
  });

  it('handles simulated timeout errors with AI_TIMEOUT code', async () => {
    mockProvider.setOptions({ simulateTimeout: true });

    try {
      await service.generateQuizQuestions({
        topic: 'Timeout Test',
        questionCount: 2,
        difficulty: 'hard',
      });
      expect.fail('Should have thrown an error');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AIProviderError);
      expect((err as AIProviderError).code).toBe('AI_TIMEOUT');
      expect((err as AIProviderError).statusCode).toBe(504);
    }
  });

  it('constructs tailored assessment prompts based on difficulty and constraints', () => {
    const easyPrompt = buildQuizPrompt({
      topic: 'Docker Containers',
      questionCount: 10,
      difficulty: 'easy',
    });
    expect(easyPrompt).toContain('Topic: "Docker Containers"');
    expect(easyPrompt).toContain('Number of Questions: 10');
    expect(easyPrompt).toContain('Target Level: EASY');
    expect(easyPrompt).toContain("four options labeled 'A', 'B', 'C', and 'D'");

    const hardPrompt = buildQuizPrompt({
      topic: 'Distributed Consensus',
      questionCount: 7,
      difficulty: 'hard',
    });
    expect(hardPrompt).toContain('Target Level: HARD');
    expect(hardPrompt).toContain('edge cases');
  });

  it('resiliently normalizes LLM string choices, alternative key names, and reasoning fields', () => {
    // Simulates raw LLM output with string choices, correct_answer instead of correct_answer_id, and reason instead of explanation
    const rawLLMOutput = {
      questions: [
        {
          id: 'gen_q1',
          question_text: 'What is the main benefit of Write-Ahead Logging (WAL) in databases?',
          choices: [
            'Immediate in-place writes to disk tables',
            'B: Atomic durability and append-only write performance',
            'Automatic multi-region replication',
            'Eliminating all indexing requirements',
          ],
          correct_answer: 'B',
          reason: 'WAL guarantees durability by appending changes sequentially before flushing table pages.',
        },
        {
          id: 'gen_q2',
          prompt: 'Which protocol is commonly used for distributed consensus in etcd and Consul?',
          options: {
            A: 'Paxos',
            B: 'Raft',
            C: 'Two-Phase Commit',
            D: 'Gossip',
          },
          correctAnswer: 'B',
          rationale: 'Raft is specifically designed for understandable distributed consensus in modern systems.',
        },
      ],
    };

    const result = generatedQuizResponseSchema.safeParse(rawLLMOutput);
    expect(result.success).toBe(true);

    if (result.success) {
      const q1 = result.data.questions[0]!;
      expect(q1.question_id).toBe('gen_q1');
      expect(q1.correct_answer_id).toBe('B');
      expect(q1.choices).toHaveLength(4);
      expect(q1.choices[0]!.choice_id).toBe('A');
      expect(q1.choices[1]!.choice_id).toBe('B');
      expect(q1.choices[1]!.option_text).toBe('Atomic durability and append-only write performance');
      expect(q1.explanation).toContain('WAL guarantees durability');

      const q2 = result.data.questions[1]!;
      expect(q2.question_id).toBe('gen_q2');
      expect(q2.correct_answer_id).toBe('B');
      expect(q2.choices).toHaveLength(4);
      expect(q2.choices[0]!.option_text).toBe('Paxos');
      expect(q2.choices[1]!.option_text).toBe('Raft');
    }
  });
});
