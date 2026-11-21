import { z } from 'zod';

export const documentSourceTypeEnum = z.enum(['pdf', 'url', 'image', 'github', 'topic']);
export type DocumentSourceType = z.infer<typeof documentSourceTypeEnum>;

export const documentChunkSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int(),
  sectionTitle: z.string().optional(),
  pageNumber: z.number().int().optional(),
  filePath: z.string().optional(),
  content: z.string(),
  tokenEstimate: z.number().int(),
});
export type DocumentChunk = z.infer<typeof documentChunkSchema>;

export const documentMetadataSchema = z.object({
  mimeType: z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  extractedAt: z.number().int(),
  pageCount: z.number().int().optional(),
  checksumSha256: z.string().optional(),
});
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

export const normalizedDocumentSchema = z.object({
  id: z.string(),
  sourceType: documentSourceTypeEnum,
  sourceIdentifier: z.string(),
  title: z.string(),
  metadata: documentMetadataSchema,
  chunks: z.array(documentChunkSchema),
  totalTokenEstimate: z.number().int(),
});
export type NormalizedDocument = z.infer<typeof normalizedDocumentSchema>;

export const jobStatusEnum = z.enum(['queued', 'processing', 'completed', 'failed']);
export type JobStatus = z.infer<typeof jobStatusEnum>;

export const jobStageEnum = z.enum([
  'queued',
  'validating_file',
  'extracting_text',
  'chunking',
  'synthesizing_questions',
  'completed',
  'failed',
]);
export type JobStage = z.infer<typeof jobStageEnum>;

export const jobResultSchema = z.object({
  jobId: z.string(),
  status: jobStatusEnum,
  stage: jobStageEnum,
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  quizId: z.string().optional(),
  attemptId: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type JobResult = z.infer<typeof jobResultSchema>;

export const generatePdfQuizOptionsSchema = z.object({
  topic: z.string().trim().max(100).optional(),
  questionCount: z.coerce.number().int().min(1).max(20).default(5),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  provider: z.string().optional(),
});
export type GeneratePdfQuizOptions = z.infer<typeof generatePdfQuizOptionsSchema>;
