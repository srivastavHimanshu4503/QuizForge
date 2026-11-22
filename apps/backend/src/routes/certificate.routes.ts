import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { pdfReportService, CertificateError } from '../services/pdf-report.service';

export const certificateRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Public verification endpoint
  app.get<{ Params: { code: string } }>(
    '/verify/:code',
    async (request, reply) => {
      try {
        const { code } = request.params;
        const result = await pdfReportService.verifyCertificate(code);
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err instanceof CertificateError) {
          return reply.status(err.statusCode).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Failed to verify certificate.' },
        });
      }
    }
  );

  // Authenticated endpoints below
  app.register(async (authApp) => {
    authApp.addHook('preHandler', app.authenticate);

    // Get certificate eligibility & metadata
    authApp.get<{ Params: { attemptId: string } }>(
      '/:attemptId/meta',
      async (request, reply) => {
        try {
          const { attemptId } = request.params;
          const meta = await pdfReportService.getCertificateMeta(
            attemptId,
            request.user!.id
          );
          return reply.status(200).send({
            success: true,
            data: meta,
          });
        } catch (err: any) {
          if (err instanceof CertificateError) {
            return reply.status(err.statusCode).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          request.log.error(err);
          return reply.status(500).send({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve certificate details.' },
          });
        }
      }
    );

    // Download Certificate PDF
    authApp.get<{ Params: { attemptId: string } }>(
      '/:attemptId/pdf',
      async (request, reply) => {
        try {
          const { attemptId } = request.params;
          const pdfBytes = await pdfReportService.generateCertificatePdf(
            attemptId,
            request.user!.id
          );

          reply.header('Content-Type', 'application/pdf');
          reply.header(
            'Content-Disposition',
            `attachment; filename="QuizForge-Certificate-${attemptId.slice(0, 8)}.pdf"`
          );
          return reply.status(200).send(Buffer.from(pdfBytes));
        } catch (err: any) {
          if (err instanceof CertificateError) {
            return reply.status(err.statusCode).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          request.log.error(err);
          return reply.status(500).send({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to generate certificate PDF.' },
          });
        }
      }
    );

    // Download Performance Report Card PDF
    authApp.get<{ Params: { attemptId: string } }>(
      '/:attemptId/report-card',
      async (request, reply) => {
        try {
          const { attemptId } = request.params;
          const pdfBytes = await pdfReportService.generatePerformanceReportCardPdf(
            attemptId,
            request.user!.id
          );

          reply.header('Content-Type', 'application/pdf');
          reply.header(
            'Content-Disposition',
            `attachment; filename="QuizForge-ReportCard-${attemptId.slice(0, 8)}.pdf"`
          );
          return reply.status(200).send(Buffer.from(pdfBytes));
        } catch (err: any) {
          if (err instanceof CertificateError) {
            return reply.status(err.statusCode).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          request.log.error(err);
          return reply.status(500).send({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to generate performance report card.' },
          });
        }
      }
    );
  });
};
