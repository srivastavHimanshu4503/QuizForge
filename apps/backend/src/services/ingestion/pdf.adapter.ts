import { PDFParse } from 'pdf-parse';
import { NormalizedDocument, DocumentChunk } from '@quiz-forge/shared';
import { fileSecurityService } from './file-security.service';

export class PDFIngestionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'PDFIngestionError';
  }
}

export class PDFIngestionAdapter {
  async ingest(
    buffer: Buffer,
    filename: string,
    _options?: { maxPages?: number }
  ): Promise<NormalizedDocument> {
    // 1. Strict binary & size validation
    const { sizeBytes, sha256 } = fileSecurityService.validatePdfBuffer(buffer, filename);

    // 2. Parse PDF
    let rawText = '';
    let pageCount = 1;
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      rawText = textResult.text || '';
      pageCount = textResult.total || 1;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new PDFIngestionError(
        `Failed to parse PDF document: ${msg}`,
        400,
        'PDF_PARSE_FAILED'
      );
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
    }
    // Clean and normalize text
    const cleanedText = rawText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // remove unprintable control chars
      .replace(/\r\n/g, '\n')
      .trim();

    if (cleanedText.length < 50) {
      throw new PDFIngestionError(
        'The uploaded PDF document contains insufficient extractable text (< 50 characters). It may be a scanned image or protected document.',
        400,
        'INSUFFICIENT_TEXT'
      );
    }

    // 3. Semantic Chunking (chunks of ~1,500 characters respecting paragraph boundaries)
    const chunks: DocumentChunk[] = [];
    const paragraphs = cleanedText.split(/\n\s*\n/);
    let currentChunk = '';
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if ((currentChunk + '\n\n' + trimmed).length > 1500 && currentChunk.length > 200) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          orderIndex: chunkIndex,
          content: currentChunk.trim(),
          tokenEstimate: Math.ceil(currentChunk.length / 4),
        });
        chunkIndex++;
        currentChunk = trimmed;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        orderIndex: chunkIndex,
        content: currentChunk.trim(),
        tokenEstimate: Math.ceil(currentChunk.length / 4),
      });
    }

    const totalTokenEstimate = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    return {
      id: crypto.randomUUID(),
      sourceType: 'pdf',
      sourceIdentifier: filename,
      title: filename.replace(/\.pdf$/i, ''),
      metadata: {
        mimeType: 'application/pdf',
        fileSizeBytes: sizeBytes,
        extractedAt: Date.now(),
        pageCount: pageCount,
        checksumSha256: sha256,
      },
      chunks,
      totalTokenEstimate,
    };
  }
}

export const pdfIngestionAdapter = new PDFIngestionAdapter();
