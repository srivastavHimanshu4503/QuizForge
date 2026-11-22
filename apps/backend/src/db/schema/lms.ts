import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { quizzes } from './quizzes';

export const ltiPlatforms = sqliteTable('lti_platforms', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  issuer: text('issuer').notNull(), // e.g. https://canvas.instructure.com
  clientId: text('client_id').notNull(),
  authEndpoint: text('auth_endpoint').notNull(), // OIDC Auth URL
  tokenEndpoint: text('token_endpoint').notNull(), // OAuth2 Token URL
  keySetEndpoint: text('keyset_endpoint').notNull(), // JWKS URL
  deploymentId: text('deployment_id').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const ltiLineItems = sqliteTable('lti_line_items', {
  id: text('id').primaryKey(), // UUID
  platformId: text('platform_id')
    .notNull()
    .references(() => ltiPlatforms.id, { onDelete: 'cascade' }),
  quizId: text('quiz_id')
    .notNull()
    .references(() => quizzes.id, { onDelete: 'cascade' }),
  lineItemUrl: text('line_item_url').notNull(),
  resourceLinkId: text('resource_link_id').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
