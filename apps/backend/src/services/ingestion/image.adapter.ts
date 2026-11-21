import crypto from 'node:crypto';
import { NormalizedDocument } from '@quiz-forge/shared';
import { fileSecurityService } from './file-security.service';

export class ImageIngestionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ImageIngestionError';
  }
}

export interface IngestedImageResult {
  document: NormalizedDocument;
  base64: string;
  mimeType: string;
}

export class ImageIngestionAdapter {
  ingest(buffer: Buffer, filename = 'image.png'): IngestedImageResult {
    // 1. Strict binary & magic byte verification
    const { sizeBytes, sha256, mimeType } = fileSecurityService.validateImageBuffer(buffer, filename);

    // 2. Base64 encoding for multimodal vision payload
    const base64 = buffer.toString('base64');
    const baseTitle = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
    const title = baseTitle.charAt(0).toUpperCase() + baseTitle.slice(1);

    // 3. Assemble canonical NormalizedDocument
    const document: NormalizedDocument = {
      id: crypto.randomUUID(),
      sourceType: 'image',
      sourceIdentifier: filename,
      title,
      metadata: {
        mimeType,
        fileSizeBytes: sizeBytes,
        extractedAt: Date.now(),
        checksumSha256: sha256,
      },
      chunks: [
        {
          id: `img_chunk_${crypto.randomUUID().slice(0, 8)}`,
          orderIndex: 0,
          sectionTitle: 'Visual Document Content',
          content: `Visual Document: "${title}" (${mimeType}, ${(sizeBytes / 1024).toFixed(1)} KB). Analyzed by multimodal AI vision pipeline.`,
          tokenEstimate: 500,
        },
      ],
      totalTokenEstimate: 500,
    };

    return {
      document,
      base64,
      mimeType,
    };
  }
}

export const imageIngestionAdapter = new ImageIngestionAdapter();
