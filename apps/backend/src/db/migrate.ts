import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(database = db, migrationsFolder?: string) {
  const folder = migrationsFolder || path.resolve(__dirname, 'migrations');
  console.log(`[Migrations] Applying migrations from: ${folder}`);
  migrate(database, { migrationsFolder: folder });
  console.log('[Migrations] All migrations successfully applied.');
}

// Allow direct execution
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runMigrations();
    process.exit(0);
  } catch (err) {
    console.error('[Migrations] Migration failed:', err);
    process.exit(1);
  }
}
