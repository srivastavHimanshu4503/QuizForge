import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { pdfQuizService } from '../services/pdf-quiz.service';
import { FileSecurityError } from '../services/ingestion/file-security.service';
import { PDFIngestionError } from '../services/ingestion/pdf.adapter';

export const pdfQuizRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All PDF quiz generation requires authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/quizzes/generate/pdf
  app.post('/generate/pdf', async (request, reply) => {
    let fileBuffer: Buffer | null = null;
    let filename = 'document.pdf';
    const fields: Record<string, string> = {};

    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer();
          filename = part.filename;
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (err: unknown) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'MULTIPART_ERROR',
          message: `Failed to process multipart upload: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'EMPTY_FILE',
          message: 'No PDF file was provided or file is empty.',
        },
      });
    }

    try {
      const result = pdfQuizService.generateQuizFromPdf(
        request.user!.id,
        fileBuffer,
        filename,
        {
          topic: fields.topic,
          questionCount: fields.questionCount ? parseInt(fields.questionCount, 10) : undefined,
          difficulty: fields.difficulty as any,
          provider: fields.provider,
        }
      );

      return reply.status(202).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof FileSecurityError || err instanceof PDFIngestionError) {
        return reply.status(err.statusCode).send({
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        });
      }
      throw err;
    }
  });
};
