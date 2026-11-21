import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try loading .env from current dir or root
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
const localEnvPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().default('quizforge.db'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .default('quizforge-super-secret-dev-jwt-key-replace-in-production-min-32-chars'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: z.string().default('dev_gemini_key'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),
  NVIDIA_API_KEY: z.string().optional(),
  NVIDIA_MODEL: z.string().default('meta/llama-3.3-70b-instruct'),
  GITHUB_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = typeof env;
