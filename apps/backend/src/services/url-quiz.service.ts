import { GenerateUrlQuizOptions, generateUrlQuizOptionsSchema } from '@quiz-forge/shared';
import { ssrfProtectionService } from './ingestion/ssrf-protection.service';
import { urlIngestionAdapter } from './ingestion/url.adapter';
import { jobQueueService } from './jobs/job-queue.service';
import { aiService } from './ai/ai.service';
import { db } from '../db/index';
import { quizzes, questions, choices, quizAttempts } from '../db/schema/index';
import { shuffleArray } from '../utils/shuffle';
import { env } from '../config/env';

export class UrlQuizService {
  async generateQuizFromUrl(
    userId: string,
    rawOptions: Partial<GenerateUrlQuizOptions> = {}
  ): Promise<{ jobId: string; status: 'queued' }> {
    // 1. Strict validation of input options
    const options = generateUrlQuizOptionsSchema.parse(rawOptions);

    // 2. Fast synchronous SSRF & DNS pre-lookup verification
    await ssrfProtectionService.validateUrl(options.url);

    // 3. Create tracking job
    const jobId = jobQueueService.createJob(userId, 'URL accepted. Queued for content retrieval.');

    // 4. Kick off asynchronous ingestion and question generation
    setImmediate(() => {
      this.processUrlJob(jobId, userId, options).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        jobQueueService.failJob(jobId, message);
      });
    });

    return {
      jobId,
      status: 'queued',
    };
  }

  private async processUrlJob(
    jobId: string,
    userId: string,
    options: GenerateUrlQuizOptions
  ): Promise<void> {
    try {
      // Stage 1: URL validation
      jobQueueService.updateProgress(jobId, 'validating_url', 15, 'Validating URL destination and security bounds...');

      // Stage 2: Fetching content
      jobQueueService.updateProgress(jobId, 'fetching_content', 35, `Fetching content from ${options.url}...`);
      const normalizedDoc = await urlIngestionAdapter.ingest(options.url);

      // Stage 3: Text extraction & structure analysis
      jobQueueService.updateProgress(jobId, 'extracting_text', 50, 'Extracting article structure and removing noise...');

      // Stage 4: Semantic chunking & context assembly
      jobQueueService.updateProgress(jobId, 'chunking', 65, 'Analyzing semantic chunks and concepts...');

      let context = '';
      for (const chunk of normalizedDoc.chunks) {
        if ((context + '\n\n' + chunk.content).length > 10000) break;
        context = context ? `${context}\n\n${chunk.content}` : chunk.content;
      }

      const topic = options.topic?.trim() || normalizedDoc.title || 'Web Article Assessment';

      // Stage 5: AI question synthesis
      jobQueueService.updateProgress(
        jobId,
        'synthesizing_questions',
        80,
        `Synthesizing ${options.questionCount} grounded questions with AI...`
      );

      const generatedQuestions = await aiService.generateQuizQuestions(
        {
          topic,
          questionCount: options.questionCount,
          difficulty: options.difficulty,
          provider: options.provider,
          context,
        },
        options.provider
      );

      // Stage 6: Database persistence
      const quizId = crypto.randomUUID();
      const attemptId = crypto.randomUUID();
      const createdQuestionIds: string[] = [];

      db.transaction((tx) => {
        tx.insert(quizzes)
          .values({
            id: quizId,
            userId,
            topic,
            difficulty: options.difficulty,
            questionCount: generatedQuestions.length,
            aiModel: options.provider || env.GEMINI_MODEL,
          })
          .run();

        generatedQuestions.forEach((q, index) => {
          const questionId = crypto.randomUUID();
          createdQuestionIds.push(questionId);

          tx.insert(questions)
            .values({
              id: questionId,
              quizId,
              questionOrder: index + 1,
              questionText: q.question,
              correctChoiceId: q.correct_answer_id,
              explanation: q.explanation,
            })
            .run();

          const choiceRecords = q.choices.map((c) => ({
            id: crypto.randomUUID(),
            questionId,
            choiceId: c.choice_id,
            optionText: c.option_text,
          }));

          tx.insert(choices).values(choiceRecords).run();
        });

        const shuffledOrder = shuffleArray(createdQuestionIds);
        tx.insert(quizAttempts)
          .values({
            id: attemptId,
            quizId,
            userId,
            attemptNumber: 1,
            status: 'in_progress',
            shuffledOrder,
            totalQuestions: generatedQuestions.length,
          })
          .run();
      });

      // Stage 7: Job completion
      jobQueueService.completeJob(jobId, {
        quizId,
        attemptId,
        message: `Successfully generated ${generatedQuestions.length} questions from web page.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      jobQueueService.failJob(jobId, message);
    }
  }
}

export const urlQuizService = new UrlQuizService();
