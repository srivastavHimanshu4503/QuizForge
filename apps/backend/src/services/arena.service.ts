import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import {
  arenaSessions,
  arenaParticipants,
  arenaAnswers,
  quizzes,
  questions,
  choices,
} from '../db/schema/index';
import {
  ArenaStatus,
  ArenaStateDto,
  ArenaParticipantDto,
  ArenaLeaderboardEntry,
  ArenaQuestionState,
  ArenaQuestionEndState,
  ChoiceId,
} from '@quiz-forge/shared';

export class ArenaError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ArenaError';
  }
}

export class ArenaService {
  private generateRandomPin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Host creates a new arena live session
   */
  async createSession(
    hostId: string,
    quizId: string,
    timePerQuestionSeconds = 30,
    database = db
  ) {
    const quiz = database.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
    if (!quiz) {
      throw new ArenaError('Quiz not found.', 404, 'QUIZ_NOT_FOUND');
    }

    const quizQuestions = database
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .all();

    if (quizQuestions.length === 0) {
      throw new ArenaError(
        'Quiz has no questions. Cannot host an arena with 0 questions.',
        400,
        'QUIZ_HAS_NO_QUESTIONS'
      );
    }

    // Generate unique 6-digit PIN
    let pin = this.generateRandomPin();
    let collision = database
      .select({ id: arenaSessions.id })
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin))
      .get();

    let attempts = 0;
    while (collision && attempts < 10) {
      pin = this.generateRandomPin();
      collision = database
        .select({ id: arenaSessions.id })
        .from(arenaSessions)
        .where(eq(arenaSessions.pin, pin))
        .get();
      attempts++;
    }

    const sessionId = crypto.randomUUID();
    database
      .insert(arenaSessions)
      .values({
        id: sessionId,
        quizId,
        hostId,
        pin,
        status: 'lobby',
        currentQuestionIndex: 0,
        totalQuestions: quizQuestions.length,
        timePerQuestionSeconds,
        createdAt: new Date().toISOString(),
      })
      .run();

    return {
      sessionId,
      pin,
      quizId,
      quizTopic: quiz.topic,
      totalQuestions: quizQuestions.length,
      timePerQuestionSeconds,
    };
  }

  /**
   * Participant joins arena session with PIN and nickname
   */
  async joinSession(
    pin: string,
    nickname: string,
    userId?: string,
    database = db
  ) {
    const session = database
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin.trim()))
      .get();

    if (!session) {
      throw new ArenaError('Invalid Game PIN. No active room found.', 404, 'ROOM_NOT_FOUND');
    }

    if (session.status === 'finished' || session.status === 'abandoned') {
      throw new ArenaError('This game session has already ended.', 400, 'ROOM_FINISHED');
    }

    const cleanNick = nickname.trim();
    const existingNick = database
      .select()
      .from(arenaParticipants)
      .where(
        and(
          eq(arenaParticipants.sessionId, session.id),
          eq(arenaParticipants.nickname, cleanNick)
        )
      )
      .get();

    if (existingNick) {
      // If same user reconnecting with their existing participant record, allow it
      if (userId && existingNick.userId === userId) {
        return {
          session,
          participant: existingNick,
        };
      }
      throw new ArenaError(
        'Nickname is already taken in this room. Please choose another.',
        409,
        'NICKNAME_TAKEN'
      );
    }

    const participantId = crypto.randomUUID();
    database
      .insert(arenaParticipants)
      .values({
        id: participantId,
        sessionId: session.id,
        userId: userId ?? null,
        nickname: cleanNick,
        score: 0,
        streak: 0,
        joinedAt: new Date().toISOString(),
      })
      .run();

    const participant = database
      .select()
      .from(arenaParticipants)
      .where(eq(arenaParticipants.id, participantId))
      .get()!;

    return { session, participant };
  }

  /**
   * Retrieves aggregated arena state
   */
  async getArenaState(
    pin: string,
    requesterUserId?: string,
    database = db
  ): Promise<ArenaStateDto> {
    const session = database
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin.trim()))
      .get();

    if (!session) {
      throw new ArenaError('Arena session not found.', 404, 'ROOM_NOT_FOUND');
    }

    const quiz = database.select().from(quizzes).where(eq(quizzes.id, session.quizId)).get()!;
    const participants = database
      .select()
      .from(arenaParticipants)
      .where(eq(arenaParticipants.sessionId, session.id))
      .orderBy(desc(arenaParticipants.score))
      .all();

    const isHost = Boolean(requesterUserId && session.hostId === requesterUserId);

    // Fetch quiz questions
    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, session.quizId))
      .all();

    let currentQuestion: ArenaQuestionState | null = null;
    let questionEnd: ArenaQuestionEndState | null = null;
    let leaderboard: ArenaLeaderboardEntry[] = [];
    let podium: ArenaLeaderboardEntry[] = [];

    const currentQ = quizQuestions[session.currentQuestionIndex];

    if (currentQ && (session.status === 'question' || session.status === 'leaderboard')) {
      const qChoices = database
        .select()
        .from(choices)
        .where(eq(choices.questionId, currentQ.id))
        .all();

      const choiceList = qChoices
        .map((c) => ({
          choice_id: c.choiceId as ChoiceId,
          option_text: c.optionText,
        }))
        .sort((a, b) => a.choice_id.localeCompare(b.choice_id));

      currentQuestion = {
        index: session.currentQuestionIndex + 1,
        total: session.totalQuestions,
        questionId: currentQ.id,
        questionText: currentQ.questionText,
        choices: choiceList,
        timeLimitSeconds: session.timePerQuestionSeconds,
        startedAt: session.questionStartedAt || session.createdAt,
      };

      if (session.status === 'leaderboard') {
        // Compute distribution
        const qAnswers = database
          .select()
          .from(arenaAnswers)
          .where(
            and(
              eq(arenaAnswers.sessionId, session.id),
              eq(arenaAnswers.questionId, currentQ.id)
            )
          )
          .all();

        const dist: Record<ChoiceId, number> = { A: 0, B: 0, C: 0, D: 0 };
        for (const ans of qAnswers) {
          if (ans.selectedChoiceId in dist) {
            dist[ans.selectedChoiceId as ChoiceId]++;
          }
        }

        questionEnd = {
          questionId: currentQ.id,
          correctChoiceId: currentQ.correctChoiceId as ChoiceId,
          explanation: currentQ.explanation,
          distribution: dist,
          totalAnswers: qAnswers.length,
        };
      }
    }

    // Build leaderboard
    leaderboard = participants.map((p, idx) => ({
      participantId: p.id,
      nickname: p.nickname,
      score: p.score,
      rank: idx + 1,
      streak: p.streak,
    }));

    if (session.status === 'finished') {
      podium = leaderboard.slice(0, 3);
    }

    // Check which participants have answered current question
    let answeredSet = new Set<string>();
    if (currentQ) {
      const answersThisQ = database
        .select({ participantId: arenaAnswers.participantId })
        .from(arenaAnswers)
        .where(
          and(
            eq(arenaAnswers.sessionId, session.id),
            eq(arenaAnswers.questionId, currentQ.id)
          )
        )
        .all();
      answeredSet = new Set(answersThisQ.map((a) => a.participantId));
    }

    const participantDtos: ArenaParticipantDto[] = participants.map((p, idx) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      streak: p.streak,
      rank: idx + 1,
      hasAnswered: answeredSet.has(p.id),
    }));

    return {
      sessionId: session.id,
      quizId: session.quizId,
      quizTopic: quiz.topic,
      pin: session.pin,
      status: session.status as ArenaStatus,
      hostId: session.hostId,
      isHost,
      participants: participantDtos,
      currentQuestion,
      questionEnd,
      leaderboard: session.status === 'leaderboard' ? leaderboard.slice(0, 10) : undefined,
      podium: session.status === 'finished' ? podium : undefined,
    };
  }

  /**
   * Host starts the game from lobby
   */
  async startGame(hostId: string, pin: string, database = db) {
    const session = database
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin.trim()))
      .get();

    if (!session) {
      throw new ArenaError('Arena room not found.', 404, 'ROOM_NOT_FOUND');
    }

    if (session.hostId !== hostId) {
      throw new ArenaError('Only the game host can start the battle.', 403, 'FORBIDDEN');
    }

    if (session.status !== 'lobby') {
      throw new ArenaError('Game has already started.', 400, 'GAME_ALREADY_STARTED');
    }

    database
      .update(arenaSessions)
      .set({
        status: 'question',
        currentQuestionIndex: 0,
        questionStartedAt: new Date().toISOString(),
      })
      .where(eq(arenaSessions.id, session.id))
      .run();

    return await this.getArenaState(pin, hostId, database);
  }

  /**
   * Participant submits an answer for current question
   */
  async submitAnswer(
    pin: string,
    participantId: string,
    questionId: string,
    selectedChoiceId: ChoiceId,
    responseTimeMs: number,
    database = db
  ) {
    const session = database
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin.trim()))
      .get();

    if (!session || session.status !== 'question') {
      throw new ArenaError('Question is not currently active for answering.', 400, 'QUESTION_INACTIVE');
    }

    const participant = database
      .select()
      .from(arenaParticipants)
      .where(eq(arenaParticipants.id, participantId))
      .get();

    if (!participant || participant.sessionId !== session.id) {
      throw new ArenaError('Participant not found in this game.', 404, 'PARTICIPANT_NOT_FOUND');
    }

    // Check if already answered
    const existing = database
      .select()
      .from(arenaAnswers)
      .where(
        and(
          eq(arenaAnswers.sessionId, session.id),
          eq(arenaAnswers.participantId, participantId),
          eq(arenaAnswers.questionId, questionId)
        )
      )
      .get();

    if (existing) {
      throw new ArenaError('Answer already submitted for this question.', 400, 'ANSWER_ALREADY_SUBMITTED');
    }

    // Validate question
    const q = database.select().from(questions).where(eq(questions.id, questionId)).get();
    if (!q || q.quizId !== session.quizId) {
      throw new ArenaError('Invalid question for this quiz session.', 400, 'INVALID_QUESTION');
    }

    const isCorrect = selectedChoiceId === q.correctChoiceId;
    let pointsAwarded = 0;
    let newStreak = 0;

    if (isCorrect) {
      // 1000 base points
      const basePoints = 1000;
      // Speed bonus: up to 500 bonus points
      const totalAllowedMs = session.timePerQuestionSeconds * 1000;
      const speedRatio = Math.max(0, Math.min(1, 1 - responseTimeMs / totalAllowedMs));
      const speedBonus = Math.round(500 * speedRatio);
      // Streak bonus: +100 per consecutive streak, max 500
      newStreak = participant.streak + 1;
      const streakBonus = Math.min(500, (newStreak - 1) * 100);

      pointsAwarded = basePoints + speedBonus + streakBonus;
    } else {
      newStreak = 0;
    }

    const newScore = participant.score + pointsAwarded;

    database.transaction((tx) => {
      tx.insert(arenaAnswers)
        .values({
          id: crypto.randomUUID(),
          sessionId: session.id,
          participantId,
          questionId,
          selectedChoiceId,
          isCorrect,
          responseTimeMs,
          pointsAwarded,
          answeredAt: new Date().toISOString(),
        })
        .run();

      tx.update(arenaParticipants)
        .set({
          score: newScore,
          streak: newStreak,
        })
        .where(eq(arenaParticipants.id, participantId))
        .run();
    });

    // Check count of answers submitted for this question vs total participants
    const totalAnswers = database
      .select({ id: arenaAnswers.id })
      .from(arenaAnswers)
      .where(
        and(
          eq(arenaAnswers.sessionId, session.id),
          eq(arenaAnswers.questionId, questionId)
        )
      )
      .all().length;

    const totalPlayers = database
      .select({ id: arenaParticipants.id })
      .from(arenaParticipants)
      .where(eq(arenaParticipants.sessionId, session.id))
      .all().length;

    return {
      isCorrect,
      correctChoiceId: isCorrect ? selectedChoiceId : (q.correctChoiceId as ChoiceId),
      pointsAwarded,
      newScore,
      newStreak,
      totalAnswers,
      totalPlayers,
      allAnswered: totalPlayers > 0 && totalAnswers >= totalPlayers,
    };
  }

  /**
   * Host ends the question timer and reveals correct answer & leaderboard
   */
  async endQuestion(hostId: string, pin: string, database = db) {
    const session = database
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin.trim()))
      .get();

    if (!session) {
      throw new ArenaError('Arena room not found.', 404, 'ROOM_NOT_FOUND');
    }

    if (session.hostId !== hostId) {
      throw new ArenaError('Only the host can end question countdown.', 403, 'FORBIDDEN');
    }

    database
      .update(arenaSessions)
      .set({ status: 'leaderboard' })
      .where(eq(arenaSessions.id, session.id))
      .run();

    return await this.getArenaState(pin, hostId, database);
  }

  /**
   * Host advances to next question or finishes game
   */
  async nextQuestionOrFinish(hostId: string, pin: string, database = db) {
    const session = database
      .select()
      .from(arenaSessions)
      .where(eq(arenaSessions.pin, pin.trim()))
      .get();

    if (!session) {
      throw new ArenaError('Arena room not found.', 404, 'ROOM_NOT_FOUND');
    }

    if (session.hostId !== hostId) {
      throw new ArenaError('Only the host can advance the arena.', 403, 'FORBIDDEN');
    }

    const nextIdx = session.currentQuestionIndex + 1;
    if (nextIdx < session.totalQuestions) {
      database
        .update(arenaSessions)
        .set({
          status: 'question',
          currentQuestionIndex: nextIdx,
          questionStartedAt: new Date().toISOString(),
        })
        .where(eq(arenaSessions.id, session.id))
        .run();
    } else {
      database
        .update(arenaSessions)
        .set({
          status: 'finished',
          endedAt: new Date().toISOString(),
        })
        .where(eq(arenaSessions.id, session.id))
        .run();
    }

    return await this.getArenaState(pin, hostId, database);
  }
}

export const arenaService = new ArenaService();
