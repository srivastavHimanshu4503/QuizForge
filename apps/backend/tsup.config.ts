import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  sourcemap: true,
  bundle: true,
  external: [
    'better-sqlite3',
    'fastify',
    '@fastify/cookie',
    '@fastify/cors',
    '@fastify/helmet',
    '@fastify/multipart',
    '@fastify/rate-limit',
    'pdf-parse',
  ],
  onSuccess: 'node -e "import(\'node:fs\').then(f => f.cpSync(\'src/db/migrations\', \'dist/db/migrations\', { recursive: true }))"',
});
