import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const userPasskeys = sqliteTable(
  'user_passkeys',
  {
    id: text('id').primaryKey(), // Base64URL credential ID
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Passkey'),
    publicKey: text('public_key').notNull(), // Base64URL COSE or SPKI public key
    counter: integer('counter').notNull().default(0),
    deviceType: text('device_type', { enum: ['singleDevice', 'multiDevice'] })
      .notNull()
      .default('multiDevice'),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull().default(false),
    transports: text('transports'), // JSON array of transports
    aaguid: text('aaguid'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    lastUsedAt: text('last_used_at'),
  },
  (table) => [
    index('user_passkeys_user_id_idx').on(table.userId),
  ]
);

export const webauthnChallenges = sqliteTable(
  'webauthn_challenges',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    challenge: text('challenge').notNull().unique(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['registration', 'authentication'] }).notNull(),
    createdAt: integer('created_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
  },
  (table) => [
    uniqueIndex('webauthn_challenges_challenge_idx').on(table.challenge),
    index('webauthn_challenges_user_id_idx').on(table.userId),
  ]
);
