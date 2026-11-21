import { GeneratePdfQuizOptions, generatePdfQuizOptionsSchema } from '@quiz-forge/shared';
import { fileSecurityService } from './ingestion/file-security.service';
import { pdfIngestionAdapter } from './ingestion/pdf.adapter';
import { jobQueueService } from './jobs/job-queue.service';
import { aiService } from './ai/ai.service';
import { db } from '../db/index';
import { quizzes, questions, choices, quizAttempts } from '../db/schema/index';
import { shuffleArray } from '../utils/shuffle';
import { env } from '../config/env';

export class PdfQuizService {
  generateQuizFromPdf(
    userId: string,
    fileBuffer: Buffer,
    filename: string,
    rawOptions: Partial<GeneratePdfQuizOptions> = {}
  ): { jobId: string; status: 'queued' } {
    // 1. Strict validation of input options
    const options = generatePdfQuizOptionsSchema.parse(rawOptions);

    // 2. Validate PDF buffer synchronously (fast signature & size check)
    fileSecurityService.validatePdfBuffer(fileBuffer, filename);

    // 3. Create tracking job
    const jobId = jobQueueService.createJob(userId, 'PDF upload accepted. Queued for processing.');

    // 4. Kick off asynchronous processing pipeline
    setImmediate(() => {
      this.processPdfJob(jobId, userId, fileBuffer, filename, options).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        jobQueueService.failJob(jobId, message);
      });
    });

    return {
      jobId,
      status: 'queued',
    };
  }

  private async processPdfJob(
    jobId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
    options: GeneratePdfQuizOptions
  ): Promise<void> {
    try {
      // Stage 1: File integrity validation
      jobQueueService.updateProgress(jobId, 'validating_file', 15, 'Validating PDF integrity and structure...');

      // Stage 2: Text extraction
      jobQueueService.updateProgress(jobId, 'extracting_text', 35, 'Extracting text content from PDF...');
      const normalizedDoc = await pdfIngestionAdapter.ingest(buffer, filename);

      // Stage 3: Semantic chunking & context assembly
      jobQueueService.updateProgress(jobId, 'chunking', 50, 'Analyzing semantic chunks and key concepts...');

      let context = '';
      for (const chunk of normalizedDoc.chunks) {
        if ((context + '\n\n' + chunk.content).length > 10000) break;
        context = context ? `${context}\n\n${chunk.content}` : chunk.content;
      }

      const topic = options.topic?.trim() || normalizedDoc.title || 'PDF Document Assessment';

      // Stage 4: Question synthesis via AI Provider
      jobQueueService.updateProgress(
        jobId,
        'synthesizing_questions',
        70,
        `Synthesizing ${options.questionCount} pedagogical questions with AI...`
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

      // Stage 5: Database persistence
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

      // Stage 6: Job completion
      jobQueueService.completeJob(jobId, {
        quizId,
        attemptId,
        message: `Successfully generated ${generatedQuestions.length} questions from PDF.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      jobQueueService.failJob(jobId, message);
    }
  }
}

export const pdfQuizService = new PdfQuizService();
