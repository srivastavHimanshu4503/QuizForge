import { eq } from 'drizzle-orm';
import { db } from './index';
import { users } from './schema/index';
import { hashPassword } from '../utils/password';

export const DEMO_CREDENTIALS = {
  teacher: {
    email: 'teacher@quizforge.dev',
    password: 'QuizForge2026!',
    displayName: 'Prof. Alan Turing',
    role: 'teacher' as const,
  },
  student: {
    email: 'student@quizforge.dev',
    password: 'QuizForge2026!',
    displayName: 'Ada Lovelace',
    role: 'student' as const,
  },
};

export async function seedDemoUsers(database = db) {
  try {
    for (const [key, demo] of Object.entries(DEMO_CREDENTIALS)) {
      const existing = database
        .select()
        .from(users)
        .where(eq(users.email, demo.email))
        .get();

      if (!existing) {
        const passwordHash = await hashPassword(demo.password);
        database.insert(users).values({
          email: demo.email,
          passwordHash,
          displayName: demo.displayName,
          role: demo.role,
        }).run();
        console.log(`[Seed] Provisioned default demo ${key} account: ${demo.email}`);
      }
    }
  } catch (err) {
    console.warn('[Seed] Warning: Could not provision demo accounts:', err);
  }
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDemoUsers().then(() => {
    console.log('Seed completed successfully!');
    process.exit(0);
  });
}
