import crypto from 'node:crypto';

export class FileSecurityError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'FileSecurityError';
  }
}

export class FileSecurityService {
  private readonly maxPdfSizeBytes = 15 * 1024 * 1024; // 15 MB
  private readonly pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-

  validatePdfBuffer(buffer: Buffer, originalFilename = 'document.pdf'): {
    sizeBytes: number;
    sha256: string;
  } {
    if (!buffer || buffer.length === 0) {
      throw new FileSecurityError('Uploaded file is empty.', 400, 'EMPTY_FILE');
    }

    if (buffer.length > this.maxPdfSizeBytes) {
      throw new FileSecurityError(
        `File size exceeds maximum allowed limit of ${Math.round(this.maxPdfSizeBytes / (1024 * 1024))} MB.`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    // Magic Bytes Verification (First 5 bytes must match %PDF-)
    if (buffer.length < 5) {
      throw new FileSecurityError('Invalid PDF file signature.', 400, 'INVALID_FILE_SIGNATURE');
    }

    const header = buffer.subarray(0, 5);
    if (!header.equals(this.pdfMagicBytes)) {
      throw new FileSecurityError(
        `File '${originalFilename}' failed binary signature verification. It is not a legitimate PDF document.`,
        400,
        'FILE_SIGNATURE_MISMATCH'
      );
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      sizeBytes: buffer.length,
      sha256,
    };
  }
}

export const fileSecurityService = new FileSecurityService();
