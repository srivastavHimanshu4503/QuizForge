import { z } from 'zod';

export const userRoleEnum = z.enum(['student', 'teacher', 'admin']);
export type UserRole = z.infer<typeof userRoleEnum>;

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address')
    .max(255, 'Email cannot exceed 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password cannot exceed 100 characters'),
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name cannot exceed 100 characters'),
  role: userRoleEnum.default('student'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  captchaId: z.string().optional(),
  captchaAnswer: z.string().optional(),
});

export const captchaChallengeSchema = z.object({
  captchaId: z.string(),
  question: z.string(),
});

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  role: userRoleEnum.default('student'),
  createdAt: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type CaptchaChallenge = z.infer<typeof captchaChallengeSchema>;
