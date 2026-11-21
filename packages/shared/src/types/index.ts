export * from '../schemas/auth.schema.js';
export * from '../schemas/quiz.schema.js';
export * from '../schemas/attempt.schema.js';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
