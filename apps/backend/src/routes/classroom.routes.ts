import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  createClassroomSchema,
  joinClassroomSchema,
  createAssignmentSchema,
  updateAssignmentSchema,
} from '@quiz-forge/shared';
import { classroomService, ClassroomError } from '../services/classroom.service';

export const classroomRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // All classroom routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/classrooms (Teacher only)
  app.post(
    '/',
    { preHandler: [app.requireRole(['teacher', 'admin'])] },
    async (request, reply) => {
      const parseResult = createClassroomSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid classroom data.',
            details: parseResult.error.format(),
          },
        });
      }

      try {
        const classroom = await classroomService.createClassroom(
          request.user!.id,
          parseResult.data
        );
        return reply.status(201).send({
          success: true,
          data: classroom,
        });
      } catch (err: unknown) {
        if (err instanceof ClassroomError) {
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
    }
  );

  // GET /api/classrooms
  app.get('/', async (request, reply) => {
    try {
      const isTeacher = request.user!.role === 'teacher' || request.user!.role === 'admin';
      const classrooms = isTeacher
        ? await classroomService.getClassroomsForTeacher(request.user!.id)
        : await classroomService.getClassroomsForStudent(request.user!.id);

      return reply.status(200).send({
        success: true,
        data: classrooms,
      });
    } catch (err: unknown) {
      if (err instanceof ClassroomError) {
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

  // GET /api/classrooms/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    try {
      const details = await classroomService.getClassroomDetails(
        request.user!.id,
        request.params.id
      );
      return reply.status(200).send({
        success: true,
        data: details,
      });
    } catch (err: unknown) {
      if (err instanceof ClassroomError) {
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

  // POST /api/classrooms/join (Student)
  app.post('/join', async (request, reply) => {
    const parseResult = joinClassroomSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid classroom code format.',
          details: parseResult.error.format(),
        },
      });
    }

    try {
      const classroom = await classroomService.joinClassroom(
        request.user!.id,
        parseResult.data
      );
      return reply.status(200).send({
        success: true,
        data: classroom,
      });
    } catch (err: unknown) {
      if (err instanceof ClassroomError) {
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

  // POST /api/classrooms/assignments (Teacher only)
  app.post(
    '/assignments',
    { preHandler: [app.requireRole(['teacher', 'admin'])] },
    async (request, reply) => {
      const parseResult = createAssignmentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid assignment parameters.',
            details: parseResult.error.format(),
          },
        });
      }

      try {
        const assignment = await classroomService.createAssignment(
          request.user!.id,
          parseResult.data
        );
        return reply.status(201).send({
          success: true,
          data: assignment,
        });
      } catch (err: unknown) {
        if (err instanceof ClassroomError) {
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
    }
  );

  // GET /api/classrooms/assignments/student (Student assigned tasks)
  app.get('/assignments/student', async (request, reply) => {
    try {
      const assignments = await classroomService.getStudentAssignments(request.user!.id);
      return reply.status(200).send({
        success: true,
        data: assignments,
      });
    } catch (err: unknown) {
      if (err instanceof ClassroomError) {
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

  // GET /api/classrooms/assignments/:id
  app.get<{ Params: { id: string } }>('/assignments/:id', async (request, reply) => {
    try {
      const assignment = await classroomService.getAssignmentDetails(
        request.user!.id,
        request.params.id
      );
      return reply.status(200).send({
        success: true,
        data: assignment,
      });
    } catch (err: unknown) {
      if (err instanceof ClassroomError) {
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

  // GET /api/classrooms/assignments/:id/submissions (Teacher only)
  app.get<{ Params: { id: string } }>(
    '/assignments/:id/submissions',
    { preHandler: [app.requireRole(['teacher', 'admin'])] },
    async (request, reply) => {
      try {
        const submissions = await classroomService.getAssignmentSubmissions(
          request.user!.id,
          request.params.id
        );
        return reply.status(200).send({
          success: true,
          data: submissions,
        });
      } catch (err: unknown) {
        if (err instanceof ClassroomError) {
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
    }
  );

  // POST /api/classrooms/assignments/:id/start (Student begins or resumes assigned quiz)
  app.post<{ Params: { id: string } }>('/assignments/:id/start', async (request, reply) => {
    try {
      const result = await classroomService.startAssignmentAttempt(
        request.user!.id,
        request.params.id
      );
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err: unknown) {
      if (err instanceof ClassroomError) {
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

  // PUT /api/classrooms/assignments/:id (Teacher only: update assignment settings)
  app.put<{ Params: { id: string } }>(
    '/assignments/:id',
    { preHandler: [app.requireRole(['teacher', 'admin'])] },
    async (request, reply) => {
      const parseResult = updateAssignmentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid assignment update parameters.',
            details: parseResult.error.format(),
          },
        });
      }

      try {
        const updated = await classroomService.updateAssignment(
          request.user!.id,
          request.params.id,
          parseResult.data
        );
        return reply.status(200).send({
          success: true,
          data: updated,
        });
      } catch (err: unknown) {
        if (err instanceof ClassroomError) {
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
    }
  );

  // DELETE /api/classrooms/assignments/:id (Teacher only: delete assignment)
  app.delete<{ Params: { id: string } }>(
    '/assignments/:id',
    { preHandler: [app.requireRole(['teacher', 'admin'])] },
    async (request, reply) => {
      try {
        const result = await classroomService.deleteAssignment(
          request.user!.id,
          request.params.id
        );
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        if (err instanceof ClassroomError) {
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
    }
  );

  // DELETE /api/classrooms/:id (Teacher only: delete classroom)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [app.requireRole(['teacher', 'admin'])] },
    async (request, reply) => {
      try {
        const result = await classroomService.deleteClassroom(
          request.user!.id,
          request.params.id
        );
        return reply.status(200).send({
          success: true,
          data: result,
        });
      } catch (err: unknown) {
        if (err instanceof ClassroomError) {
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
    }
  );
};
