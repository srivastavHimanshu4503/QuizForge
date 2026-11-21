import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { imageQuizService } from '../services/image-quiz.service';
import { FileSecurityError } from '../services/ingestion/file-security.service';
import { ImageIngestionError } from '../services/ingestion/image.adapter';

export const imageQuizRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All Image quiz generation requires authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/quizzes/generate/image
  app.post('/generate/image', async (request, reply) => {
    let fileBuffer: Buffer | null = null;
    let filename = 'image.png';
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
          message: 'No image file was provided or file is empty.',
        },
      });
    }

    try {
      const result = imageQuizService.generateQuizFromImage(
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
      if (err instanceof FileSecurityError || err instanceof ImageIngestionError) {
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
