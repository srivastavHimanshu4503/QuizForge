import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveMigrationsFolder(customFolder?: string): string {
  if (customFolder && fs.existsSync(customFolder)) {
    return customFolder;
  }

  const candidatePaths = [
    customFolder,
    path.resolve(__dirname, 'migrations'),
    path.resolve(__dirname, '../../src/db/migrations'),
    path.resolve(process.cwd(), 'src/db/migrations'),
    path.resolve(process.cwd(), 'apps/backend/src/db/migrations'),
    path.resolve(process.cwd(), 'dist/db/migrations'),
    path.resolve(process.cwd(), 'apps/backend/dist/db/migrations'),
  ].filter(Boolean) as string[];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(__dirname, 'migrations');
}

export function runMigrations(database = db, migrationsFolder?: string) {
  const folder = resolveMigrationsFolder(migrationsFolder);
  console.log(`[Migrations] Applying migrations from: ${folder}`);
  migrate(database, { migrationsFolder: folder });
  console.log('[Migrations] All migrations successfully applied.');
}

// Allow direct execution only when explicitly invoked as a migration script
const isDirectExecution = () => {
  if (!process.argv[1]) return false;
  const executedFile = path.resolve(process.argv[1]);
  const base = path.basename(executedFile);
  return base.startsWith('migrate');
};

if (isDirectExecution()) {
  try {
    runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('[Migrations] Migration failed:', err);
    process.exit(1);
  }
}
