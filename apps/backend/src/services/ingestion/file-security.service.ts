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
  private readonly maxImageSizeBytes = 10 * 1024 * 1024; // 10 MB
  private readonly pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
  private readonly pngMagicBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  private readonly jpegMagicBytes = Buffer.from([0xff, 0xd8, 0xff]);
  private readonly webpRiffBytes = Buffer.from([0x52, 0x49, 0x46, 0x46]); // RIFF
  private readonly webpHeaderBytes = Buffer.from([0x57, 0x45, 0x42, 0x50]); // WEBP

  validateImageBuffer(buffer: Buffer, originalFilename = 'image.png'): {
    sizeBytes: number;
    sha256: string;
    mimeType: string;
  } {
    if (!buffer || buffer.length === 0) {
      throw new FileSecurityError('Uploaded image file is empty.', 400, 'EMPTY_FILE');
    }

    if (buffer.length > this.maxImageSizeBytes) {
      throw new FileSecurityError(
        `Image file size exceeds maximum allowed limit of ${Math.round(this.maxImageSizeBytes / (1024 * 1024))} MB.`,
        400,
        'FILE_TOO_LARGE'
      );
    }

    let mimeType: string | null = null;

    // Check PNG
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(this.pngMagicBytes)) {
      mimeType = 'image/png';
    }
    // Check JPEG
    else if (buffer.length >= 3 && buffer.subarray(0, 3).equals(this.jpegMagicBytes)) {
      mimeType = 'image/jpeg';
    }
    // Check WebP (RIFF at 0..4, WEBP at 8..12)
    else if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).equals(this.webpRiffBytes) &&
      buffer.subarray(8, 12).equals(this.webpHeaderBytes)
    ) {
      mimeType = 'image/webp';
    }

    if (!mimeType) {
      throw new FileSecurityError(
        `File '${originalFilename}' failed binary signature verification. It is not a supported image format (PNG, JPEG, WebP only).`,
        400,
        'FILE_SIGNATURE_MISMATCH'
      );
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      sizeBytes: buffer.length,
      sha256,
      mimeType,
    };
  }

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
