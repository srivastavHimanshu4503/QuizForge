import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/index';
import {
  classrooms,
  classroomMembers,
  quizAssignments,
  users,
  quizzes,
  questions,
  codeQuizzes,
  quizAttempts,
} from '../db/schema/index';
import {
  CreateClassroomInput,
  JoinClassroomInput,
  CreateAssignmentInput,
  ClassroomDto,
  AssignmentDto,
  StudentSubmissionDto,
} from '@quiz-forge/shared';
import { shuffleArray } from '../utils/shuffle';

export class ClassroomError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ClassroomError';
  }
}

export class ClassroomService {
  private generateRandomCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (I, 1, O, 0)
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async createClassroom(
    teacherId: string,
    input: CreateClassroomInput,
    database = db
  ): Promise<ClassroomDto> {
    const teacher = database
      .select()
      .from(users)
      .where(eq(users.id, teacherId))
      .get();

    if (!teacher) {
      throw new ClassroomError('Teacher account not found.', 404, 'TEACHER_NOT_FOUND');
    }

    let code = this.generateRandomCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = database
        .select()
        .from(classrooms)
        .where(eq(classrooms.code, code))
        .get();
      if (!existing) break;
      code = this.generateRandomCode();
      attempts++;
    }

    const [classroom] = database
      .insert(classrooms)
      .values({
        teacherId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        code,
      })
      .returning()
      .all();

    if (!classroom) {
      throw new ClassroomError('Failed to create classroom.', 500, 'CLASSROOM_CREATION_FAILED');
    }

    return {
      id: classroom.id,
      teacherId: classroom.teacherId,
      teacherName: teacher.displayName,
      name: classroom.name,
      description: classroom.description,
      code: classroom.code,
      memberCount: 0,
      assignmentCount: 0,
      createdAt: classroom.createdAt,
    };
  }

  async getClassroomsForTeacher(teacherId: string, database = db): Promise<ClassroomDto[]> {
    const teacher = database
      .select()
      .from(users)
      .where(eq(users.id, teacherId))
      .get();

    if (!teacher) {
      return [];
    }

    const classList = database
      .select()
      .from(classrooms)
      .where(eq(classrooms.teacherId, teacherId))
      .orderBy(desc(classrooms.createdAt))
      .all();

    return classList.map((c) => {
      const members = database
        .select({ count: sql<number>`count(*)` })
        .from(classroomMembers)
        .where(eq(classroomMembers.classroomId, c.id))
        .get();

      const assignments = database
        .select({ count: sql<number>`count(*)` })
        .from(quizAssignments)
        .where(eq(quizAssignments.classroomId, c.id))
        .get();

      return {
        id: c.id,
        teacherId: c.teacherId,
        teacherName: teacher.displayName,
        name: c.name,
        description: c.description,
        code: c.code,
        memberCount: members?.count || 0,
        assignmentCount: assignments?.count || 0,
        createdAt: c.createdAt,
      };
    });
  }

  async getClassroomsForStudent(studentId: string, database = db): Promise<ClassroomDto[]> {
    const enrollments = database
      .select({
        membership: classroomMembers,
        classroom: classrooms,
        teacher: users,
      })
      .from(classroomMembers)
      .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
      .innerJoin(users, eq(classrooms.teacherId, users.id))
      .where(eq(classroomMembers.studentId, studentId))
      .orderBy(desc(classroomMembers.joinedAt))
      .all();

    return enrollments.map(({ classroom, teacher }) => {
      const members = database
        .select({ count: sql<number>`count(*)` })
        .from(classroomMembers)
        .where(eq(classroomMembers.classroomId, classroom.id))
        .get();

      const assignments = database
        .select({ count: sql<number>`count(*)` })
        .from(quizAssignments)
        .where(eq(quizAssignments.classroomId, classroom.id))
        .get();

      return {
        id: classroom.id,
        teacherId: classroom.teacherId,
        teacherName: teacher.displayName,
        name: classroom.name,
        description: classroom.description,
        code: classroom.code,
        memberCount: members?.count || 0,
        assignmentCount: assignments?.count || 0,
        createdAt: classroom.createdAt,
      };
    });
  }

  async joinClassroom(
    studentId: string,
    input: JoinClassroomInput,
    database = db
  ): Promise<ClassroomDto> {
    const normalizedCode = input.code.trim().toUpperCase();

    const classroom = database
      .select()
      .from(classrooms)
      .where(eq(classrooms.code, normalizedCode))
      .get();

    if (!classroom) {
      throw new ClassroomError('Invalid classroom code. Classroom not found.', 404, 'CLASSROOM_NOT_FOUND');
    }

    if (classroom.teacherId === studentId) {
      throw new ClassroomError('You cannot enroll in your own classroom.', 400, 'SELF_ENROLLMENT_DISALLOWED');
    }

    const existingMembership = database
      .select()
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, classroom.id),
          eq(classroomMembers.studentId, studentId)
        )
      )
      .get();

    if (existingMembership) {
      throw new ClassroomError('You are already enrolled in this classroom.', 409, 'ALREADY_ENROLLED');
    }

    database
      .insert(classroomMembers)
      .values({
        classroomId: classroom.id,
        studentId,
      })
      .run();

    const teacher = database
      .select()
      .from(users)
      .where(eq(users.id, classroom.teacherId))
      .get();

    const members = database
      .select({ count: sql<number>`count(*)` })
      .from(classroomMembers)
      .where(eq(classroomMembers.classroomId, classroom.id))
      .get();

    const assignments = database
      .select({ count: sql<number>`count(*)` })
      .from(quizAssignments)
      .where(eq(quizAssignments.classroomId, classroom.id))
      .get();

    return {
      id: classroom.id,
      teacherId: classroom.teacherId,
      teacherName: teacher?.displayName || 'Instructor',
      name: classroom.name,
      description: classroom.description,
      code: classroom.code,
      memberCount: members?.count || 0,
      assignmentCount: assignments?.count || 0,
      createdAt: classroom.createdAt,
    };
  }

  async getClassroomDetails(
    userId: string,
    classroomId: string,
    database = db
  ): Promise<{
    classroom: ClassroomDto;
    members: { studentId: string; studentName: string; studentEmail: string; joinedAt: string }[];
    assignments: {
      id: string;
      title: string;
      quizType: 'mcq' | 'code_review';
      dueDate: string | null;
      maxAttempts: number;
      createdAt: string;
    }[];
  }> {
    const classroom = database
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId))
      .get();

    if (!classroom) {
      throw new ClassroomError('Classroom not found.', 404, 'CLASSROOM_NOT_FOUND');
    }

    // Check authorization: user must be teacher OR enrolled student
    const isTeacher = classroom.teacherId === userId;
    const isEnrolled = database
      .select()
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, classroomId),
          eq(classroomMembers.studentId, userId)
        )
      )
      .get();

    if (!isTeacher && !isEnrolled) {
      throw new ClassroomError('Unauthorized access to classroom.', 403, 'FORBIDDEN');
    }

    const teacher = database
      .select()
      .from(users)
      .where(eq(users.id, classroom.teacherId))
      .get();

    const members = database
      .select({
        studentId: users.id,
        studentName: users.displayName,
        studentEmail: users.email,
        joinedAt: classroomMembers.joinedAt,
      })
      .from(classroomMembers)
      .innerJoin(users, eq(classroomMembers.studentId, users.id))
      .where(eq(classroomMembers.classroomId, classroomId))
      .orderBy(desc(classroomMembers.joinedAt))
      .all();

    const assignmentList = database
      .select({
        id: quizAssignments.id,
        title: quizAssignments.title,
        quizType: quizAssignments.quizType,
        dueDate: quizAssignments.dueDate,
        maxAttempts: quizAssignments.maxAttempts,
        createdAt: quizAssignments.createdAt,
      })
      .from(quizAssignments)
      .where(eq(quizAssignments.classroomId, classroomId))
      .orderBy(desc(quizAssignments.createdAt))
      .all();

    return {
      classroom: {
        id: classroom.id,
        teacherId: classroom.teacherId,
        teacherName: teacher?.displayName || 'Instructor',
        name: classroom.name,
        description: classroom.description,
        code: classroom.code,
        memberCount: members.length,
        assignmentCount: assignmentList.length,
        createdAt: classroom.createdAt,
      },
      members,
      assignments: assignmentList,
    };
  }

  async createAssignment(
    teacherId: string,
    input: CreateAssignmentInput,
    database = db
  ): Promise<AssignmentDto> {
    const classroom = database
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, input.classroomId))
      .get();

    if (!classroom) {
      throw new ClassroomError('Classroom not found.', 404, 'CLASSROOM_NOT_FOUND');
    }

    if (classroom.teacherId !== teacherId) {
      throw new ClassroomError('Only the classroom instructor can assign quizzes.', 403, 'FORBIDDEN');
    }

    let quizTopic = 'Quiz';
    if (input.quizType === 'mcq') {
      const quiz = database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .get();
      if (!quiz) {
        throw new ClassroomError('Referenced MCQ quiz was not found.', 404, 'QUIZ_NOT_FOUND');
      }
      quizTopic = quiz.topic;
    } else {
      const codeQuiz = database
        .select()
        .from(codeQuizzes)
        .where(eq(codeQuizzes.id, input.quizId))
        .get();
      if (!codeQuiz) {
        throw new ClassroomError('Referenced code review quiz was not found.', 404, 'QUIZ_NOT_FOUND');
      }
      quizTopic = codeQuiz.repoName;
    }

    const [assignment] = database
      .insert(quizAssignments)
      .values({
        classroomId: input.classroomId,
        teacherId,
        quizId: input.quizId,
        quizType: input.quizType,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        dueDate: input.dueDate || null,
        maxAttempts: input.maxAttempts,
        timeLimitMinutes: input.timeLimitMinutes || null,
        showFeedbackImmediately: input.showFeedbackImmediately,
      })
      .returning()
      .all();

    if (!assignment) {
      throw new ClassroomError('Failed to create assignment.', 500, 'ASSIGNMENT_CREATION_FAILED');
    }

    return {
      id: assignment.id,
      classroomId: assignment.classroomId,
      classroomName: classroom.name,
      quizId: assignment.quizId,
      quizType: assignment.quizType,
      quizTopic,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      maxAttempts: assignment.maxAttempts,
      timeLimitMinutes: assignment.timeLimitMinutes,
      showFeedbackImmediately: assignment.showFeedbackImmediately,
      myAttemptsCount: 0,
      myBestScore: null,
      isCompleted: false,
      isOverdue: false,
      createdAt: assignment.createdAt,
    };
  }

  async getStudentAssignments(studentId: string, database = db): Promise<AssignmentDto[]> {
    // Find all enrolled classrooms
    const enrolledClasses = database
      .select({ classroom: classrooms })
      .from(classroomMembers)
      .innerJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
      .where(eq(classroomMembers.studentId, studentId))
      .all();

    if (enrolledClasses.length === 0) {
      return [];
    }

    const results: AssignmentDto[] = [];
    const now = new Date();

    for (const { classroom } of enrolledClasses) {
      const assignments = database
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.classroomId, classroom.id))
        .orderBy(desc(quizAssignments.createdAt))
        .all();

      for (const a of assignments) {
        let topic = 'Quiz';
        if (a.quizType === 'mcq') {
          const q = database.select().from(quizzes).where(eq(quizzes.id, a.quizId)).get();
          if (q) topic = q.topic;
        } else {
          const cq = database.select().from(codeQuizzes).where(eq(codeQuizzes.id, a.quizId)).get();
          if (cq) topic = cq.repoName;
        }

        // Check student's attempts for this assignment
        let attemptsCount = 0;
        let bestScore: number | null = null;
        let isCompleted = false;

        if (a.quizType === 'mcq') {
          const attempts = database
            .select()
            .from(quizAttempts)
            .where(
              and(
                eq(quizAttempts.userId, studentId),
                eq(quizAttempts.assignmentId, a.id)
              )
            )
            .all();

          attemptsCount = attempts.length;
          for (const att of attempts) {
            if (att.status === 'completed') {
              isCompleted = true;
              if (att.score !== null) {
                bestScore = bestScore === null ? att.score : Math.max(bestScore, att.score);
              }
            }
          }
        }

        const isOverdue = Boolean(a.dueDate && new Date(a.dueDate) < now && !isCompleted);

        results.push({
          id: a.id,
          classroomId: a.classroomId,
          classroomName: classroom.name,
          quizId: a.quizId,
          quizType: a.quizType,
          quizTopic: topic,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate,
          maxAttempts: a.maxAttempts,
          timeLimitMinutes: a.timeLimitMinutes,
          showFeedbackImmediately: a.showFeedbackImmediately,
          myAttemptsCount: attemptsCount,
          myBestScore: bestScore,
          isCompleted,
          isOverdue,
          createdAt: a.createdAt,
        });
      }
    }

    return results;
  }

  async getAssignmentDetails(
    userId: string,
    assignmentId: string,
    database = db
  ): Promise<AssignmentDto> {
    const assignment = database
      .select()
      .from(quizAssignments)
      .where(eq(quizAssignments.id, assignmentId))
      .get();

    if (!assignment) {
      throw new ClassroomError('Assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
    }

    const classroom = database
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, assignment.classroomId))
      .get();

    if (!classroom) {
      throw new ClassroomError('Associated classroom not found.', 404, 'CLASSROOM_NOT_FOUND');
    }

    const isTeacher = assignment.teacherId === userId;
    const isEnrolled = database
      .select()
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, assignment.classroomId),
          eq(classroomMembers.studentId, userId)
        )
      )
      .get();

    if (!isTeacher && !isEnrolled) {
      throw new ClassroomError('Unauthorized access to this assignment.', 403, 'FORBIDDEN');
    }

    let topic = 'Quiz';
    if (assignment.quizType === 'mcq') {
      const q = database.select().from(quizzes).where(eq(quizzes.id, assignment.quizId)).get();
      if (q) topic = q.topic;
    } else {
      const cq = database.select().from(codeQuizzes).where(eq(codeQuizzes.id, assignment.quizId)).get();
      if (cq) topic = cq.repoName;
    }

    const attempts = database
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, userId),
          eq(quizAttempts.assignmentId, assignment.id)
        )
      )
      .all();

    let bestScore: number | null = null;
    let isCompleted = false;
    for (const att of attempts) {
      if (att.status === 'completed') {
        isCompleted = true;
        if (att.score !== null) {
          bestScore = bestScore === null ? att.score : Math.max(bestScore, att.score);
        }
      }
    }

    const isOverdue = Boolean(assignment.dueDate && new Date(assignment.dueDate) < new Date() && !isCompleted);

    return {
      id: assignment.id,
      classroomId: assignment.classroomId,
      classroomName: classroom.name,
      quizId: assignment.quizId,
      quizType: assignment.quizType,
      quizTopic: topic,
      title: assignment.title,
      description: assignment.description,
      dueDate: assignment.dueDate,
      maxAttempts: assignment.maxAttempts,
      timeLimitMinutes: assignment.timeLimitMinutes,
      showFeedbackImmediately: assignment.showFeedbackImmediately,
      myAttemptsCount: attempts.length,
      myBestScore: bestScore,
      isCompleted,
      isOverdue,
      createdAt: assignment.createdAt,
    };
  }

  async getAssignmentSubmissions(
    teacherId: string,
    assignmentId: string,
    database = db
  ): Promise<StudentSubmissionDto[]> {
    const assignment = database
      .select()
      .from(quizAssignments)
      .where(eq(quizAssignments.id, assignmentId))
      .get();

    if (!assignment) {
      throw new ClassroomError('Assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
    }

    if (assignment.teacherId !== teacherId) {
      throw new ClassroomError('Only the instructor can view submission analytics.', 403, 'FORBIDDEN');
    }

    const students = database
      .select({
        studentId: users.id,
        studentName: users.displayName,
        studentEmail: users.email,
      })
      .from(classroomMembers)
      .innerJoin(users, eq(classroomMembers.studentId, users.id))
      .where(eq(classroomMembers.classroomId, assignment.classroomId))
      .all();

    return students.map((s) => {
      const attempts = database
        .select()
        .from(quizAttempts)
        .where(
          and(
            eq(quizAttempts.userId, s.studentId),
            eq(quizAttempts.assignmentId, assignment.id)
          )
        )
        .orderBy(desc(quizAttempts.startedAt))
        .all();

      let bestScore: number | null = null;
      let status: 'not_started' | 'in_progress' | 'completed' = 'not_started';
      let lastAttemptAt: string | null = null;

      if (attempts.length > 0) {
        lastAttemptAt = attempts[0]?.startedAt || null;
        const hasCompleted = attempts.some((a) => a.status === 'completed');
        const hasInProgress = attempts.some((a) => a.status === 'in_progress');

        if (hasCompleted) {
          status = 'completed';
          for (const a of attempts) {
            if (a.score !== null) {
              bestScore = bestScore === null ? a.score : Math.max(bestScore, a.score);
            }
          }
        } else if (hasInProgress) {
          status = 'in_progress';
        }
      }

      return {
        studentId: s.studentId,
        studentName: s.studentName,
        studentEmail: s.studentEmail,
        attemptsCount: attempts.length,
        bestScore,
        lastAttemptAt,
        status,
      };
    });
  }

  async startAssignmentAttempt(
    studentId: string,
    assignmentId: string,
    database = db
  ): Promise<{
    attemptId: string;
    quizId: string;
    totalQuestions: number;
    status: 'in_progress';
  }> {
    const assignment = database
      .select()
      .from(quizAssignments)
      .where(eq(quizAssignments.id, assignmentId))
      .get();

    if (!assignment) {
      throw new ClassroomError('Assignment not found.', 404, 'ASSIGNMENT_NOT_FOUND');
    }

    // Verify enrollment
    const isEnrolled = database
      .select()
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, assignment.classroomId),
          eq(classroomMembers.studentId, studentId)
        )
      )
      .get();

    if (!isEnrolled) {
      throw new ClassroomError('You must be enrolled in this classroom to attempt this quiz.', 403, 'FORBIDDEN');
    }

    // Verify due date
    if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) {
      throw new ClassroomError('Assignment deadline has passed. Submissions are closed.', 400, 'ASSIGNMENT_OVERDUE');
    }

    // Fetch existing attempts by this student for this assignment
    const existingAttempts = database
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.userId, studentId),
          eq(quizAttempts.assignmentId, assignment.id)
        )
      )
      .all();

    // Check if there's already an active in_progress attempt
    const activeAttempt = existingAttempts.find((a) => a.status === 'in_progress');
    if (activeAttempt) {
      return {
        attemptId: activeAttempt.id,
        quizId: activeAttempt.quizId,
        totalQuestions: activeAttempt.totalQuestions,
        status: 'in_progress',
      };
    }

    // Check attempt limits
    if (existingAttempts.length >= assignment.maxAttempts) {
      throw new ClassroomError(
        `Maximum attempt limit of ${assignment.maxAttempts} reached for this assignment.`,
        400,
        'MAX_ATTEMPTS_REACHED'
      );
    }

    // Fetch master quiz questions
    const masterQuiz = database
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, assignment.quizId))
      .get();

    if (!masterQuiz) {
      throw new ClassroomError('Underlying quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    const masterQuestions = database
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.quizId, masterQuiz.id))
      .all();

    const questionIds = masterQuestions.map((q) => q.id);
    const shuffledOrder = shuffleArray([...questionIds]);

    const newAttemptId = crypto.randomUUID();
    const attemptNumber = existingAttempts.length + 1;

    database
      .insert(quizAttempts)
      .values({
        id: newAttemptId,
        quizId: masterQuiz.id,
        userId: studentId,
        assignmentId: assignment.id,
        attemptNumber,
        status: 'in_progress',
        shuffledOrder,
        totalQuestions: questionIds.length,
      })
      .run();

    return {
      attemptId: newAttemptId,
      quizId: masterQuiz.id,
      totalQuestions: questionIds.length,
      status: 'in_progress',
    };
  }
}

export const classroomService = new ClassroomService();
