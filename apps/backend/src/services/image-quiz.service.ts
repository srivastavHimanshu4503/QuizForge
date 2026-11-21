import { GenerateImageQuizOptions, generateImageQuizOptionsSchema } from '@quiz-forge/shared';
import { fileSecurityService } from './ingestion/file-security.service';
import { imageIngestionAdapter } from './ingestion/image.adapter';
import { jobQueueService } from './jobs/job-queue.service';
import { aiService } from './ai/ai.service';
import { db } from '../db/index';
import { quizzes, questions, choices, quizAttempts } from '../db/schema/index';
import { shuffleArray } from '../utils/shuffle';
import { env } from '../config/env';

export class ImageQuizService {
  generateQuizFromImage(
    userId: string,
    buffer: Buffer,
    filename: string,
    rawOptions: Partial<GenerateImageQuizOptions> = {}
  ): { jobId: string; status: 'queued' } {
    // 1. Strict validation of input options
    const options = generateImageQuizOptionsSchema.parse(rawOptions);

    // 2. Fast synchronous image binary & magic byte verification
    fileSecurityService.validateImageBuffer(buffer, filename);

    // 3. Create tracking job
    const jobId = jobQueueService.createJob(
      userId,
      'Image upload accepted. Queued for vision analysis.'
    );

    // 4. Kick off asynchronous vision pipeline
    setImmediate(() => {
      this.processImageJob(jobId, userId, buffer, filename, options).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        jobQueueService.failJob(jobId, message);
      });
    });

    return {
      jobId,
      status: 'queued',
    };
  }

  private async processImageJob(
    jobId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
    options: GenerateImageQuizOptions
  ): Promise<void> {
    try {
      // Stage 1: File integrity validation
      jobQueueService.updateProgress(jobId, 'validating_file', 15, 'Validating image integrity and format...');

      // Stage 2: Multimodal image ingestion & Base64 encoding
      jobQueueService.updateProgress(jobId, 'analyzing_image', 40, 'Processing visual features and encoding document...');
      const { document, base64, mimeType } = imageIngestionAdapter.ingest(buffer, filename);

      const topic = options.topic?.trim() || document.title || 'Visual Assessment';

      // Stage 3: Question synthesis via Vision-Capable AI Provider
      jobQueueService.updateProgress(
        jobId,
        'synthesizing_questions',
        75,
        `Analyzing visual elements and synthesizing ${options.questionCount} grounded questions...`
      );

      const generatedQuestions = await aiService.generateQuizQuestions(
        {
          topic,
          questionCount: options.questionCount,
          difficulty: options.difficulty,
          provider: options.provider,
          context: `Visual document: "${topic}" (${mimeType}). All questions must be grounded in this visual diagram/image.`,
          image: {
            base64,
            mimeType,
          },
        },
        options.provider
      );

      // Stage 4: Database persistence
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

      // Stage 5: Job completion
      jobQueueService.completeJob(jobId, {
        quizId,
        attemptId,
        message: `Successfully synthesized ${generatedQuestions.length} questions from image.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      jobQueueService.failJob(jobId, message);
    }
  }
}

export const imageQuizService = new ImageQuizService();
