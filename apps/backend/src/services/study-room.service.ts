import { eq, or, desc } from 'drizzle-orm';
import { db } from '../db/index';
import {
  studyRooms,
  studyRoomMembers,
  users,
  quizzes,
  questions,
  choices,
} from '../db/schema/index';
import {
  CreateStudyRoomInput,
  StudyRoomDto,
} from '@quiz-forge/shared';

export class StudyRoomError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'StudyRoomError';
  }
}

export class StudyRoomService {
  private generateRoomCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createRoom(
    hostUserId: string,
    input: CreateStudyRoomInput,
    database = db
  ): Promise<StudyRoomDto> {
    const hostUser = database
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, hostUserId))
      .get();

    if (!hostUser) {
      throw new StudyRoomError('User not found', 404, 'USER_NOT_FOUND');
    }

    let quizTitle: string | null = null;
    if (input.quizId) {
      const quiz = database
        .select({ id: quizzes.id, topic: quizzes.topic })
        .from(quizzes)
        .where(eq(quizzes.id, input.quizId))
        .get();

      if (!quiz) {
        throw new StudyRoomError('Quiz not found', 404, 'QUIZ_NOT_FOUND');
      }
      quizTitle = quiz.topic;
    }

    // Generate unique 6-character code
    let code = this.generateRoomCode();
    let attempts = 0;
    while (attempts < 5) {
      const existing = database
        .select({ id: studyRooms.id })
        .from(studyRooms)
        .where(eq(studyRooms.code, code))
        .get();
      if (!existing) break;
      code = this.generateRoomCode();
      attempts++;
    }

    const roomId = crypto.randomUUID();
    const now = new Date().toISOString();

    database.insert(studyRooms).values({
      id: roomId,
      code,
      title: input.title.trim(),
      hostUserId,
      quizId: input.quizId || null,
      status: 'active',
      maxParticipants: input.maxParticipants || 10,
      createdAt: now,
    }).run();

    database.insert(studyRoomMembers).values({
      id: crypto.randomUUID(),
      roomId,
      userId: hostUserId,
      role: 'host',
      joinedAt: now,
    }).run();

    return {
      id: roomId,
      code,
      title: input.title.trim(),
      hostUserId,
      hostName: hostUser.displayName,
      quizId: input.quizId || null,
      quizTitle,
      status: 'active',
      maxParticipants: input.maxParticipants || 10,
      createdAt: now,
      activeParticipantsCount: 1,
    };
  }

  async getRoom(roomIdOrCode: string, database = db): Promise<StudyRoomDto> {
    const upper = roomIdOrCode.trim().toUpperCase();
    const room = database
      .select()
      .from(studyRooms)
      .where(or(eq(studyRooms.id, roomIdOrCode), eq(studyRooms.code, upper)))
      .get();

    if (!room) {
      throw new StudyRoomError('Study room not found', 404, 'ROOM_NOT_FOUND');
    }

    const host = database
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, room.hostUserId))
      .get();

    let quizData: StudyRoomDto['quizData'] = null;
    let quizTitle: string | null = null;

    if (room.quizId) {
      const quiz = database
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, room.quizId))
        .get();

      if (quiz) {
        quizTitle = quiz.topic;
        const qList = database
          .select()
          .from(questions)
          .where(eq(questions.quizId, quiz.id))
          .all();

        const fullQuestions = qList.map((q) => {
          const cList = database
            .select()
            .from(choices)
            .where(eq(choices.questionId, q.id))
            .all();

          return {
            id: q.id,
            questionText: q.questionText,
            explanation: q.explanation,
            choices: cList.map((c) => ({
              id: c.id,
              choiceText: c.optionText,
              isCorrect: c.choiceId === q.correctChoiceId,
            })),
          };
        });

        quizData = {
          id: quiz.id,
          title: quiz.topic,
          topic: quiz.topic,
          questions: fullQuestions,
        };
      }
    }

    return {
      id: room.id,
      code: room.code,
      title: room.title,
      hostUserId: room.hostUserId,
      hostName: host?.displayName || 'Host',
      quizId: room.quizId,
      quizTitle,
      status: room.status as 'active' | 'ended',
      maxParticipants: room.maxParticipants,
      createdAt: room.createdAt,
      endedAt: room.endedAt,
      activeParticipantsCount: 0,
      quizData,
    };
  }

  async listActiveRooms(database = db): Promise<StudyRoomDto[]> {
    const rooms = database
      .select({
        id: studyRooms.id,
        code: studyRooms.code,
        title: studyRooms.title,
        hostUserId: studyRooms.hostUserId,
        quizId: studyRooms.quizId,
        status: studyRooms.status,
        maxParticipants: studyRooms.maxParticipants,
        createdAt: studyRooms.createdAt,
        endedAt: studyRooms.endedAt,
        hostName: users.displayName,
        quizTitle: quizzes.topic,
      })
      .from(studyRooms)
      .innerJoin(users, eq(studyRooms.hostUserId, users.id))
      .leftJoin(quizzes, eq(studyRooms.quizId, quizzes.id))
      .where(eq(studyRooms.status, 'active'))
      .orderBy(desc(studyRooms.createdAt))
      .limit(50)
      .all();

    return rooms.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      hostUserId: r.hostUserId,
      hostName: r.hostName,
      quizId: r.quizId,
      quizTitle: r.quizTitle,
      status: r.status as 'active' | 'ended',
      maxParticipants: r.maxParticipants,
      createdAt: r.createdAt,
      endedAt: r.endedAt,
      activeParticipantsCount: 0,
    }));
  }

  async endRoom(hostUserId: string, roomId: string, database = db): Promise<StudyRoomDto> {
    const room = database
      .select()
      .from(studyRooms)
      .where(eq(studyRooms.id, roomId))
      .get();

    if (!room) {
      throw new StudyRoomError('Study room not found', 404, 'ROOM_NOT_FOUND');
    }

    if (room.hostUserId !== hostUserId) {
      throw new StudyRoomError('Only the room host can end the study room', 403, 'FORBIDDEN');
    }

    const now = new Date().toISOString();
    database
      .update(studyRooms)
      .set({ status: 'ended', endedAt: now })
      .where(eq(studyRooms.id, roomId))
      .run();

    return this.getRoom(roomId, database);
  }
}

export const studyRoomService = new StudyRoomService();
