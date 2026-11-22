import { z } from 'zod';

export interface CertificateDto {
  id: string;
  attemptId: string;
  quizId: string;
  userId: string;
  recipientName: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  verificationCode: string;
  issuedAt: string;
}

export interface CertificateVerificationDto {
  isValid: boolean;
  verificationCode: string;
  recipientName: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  grade: string;
  issuedAt: string;
  isDistinction: boolean;
}

export interface CertificateMetaDto {
  isEligible: boolean;
  minPassingPercentage: number;
  percentage: number;
  hasCertificate: boolean;
  certificate?: CertificateDto | null;
}

export const verifyCertificateQuerySchema = z.object({
  code: z.string().trim().min(3).max(64),
});
