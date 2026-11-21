import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';

describe('Health Check API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns 200 OK and healthy database status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(body.data.database.status).toBe('healthy');
    expect(body.data.database.driver).toBe('better-sqlite3');
    expect(body.data.database.wal).toBe(true);
    expect(typeof body.data.uptime).toBe('number');
  });
});
