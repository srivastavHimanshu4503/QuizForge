import { relations } from 'drizzle-orm';
import { users } from './users';
import { quizzes } from './quizzes';
import { questions } from './questions';
import { choices } from './choices';
import { quizAttempts } from './attempts';
import { attemptAnswers } from './answers';
import { codeQuizzes } from './code-quizzes';
import { codeQuestions } from './code-questions';
import { codeAttempts } from './code-attempts';
import { codeAnswers } from './code-answers';
import { classrooms } from './classrooms';
import { classroomMembers } from './classroom-members';
import { quizAssignments } from './quiz-assignments';

export const usersRelations = relations(users, ({ many }) => ({
  quizzes: many(quizzes),
  attempts: many(quizAttempts),
  codeQuizzes: many(codeQuizzes),
  codeAttempts: many(codeAttempts),
  taughtClassrooms: many(classrooms),
  enrollments: many(classroomMembers),
}));

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classrooms.teacherId],
    references: [users.id],
  }),
  members: many(classroomMembers),
  assignments: many(quizAssignments),
}));

export const classroomMembersRelations = relations(classroomMembers, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [classroomMembers.classroomId],
    references: [classrooms.id],
  }),
  student: one(users, {
    fields: [classroomMembers.studentId],
    references: [users.id],
  }),
}));

export const quizAssignmentsRelations = relations(quizAssignments, ({ one }) => ({
  classroom: one(classrooms, {
    fields: [quizAssignments.classroomId],
    references: [classrooms.id],
  }),
  teacher: one(users, {
    fields: [quizAssignments.teacherId],
    references: [users.id],
  }),
}));

export const codeQuizzesRelations = relations(codeQuizzes, ({ one, many }) => ({
  user: one(users, {
    fields: [codeQuizzes.userId],
    references: [users.id],
  }),
  questions: many(codeQuestions),
  attempts: many(codeAttempts),
}));

export const codeQuestionsRelations = relations(codeQuestions, ({ one, many }) => ({
  codeQuiz: one(codeQuizzes, {
    fields: [codeQuestions.codeQuizId],
    references: [codeQuizzes.id],
  }),
  answers: many(codeAnswers),
}));

export const codeAttemptsRelations = relations(codeAttempts, ({ one, many }) => ({
  codeQuiz: one(codeQuizzes, {
    fields: [codeAttempts.codeQuizId],
    references: [codeQuizzes.id],
  }),
  user: one(users, {
    fields: [codeAttempts.userId],
    references: [users.id],
  }),
  answers: many(codeAnswers),
}));

export const codeAnswersRelations = relations(codeAnswers, ({ one }) => ({
  codeAttempt: one(codeAttempts, {
    fields: [codeAnswers.codeAttemptId],
    references: [codeAttempts.id],
  }),
  codeQuestion: one(codeQuestions, {
    fields: [codeAnswers.codeQuestionId],
    references: [codeQuestions.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  user: one(users, {
    fields: [quizzes.userId],
    references: [users.id],
  }),
  questions: many(questions),
  attempts: many(quizAttempts),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
  choices: many(choices),
  answers: many(attemptAnswers),
}));

export const choicesRelations = relations(choices, ({ one }) => ({
  question: one(questions, {
    fields: [choices.questionId],
    references: [questions.id],
  }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  answers: many(attemptAnswers),
}));

export const attemptAnswersRelations = relations(attemptAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [attemptAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [attemptAnswers.questionId],
    references: [questions.id],
  }),
}));
