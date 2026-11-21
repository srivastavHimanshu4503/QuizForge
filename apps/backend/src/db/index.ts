import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema/index';
import { env } from '../config/env';

export function createDatabase(dbPath: string = env.DATABASE_URL) {
  // Ensure parent directory exists for persistent container storage
  const dir = path.dirname(dbPath);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);

  // Enforce WAL mode for concurrency and foreign keys for relational integrity
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  return { sqlite, db };
}

// Default singleton instance for application runtime
export const { sqlite, db } = createDatabase();
