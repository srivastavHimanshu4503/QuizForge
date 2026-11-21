import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { AUTH_COOKIE_NAME } from '../plugins/auth.plugin';

describe('Authentication & Authorization Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const testUser = {
    email: `tester_${Date.now()}@quizforge.com`,
    password: 'SecurePassword123!',
    displayName: 'Test Runner',
  };

  let authCookie = '';

  it('registers a new user successfully and sets HTTP-only auth cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: testUser,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(body.data.user.displayName).toBe(testUser.displayName);
    expect(body.data.user.id).toBeDefined();
    // Security check: ensure password or hash is never returned
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(body.data.user.password).toBeUndefined();

    // Verify cookie was set
    const cookies = res.cookies;
    const cookie = cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
    expect(cookie?.value).toBeDefined();

    authCookie = `${cookie?.name}=${cookie?.value}`;
  });

  it('rejects registration with a duplicate email with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: testUser.email,
        password: 'AnotherPassword456!',
        displayName: 'Impostor',
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects registration with invalid inputs with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: 'invalid-email',
        password: 'short', // less than 8 chars
        displayName: 'A', // less than 2 chars
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('generates arithmetic CAPTCHA challenge via GET /api/auth/captcha', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/captcha',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.captchaId).toBeDefined();
    expect(body.data.question).toMatch(/^What is \d+ [\+\-\*] \d+\?$/);
  });

  it('rejects login with incorrect CAPTCHA answer with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
        captchaId: 'dummy-captcha-id',
        captchaAnswer: 'wrong-answer',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_CAPTCHA');
  });

  it('authenticates user with valid credentials via POST /login', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testUser.email.toLowerCase());

    const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie?.value.length).toBeGreaterThan(20);
  });

  it('rejects login with incorrect password with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: testUser.email,
        password: 'WrongPassword999!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login with non-existent email with 401 Unauthorized', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: 'ghost@nonexistent.domain',
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('allows access to GET /api/auth/me with valid auth cookie', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        cookie: authCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe(testUser.email.toLowerCase());
    expect(body.data.user.displayName).toBe(testUser.displayName);
  });

  it('rejects access to GET /api/auth/me when unauthenticated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('logs out user via POST /logout and clears auth cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: authCookie,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);

    const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME);
    expect(cookie?.value).toBe('');
  });
});
