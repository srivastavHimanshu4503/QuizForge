import { JobResult, JobStage } from '@quiz-forge/shared';

interface InternalJob extends JobResult {
  userId: string;
}

export class JobQueueService {
  private jobs = new Map<string, InternalJob>();
  private readonly ttlMs = 60 * 60 * 1000; // 1 hour retention

  constructor() {
    // Periodic sweep of expired jobs every 15 minutes
    setInterval(() => this.cleanupExpiredJobs(), 15 * 60 * 1000).unref();
  }

  createJob(userId: string, initialMessage = 'Job initiated'): string {
    const jobId = crypto.randomUUID();
    const now = Date.now();

    const job: InternalJob = {
      jobId,
      userId,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      message: initialMessage,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(jobId, job);
    return jobId;
  }

  updateProgress(
    jobId: string,
    stage: JobStage,
    progress: number,
    message?: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'processing';
    job.stage = stage;
    job.progress = Math.min(100, Math.max(0, Math.round(progress)));
    if (message) job.message = message;
    job.updatedAt = Date.now();
  }

  completeJob(
    jobId: string,
    result: { quizId: string; attemptId: string; message?: string }
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.stage = 'completed';
    job.progress = 100;
    job.quizId = result.quizId;
    job.attemptId = result.attemptId;
    job.message = result.message || 'Quiz generation completed successfully.';
    job.updatedAt = Date.now();
  }

  failJob(jobId: string, error: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.stage = 'failed';
    job.error = error;
    job.message = `Job failed: ${error}`;
    job.updatedAt = Date.now();
  }

  getJob(jobId: string, userId?: string): JobResult | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    if (userId && job.userId !== userId) {
      return null;
    }

    const { userId: _, ...result } = job;
    return result;
  }

  private cleanupExpiredJobs(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > this.ttlMs) {
        this.jobs.delete(id);
      }
    }
  }
}

export const jobQueueService = new JobQueueService();
