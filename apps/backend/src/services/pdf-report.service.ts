import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, RGB } from 'pdf-lib';
import crypto from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import {
  certificates,
  quizAttempts,
  quizzes,
  questions,
  choices,
  attemptAnswers,
  users,
  quizAssignments,
} from '../db/schema/index';
import { CertificateVerificationDto, CertificateMetaDto } from '@quiz-forge/shared';

export class CertificateError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'CertificateError';
  }
}

function wrapText(text: string, maxChars: number): string[] {
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + (current ? ' ' : '') + word).length <= maxChars) {
      current += (current ? ' ' : '') + word;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  const x = (page.getWidth() - textWidth) / 2;
  page.drawText(text, { x, y, size, font, color });
}

export class PdfReportService {
  /**
   * Generates or retrieves an existing certificate for an attempt
   */
  async getOrCreateCertificate(
    attemptId: string,
    userId: string,
    database = db
  ) {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, attemptId))
      .get();

    if (!attempt) {
      throw new CertificateError('Quiz attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    // Permission check: either the student who took it, or teacher of the classroom assignment
    let isAuthorized = attempt.userId === userId;
    if (!isAuthorized && attempt.assignmentId) {
      const assignment = database
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.id, attempt.assignmentId))
        .get();
      if (assignment && assignment.teacherId === userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new CertificateError('Unauthorized to access this certificate.', 403, 'FORBIDDEN');
    }

    if (attempt.status !== 'completed') {
      throw new CertificateError(
        'Attempt is not completed. Certificates are only issued for finalized quizzes.',
        400,
        'ATTEMPT_NOT_COMPLETED'
      );
    }

    const percentage = attempt.accuracyPercentage ?? 0;
    if (percentage < 70) {
      throw new CertificateError(
        `Score of ${percentage}% does not meet the 70% threshold required for Certificate of Completion.`,
        400,
        'PASSING_GRADE_NOT_MET'
      );
    }

    // Check if certificate already exists
    const existing = database
      .select()
      .from(certificates)
      .where(eq(certificates.attemptId, attemptId))
      .get();

    if (existing) {
      return existing;
    }

    // Fetch quiz & student info
    const quiz = database.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).get();
    const student = database.select().from(users).where(eq(users.id, attempt.userId)).get();

    if (!quiz || !student) {
      throw new CertificateError('Required quiz or user record not found.', 404, 'RECORD_NOT_FOUND');
    }

    const year = new Date().getFullYear();
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    const verificationCode = `QF-${year}-${rand}`;
    const newId = crypto.randomUUID();

    database
      .insert(certificates)
      .values({
        id: newId,
        attemptId,
        quizId: quiz.id,
        userId: student.id,
        recipientName: student.displayName,
        quizTitle: quiz.topic,
        score: attempt.score ?? 0,
        totalQuestions: attempt.totalQuestions,
        percentage,
        verificationCode,
        issuedAt: new Date().toISOString(),
      })
      .run();

    return database.select().from(certificates).where(eq(certificates.id, newId)).get()!;
  }

  /**
   * Retrieves certificate metadata (eligibility, passing threshold)
   */
  async getCertificateMeta(
    attemptId: string,
    userId: string,
    database = db
  ): Promise<CertificateMetaDto> {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, attemptId))
      .get();

    if (!attempt) {
      throw new CertificateError('Quiz attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    let isAuthorized = attempt.userId === userId;
    if (!isAuthorized && attempt.assignmentId) {
      const assignment = database
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.id, attempt.assignmentId))
        .get();
      if (assignment && assignment.teacherId === userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new CertificateError('Unauthorized to inspect certificate metadata.', 403, 'FORBIDDEN');
    }

    const percentage = attempt.accuracyPercentage ?? 0;
    const isEligible = attempt.status === 'completed' && percentage >= 70;

    const cert = database
      .select()
      .from(certificates)
      .where(eq(certificates.attemptId, attemptId))
      .get();

    return {
      isEligible,
      minPassingPercentage: 70,
      percentage,
      hasCertificate: Boolean(cert),
      certificate: cert
        ? {
            id: cert.id,
            attemptId: cert.attemptId,
            quizId: cert.quizId,
            userId: cert.userId,
            recipientName: cert.recipientName,
            quizTitle: cert.quizTitle,
            score: cert.score,
            totalQuestions: cert.totalQuestions,
            percentage: cert.percentage,
            verificationCode: cert.verificationCode,
            issuedAt: cert.issuedAt,
          }
        : null,
    };
  }

  /**
   * Public verification of a certificate code
   */
  async verifyCertificate(
    verificationCode: string,
    database = db
  ): Promise<CertificateVerificationDto> {
    const cert = database
      .select()
      .from(certificates)
      .where(eq(certificates.verificationCode, verificationCode.trim()))
      .get();

    if (!cert) {
      throw new CertificateError('Invalid or unverified certificate code.', 404, 'CERTIFICATE_NOT_FOUND');
    }

    const percentage = cert.percentage;
    let grade = 'B (Pass)';
    if (percentage >= 90) grade = 'A+ (High Distinction)';
    else if (percentage >= 80) grade = 'A (Distinction)';

    return {
      isValid: true,
      verificationCode: cert.verificationCode,
      recipientName: cert.recipientName,
      quizTitle: cert.quizTitle,
      score: cert.score,
      totalQuestions: cert.totalQuestions,
      percentage: cert.percentage,
      grade,
      issuedAt: cert.issuedAt,
      isDistinction: percentage >= 90,
    };
  }

  /**
   * Renders a pristine Landscape PDF Certificate of Achievement
   */
  async generateCertificatePdf(
    attemptId: string,
    userId: string,
    database = db
  ): Promise<Uint8Array> {
    const cert = await this.getOrCreateCertificate(attemptId, userId, database);

    const doc = await PDFDocument.create();
    // Standard Landscape Letter: 792 pt wide by 612 pt high
    const page = doc.addPage([792, 612]);
    const { width, height } = page.getSize();

    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const timesRomanBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);

    // Color Palette
    const royalBlue = rgb(25 / 255, 53 / 255, 202 / 255); // #1935CA
    const gold = rgb(217 / 255, 119 / 255, 6 / 255);       // #D97706
    const lightGold = rgb(254 / 255, 243 / 255, 199 / 255);
    const slate800 = rgb(30 / 255, 41 / 255, 59 / 255);   // #1E293B
    const slate600 = rgb(71 / 255, 85 / 255, 105 / 255);
    const slate400 = rgb(148 / 255, 163 / 255, 184 / 255);

    // 1. Double Borders & Frame
    // Outer Royal Blue Border
    page.drawRectangle({
      x: 24,
      y: 24,
      width: width - 48,
      height: height - 48,
      borderColor: royalBlue,
      borderWidth: 4,
      color: rgb(0.99, 0.99, 1),
    });

    // Inner Gold Border
    page.drawRectangle({
      x: 32,
      y: 32,
      width: width - 64,
      height: height - 64,
      borderColor: gold,
      borderWidth: 1.5,
    });

    // Subtle Corner Accents
    const cornerSize = 16;
    const corners = [
      { x: 38, y: 38 },
      { x: width - 38 - cornerSize, y: 38 },
      { x: 38, y: height - 38 - cornerSize },
      { x: width - 38 - cornerSize, y: height - 38 - cornerSize },
    ];
    for (const c of corners) {
      page.drawRectangle({
        x: c.x,
        y: c.y,
        width: cornerSize,
        height: cornerSize,
        borderColor: gold,
        borderWidth: 1,
        color: lightGold,
      });
    }

    // 2. Header
    drawCenteredText(page, 'Q U I Z F O R G E   A C A D E M Y', 530, helveticaBold, 12, royalBlue);
    drawCenteredText(page, 'CERTIFICATE OF ACHIEVEMENT', 490, timesRomanBoldItalic, 32, slate800);

    // Gold decorative divider
    page.drawLine({
      start: { x: width / 2 - 120, y: 475 },
      end: { x: width / 2 + 120, y: 475 },
      thickness: 1.5,
      color: gold,
    });

    // 3. Body Text
    drawCenteredText(
      page,
      'THIS IS PROUDLY PRESENTED TO',
      445,
      helvetica,
      10,
      slate600
    );

    // Recipient Name
    drawCenteredText(
      page,
      cert.recipientName.toUpperCase(),
      405,
      helveticaBold,
      28,
      royalBlue
    );

    // Gold line under name
    const nameWidth = helveticaBold.widthOfTextAtSize(cert.recipientName.toUpperCase(), 28);
    page.drawLine({
      start: { x: (width - nameWidth) / 2 - 16, y: 395 },
      end: { x: (width + nameWidth) / 2 + 16, y: 395 },
      thickness: 1,
      color: slate400,
    });

    drawCenteredText(
      page,
      'for successfully mastering and demonstrating subject proficiency in',
      365,
      helvetica,
      11,
      slate600
    );

    // Quiz Title / Topic
    drawCenteredText(
      page,
      `"${cert.quizTitle}"`,
      335,
      timesRomanBoldItalic,
      20,
      slate800
    );

    // 4. Score & Honors Badge Card
    const boxWidth = 360;
    const boxHeight = 44;
    const boxX = (width - boxWidth) / 2;
    const boxY = 265;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      borderColor: gold,
      borderWidth: 1,
      color: lightGold,
    });

    const isDistinction = cert.percentage >= 90;
    const gradeLabel = isDistinction ? 'High Distinction' : 'Demonstrated Mastery';
    const metricsText = `Score: ${cert.score}/${cert.totalQuestions} (${cert.percentage}%)   •   Honors: ${gradeLabel}`;
    drawCenteredText(page, metricsText, boxY + 16, helveticaBold, 11, slate800);

    // 5. Verification & Authentication Footer
    // Left Box: Issue Date & Verification Hash
    const dateFormatted = new Date(cert.issuedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    page.drawText('ISSUED DATE', { x: 70, y: 135, size: 8, font: helveticaBold, color: slate400 });
    page.drawText(dateFormatted, { x: 70, y: 120, size: 10, font: helvetica, color: slate800 });

    page.drawText('VERIFICATION CODE', { x: 70, y: 95, size: 8, font: helveticaBold, color: slate400 });
    page.drawText(cert.verificationCode, { x: 70, y: 80, size: 11, font: helveticaBold, color: royalBlue });

    // Center/Right: Digital Seal
    const sealX = width - 180;
    const sealY = 115;
    page.drawCircle({
      x: sealX,
      y: sealY,
      size: 42,
      borderColor: gold,
      borderWidth: 2,
      color: lightGold,
    });
    page.drawCircle({
      x: sealX,
      y: sealY,
      size: 38,
      borderColor: royalBlue,
      borderWidth: 1,
    });

    const sealText1 = 'VERIFIED';
    const sealText2 = 'QUIZFORGE';
    const sealText3 = 'OFFICIAL';
    const st1W = helveticaBold.widthOfTextAtSize(sealText1, 8);
    const st2W = helveticaBold.widthOfTextAtSize(sealText2, 9);
    const st3W = helveticaBold.widthOfTextAtSize(sealText3, 7);

    page.drawText(sealText1, { x: sealX - st1W / 2, y: sealY + 14, size: 8, font: helveticaBold, color: royalBlue });
    page.drawText(sealText2, { x: sealX - st2W / 2, y: sealY, size: 9, font: helveticaBold, color: gold });
    page.drawText(sealText3, { x: sealX - st3W / 2, y: sealY - 14, size: 7, font: helveticaBold, color: royalBlue });

    // Right Signature / Attestation Line
    const sigX = width - 380;
    page.drawLine({
      start: { x: sigX, y: 110 },
      end: { x: sigX + 140, y: 110 },
      thickness: 1,
      color: slate400,
    });
    page.drawText('Antigravity AI Academic Board', { x: sigX, y: 95, size: 9, font: helveticaBold, color: slate800 });
    page.drawText('Authenticated Examination Authority', { x: sigX, y: 82, size: 8, font: helvetica, color: slate600 });

    // Bottom tamper-evident note
    drawCenteredText(
      page,
      `Official tamper-evident credential. To verify this certificate, visit https://quizforge.app/verify/${cert.verificationCode}`,
      46,
      helvetica,
      8,
      slate400
    );

    return await doc.save();
  }

  /**
   * Generates a multi-page PDF Student Performance Report Card
   */
  async generatePerformanceReportCardPdf(
    attemptId: string,
    userId: string,
    database = db
  ): Promise<Uint8Array> {
    const attempt = database
      .select()
      .from(quizAttempts)
      .where(eq(quizAttempts.id, attemptId))
      .get();

    if (!attempt) {
      throw new CertificateError('Quiz attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    let isAuthorized = attempt.userId === userId;
    if (!isAuthorized && attempt.assignmentId) {
      const assignment = database
        .select()
        .from(quizAssignments)
        .where(eq(quizAssignments.id, attempt.assignmentId))
        .get();
      if (assignment && assignment.teacherId === userId) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new CertificateError('Unauthorized to access this performance report.', 403, 'FORBIDDEN');
    }

    const quiz = database.select().from(quizzes).where(eq(quizzes.id, attempt.quizId)).get();
    const student = database.select().from(users).where(eq(users.id, attempt.userId)).get();

    if (!quiz || !student) {
      throw new CertificateError('Required quiz or user record not found.', 404, 'RECORD_NOT_FOUND');
    }

    // Fetch questions & choices
    const quizQuestions = database
      .select()
      .from(questions)
      .where(eq(questions.quizId, quiz.id))
      .all();

    const questionIds = quizQuestions.map((q) => q.id);
    const quizChoices = database
      .select()
      .from(choices)
      .where(inArray(choices.questionId, questionIds))
      .all();

    const choicesByQuestion = new Map<string, Array<{ choiceId: string; optionText: string }>>();
    for (const c of quizChoices) {
      const list = choicesByQuestion.get(c.questionId) || [];
      list.push({ choiceId: c.choiceId, optionText: c.optionText });
      choicesByQuestion.set(c.questionId, list);
    }

    const studentAnswers = database
      .select()
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, attempt.id))
      .all();

    const answerMap = new Map(studentAnswers.map((a) => [a.questionId, a]));
    const questionMap = new Map(quizQuestions.map((q) => [q.id, q]));

    // PDF Document Initialization
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const courier = await doc.embedFont(StandardFonts.Courier);

    // Color definitions
    const royalBlue = rgb(25 / 255, 53 / 255, 202 / 255);
    const green = rgb(22 / 255, 101 / 255, 52 / 255);
    const greenBg = rgb(240 / 255, 253 / 255, 244 / 255);
    const red = rgb(153 / 255, 27 / 255, 27 / 255);
    const redBg = rgb(254 / 255, 242 / 255, 242 / 255);
    const amber = rgb(180 / 255, 83 / 255, 9 / 255);
    const amberBg = rgb(254 / 255, 243 / 255, 199 / 255);
    const slate800 = rgb(30 / 255, 41 / 255, 59 / 255);
    const slate600 = rgb(71 / 255, 85 / 255, 105 / 255);
    const slate400 = rgb(148 / 255, 163 / 255, 184 / 255);
    const slate100 = rgb(241 / 255, 245 / 255, 249 / 255);

    // Duration calculation
    let durationFormatted = 'N/A';
    if (attempt.startedAt && attempt.completedAt) {
      const diffSec = Math.max(
        0,
        Math.round((new Date(attempt.completedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
      );
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      durationFormatted = `${mins}m ${secs}s`;
    }

    // Helper to start a new page
    let currentPage = doc.addPage([612, 792]);
    let currentY = 740;

    const renderHeader = (page: PDFPage, isFirst: boolean) => {
      // Header brand line
      page.drawRectangle({
        x: 36,
        y: 756,
        width: 540,
        height: 4,
        color: royalBlue,
      });

      page.drawText('QUIZFORGE ACADEMIC EXAMINATION AUTHORITY', {
        x: 36,
        y: 766,
        size: 9,
        font: helveticaBold,
        color: royalBlue,
      });

      if (!isFirst) {
        page.drawText(`Report Card: ${quiz.topic}  |  Candidate: ${student.displayName}`, {
          x: 36,
          y: 742,
          size: 8,
          font: helvetica,
          color: slate600,
        });
      }
    };

    renderHeader(currentPage, true);
    currentY = 720;

    // Report Title
    currentPage.drawText('STUDENT PERFORMANCE REPORT CARD', {
      x: 36,
      y: currentY,
      size: 18,
      font: helveticaBold,
      color: slate800,
    });
    currentY -= 20;

    currentPage.drawText(`Comprehensive Diagnostic Assessment & Question Review`, {
      x: 36,
      y: currentY,
      size: 10,
      font: helvetica,
      color: slate600,
    });
    currentY -= 25;

    // Overview Meta Box (Candidate & Quiz info)
    currentPage.drawRectangle({
      x: 36,
      y: currentY - 95,
      width: 540,
      height: 95,
      borderColor: slate400,
      borderWidth: 0.5,
      color: slate100,
    });

    // Column 1: Candidate
    currentPage.drawText('CANDIDATE INFORMATION', { x: 50, y: currentY - 18, size: 8, font: helveticaBold, color: royalBlue });
    currentPage.drawText(`Name: ${student.displayName}`, { x: 50, y: currentY - 34, size: 9, font: helveticaBold, color: slate800 });
    currentPage.drawText(`Email: ${student.email}`, { x: 50, y: currentY - 48, size: 8, font: helvetica, color: slate600 });
    currentPage.drawText(`Candidate ID: ${student.id.slice(0, 8)}...`, { x: 50, y: currentY - 62, size: 8, font: courier, color: slate600 });
    currentPage.drawText(`Attempt #: ${attempt.attemptNumber}`, { x: 50, y: currentY - 76, size: 8, font: helvetica, color: slate600 });

    // Column 2: Assessment Details
    const col2X = 320;
    currentPage.drawText('EXAMINATION PARAMETERS', { x: col2X, y: currentY - 18, size: 8, font: helveticaBold, color: royalBlue });
    currentPage.drawText(`Topic: ${quiz.topic.slice(0, 32)}`, { x: col2X, y: currentY - 34, size: 9, font: helveticaBold, color: slate800 });
    currentPage.drawText(`Difficulty: ${quiz.difficulty.toUpperCase()}`, { x: col2X, y: currentY - 48, size: 8, font: helvetica, color: slate600 });
    currentPage.drawText(`Duration Spent: ${durationFormatted} (${attempt.timeLimitMinutes ? `${attempt.timeLimitMinutes}m limit` : 'untimed'})`, { x: col2X, y: currentY - 62, size: 8, font: helvetica, color: slate600 });

    const integrityText = (attempt.tabSwitchCount ?? 0) === 0
      ? 'Focus Integrity: Clean (0 Tab Switches)'
      : `Focus Integrity: Flagged (${attempt.tabSwitchCount} Tab Switches)`;
    currentPage.drawText(integrityText, {
      x: col2X,
      y: currentY - 76,
      size: 8,
      font: helveticaBold,
      color: (attempt.tabSwitchCount ?? 0) === 0 ? green : red,
    });

    currentY -= 115;

    // Performance Summary Metric Cards (4 cards)
    const cardWidth = 125;
    const cardHeight = 55;
    const cards = [
      {
        title: 'FINAL SCORE',
        value: `${attempt.score ?? 0} / ${attempt.totalQuestions}`,
        color: royalBlue,
      },
      {
        title: 'ACCURACY',
        value: `${attempt.accuracyPercentage ?? 0}%`,
        color: (attempt.accuracyPercentage ?? 0) >= 70 ? green : red,
      },
      {
        title: 'STATUS',
        value: attempt.isTimedOut ? 'TIMED OUT' : 'COMPLETED',
        color: attempt.isTimedOut ? amber : green,
      },
      {
        title: 'OUTCOME',
        value: (attempt.accuracyPercentage ?? 0) >= 70 ? 'PASSED' : 'NEEDS PRACTICE',
        color: (attempt.accuracyPercentage ?? 0) >= 70 ? green : slate800,
      },
    ];

    cards.forEach((c, idx) => {
      const cx = 36 + idx * (cardWidth + 13);
      currentPage.drawRectangle({
        x: cx,
        y: currentY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        borderColor: slate400,
        borderWidth: 0.5,
        color: rgb(0.98, 0.98, 1),
      });

      currentPage.drawText(c.title, { x: cx + 10, y: currentY - 18, size: 7, font: helveticaBold, color: slate600 });
      currentPage.drawText(c.value, { x: cx + 10, y: currentY - 42, size: 13, font: helveticaBold, color: c.color });
    });

    currentY -= 75;

    // Section Header: Detailed Itemized Review
    currentPage.drawText('ITEMIZED QUESTION BREAKDOWN & ANALYSIS', {
      x: 36,
      y: currentY,
      size: 11,
      font: helveticaBold,
      color: royalBlue,
    });
    currentY -= 15;

    // Render questions
    const orderedQuestionIds: string[] = (attempt.shuffledOrder && attempt.shuffledOrder.length > 0)
      ? attempt.shuffledOrder
      : questionIds;

    for (let i = 0; i < orderedQuestionIds.length; i++) {
      const qId = orderedQuestionIds[i];
      if (!qId) continue;
      const q = questionMap.get(qId);
      if (!q) continue;

      const ans = answerMap.get(qId);
      const isCorrect = Boolean(ans?.isCorrect);
      const selected = ans?.selectedChoiceId ?? null;
      const qChoices = choicesByQuestion.get(qId) || [];

      // Check remaining page vertical space; if low, create new page
      if (currentY < 180) {
        currentPage = doc.addPage([612, 792]);
        renderHeader(currentPage, false);
        currentY = 715;
      }

      // Question Container Box
      const isUnanswered = selected === null;
      const statusColor = isUnanswered ? amber : isCorrect ? green : red;
      const statusBg = isUnanswered ? amberBg : isCorrect ? greenBg : redBg;
      const statusLabel = isUnanswered ? 'SKIPPED / UNANSWERED' : isCorrect ? 'CORRECT (+1)' : 'INCORRECT (0)';

      currentPage.drawRectangle({
        x: 36,
        y: currentY - 24,
        width: 540,
        height: 24,
        color: statusBg,
        borderColor: statusColor,
        borderWidth: 0.5,
      });

      currentPage.drawText(`Question ${i + 1} of ${orderedQuestionIds.length}`, {
        x: 46,
        y: currentY - 16,
        size: 9,
        font: helveticaBold,
        color: slate800,
      });

      currentPage.drawText(statusLabel, {
        x: 450,
        y: currentY - 16,
        size: 8,
        font: helveticaBold,
        color: statusColor,
      });
      currentY -= 36;

      // Question Text (wrapped)
      const qLines = wrapText(q.questionText, 85);
      for (const line of qLines) {
        currentPage.drawText(line, {
          x: 46,
          y: currentY,
          size: 9,
          font: helveticaBold,
          color: slate800,
        });
        currentY -= 13;
      }
      currentY -= 4;

      // Options
      for (const choice of qChoices) {
        const isSelectedChoice = choice.choiceId === selected;
        const isCorrectChoice = choice.choiceId === q.correctChoiceId;

        let marker = `[ ${choice.choiceId} ]`;
        let optColor = slate600;
        let optFont = helvetica;

        if (isSelectedChoice && isCorrectChoice) {
          marker = `[ ${choice.choiceId} ]  (Your Correct Answer)`;
          optColor = green;
          optFont = helveticaBold;
        } else if (isSelectedChoice && !isCorrectChoice) {
          marker = `[ ${choice.choiceId} ]  (Your Answer - Incorrect)`;
          optColor = red;
          optFont = helveticaBold;
        } else if (isCorrectChoice) {
          marker = `[ ${choice.choiceId} ]  (Correct Answer)`;
          optColor = green;
          optFont = helveticaBold;
        }

        const choiceLines = wrapText(`${marker}  ${choice.optionText}`, 85);
        for (const cl of choiceLines) {
          currentPage.drawText(cl, {
            x: 56,
            y: currentY,
            size: 8,
            font: optFont,
            color: optColor,
          });
          currentY -= 12;
        }
      }

      // AI Explanation Box
      if (q.explanation) {
        currentY -= 4;
        const expLines = wrapText(`Explanation: ${q.explanation}`, 80);
        const expHeight = expLines.length * 12 + 10;

        if (currentY - expHeight < 50) {
          currentPage = doc.addPage([612, 792]);
          renderHeader(currentPage, false);
          currentY = 715;
        }

        currentPage.drawRectangle({
          x: 46,
          y: currentY - expHeight,
          width: 520,
          height: expHeight,
          color: rgb(0.96, 0.97, 1),
        });

        let expY = currentY - 14;
        for (const el of expLines) {
          currentPage.drawText(el, {
            x: 54,
            y: expY,
            size: 8,
            font: helvetica,
            color: slate800,
          });
          expY -= 12;
        }
        currentY -= (expHeight + 14);
      } else {
        currentY -= 14;
      }
    }

    // Number all pages at the bottom
    const pageCount = doc.getPageCount();
    for (let pIdx = 0; pIdx < pageCount; pIdx++) {
      const p = doc.getPage(pIdx);
      p.drawText(`QuizForge Automated Examination Engine  |  Page ${pIdx + 1} of ${pageCount}`, {
        x: 36,
        y: 25,
        size: 8,
        font: helvetica,
        color: slate400,
      });

      p.drawText(`Attempt ID: ${attempt.id.slice(0, 16)}...`, {
        x: 420,
        y: 25,
        size: 8,
        font: courier,
        color: slate400,
      });
    }

    return await doc.save();
  }
}

export const pdfReportService = new PdfReportService();
