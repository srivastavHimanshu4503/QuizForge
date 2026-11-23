import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { buildApp } from '../app';
import { db } from '../db';
import { userPasskeys, webauthnChallenges } from '../db/schema/index';

describe('Milestone 19: Biometric WebAuthn (Passkeys) Passwordless Authentication & FIDO2 Credential Vault Engine', () => {
  let app: FastifyInstance;
  const runId = Date.now();
  const aliceEmail = `alice.passkey.${runId}@test.com`;
  const bobEmail = `bob.passkey.${runId}@test.com`;

  let aliceCookie: string;
  let bobCookie: string;
  let aliceUserId: string;

  const mockCredentialId = Buffer.from(`cred-mock-${runId}`).toString('base64url');
  const mockPublicKey = Buffer.from('mock-public-key-cose-bytes-32').toString('base64url');

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // 1. Register Alice
    const aliceRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: aliceEmail,
        password: 'Password123!',
        displayName: 'Alice Biometric',
      },
    });
    expect(aliceRes.statusCode).toBe(201);
    const aliceCookieHeader = aliceRes.headers['set-cookie'];
    aliceCookie = Array.isArray(aliceCookieHeader) ? aliceCookieHeader[0]! : (aliceCookieHeader as string);
    const aliceData = JSON.parse(aliceRes.payload);
    aliceUserId = aliceData.data.user.id;

    // 2. Register Bob
    const bobRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email: bobEmail,
        password: 'Password123!',
        displayName: 'Bob Biometric',
      },
    });
    expect(bobRes.statusCode).toBe(201);
    const bobCookieHeader = bobRes.headers['set-cookie'];
    bobCookie = Array.isArray(bobCookieHeader) ? bobCookieHeader[0]! : (bobCookieHeader as string);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated registration options request (401 Unauthorized)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
    });
    expect(res.statusCode).toBe(401);
  });

  it('generates valid WebAuthn registration options for authenticated user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      headers: { cookie: aliceCookie },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.challenge).toBeDefined();
    expect(body.data.rp.name).toBe('QuizForge Assessment Platform');
    expect(body.data.user.name).toBe(aliceEmail);
    expect(body.data.user.displayName).toBe('Alice Biometric');
    expect(body.data.authenticatorSelection.residentKey).toBe('required');
    expect(body.data.pubKeyCredParams.length).toBeGreaterThan(0);

    // Verify challenge persisted in DB
    const saved = db
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.challenge, body.data.challenge))
      .get();
    expect(saved).toBeDefined();
    expect(saved!.userId).toBe(aliceUserId);
    expect(saved!.type).toBe('registration');
  });

  it('generates public WebAuthn authentication options with discoverable credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-options',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.challenge).toBeDefined();
    expect(body.data.rpId).toBeDefined();
    expect(body.data.allowCredentials).toEqual([]); // Discoverable passkeys

    // Verify challenge persisted in DB
    const saved = db
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.challenge, body.data.challenge))
      .get();
    expect(saved).toBeDefined();
    expect(saved!.userId).toBeNull();
    expect(saved!.type).toBe('authentication');
  });

  it('returns clean HTTP 404 CREDENTIAL_NOT_FOUND when credential ID is unknown (Modern Web Guidance rule)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/login-verify',
      payload: {
        id: 'unknown-credential-id-12345',
        rawId: 'unknown-credential-id-12345',
        type: 'public-key',
        response: {
          clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: 'test' })).toString('base64url'),
          authenticatorData: Buffer.from('test-auth-data').toString('base64url'),
          signature: Buffer.from('test-signature').toString('base64url'),
        },
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error.code).toBe('CREDENTIAL_NOT_FOUND');
  });

  it('manages passkeys CRUD: inserts, lists, renames, and deletes passkey credentials', async () => {
    // 1. Insert Alice's credential directly into vault
    db.insert(userPasskeys)
      .values({
        id: mockCredentialId,
        userId: aliceUserId,
        name: 'MacBook Touch ID',
        publicKey: mockPublicKey,
        counter: 1,
        deviceType: 'multiDevice',
        backedUp: true,
        transports: JSON.stringify(['internal', 'hybrid']),
        createdAt: new Date().toISOString(),
      })
      .run();

    // 2. Alice lists her passkeys
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/auth/passkey/credentials',
      headers: { cookie: aliceCookie },
    });

    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.success).toBe(true);
    expect(listBody.data.credentials.length).toBe(1);
    expect(listBody.data.credentials[0].id).toBe(mockCredentialId);
    expect(listBody.data.credentials[0].name).toBe('MacBook Touch ID');
    expect(listBody.data.credentials[0].backedUp).toBe(true);
    expect(listBody.data.credentials[0].transports).toEqual(['internal', 'hybrid']);

    // 3. Bob cannot rename Alice's passkey (404 Not Found)
    const bobRenameRes = await app.inject({
      method: 'PUT',
      url: `/api/auth/passkey/credentials/${mockCredentialId}`,
      headers: { cookie: bobCookie },
      payload: {
        name: 'Hacked Name',
      },
    });
    expect(bobRenameRes.statusCode).toBe(404);

    // 4. Alice renames her passkey
    const aliceRenameRes = await app.inject({
      method: 'PUT',
      url: `/api/auth/passkey/credentials/${mockCredentialId}`,
      headers: { cookie: aliceCookie },
      payload: {
        name: 'Alice Work Laptop Passkey',
      },
    });
    expect(aliceRenameRes.statusCode).toBe(200);
    const renameBody = JSON.parse(aliceRenameRes.payload);
    expect(renameBody.data.name).toBe('Alice Work Laptop Passkey');

    // 5. ExcludeCredentials now includes Alice's passkey in registration options
    const newOptionsRes = await app.inject({
      method: 'POST',
      url: '/api/auth/passkey/register-options',
      headers: { cookie: aliceCookie },
    });
    expect(newOptionsRes.statusCode).toBe(200);
    const newOptionsBody = JSON.parse(newOptionsRes.payload);
    expect(newOptionsBody.data.excludeCredentials.some((c: any) => c.id === mockCredentialId)).toBe(true);

    // 6. Alice deletes her passkey
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/auth/passkey/credentials/${mockCredentialId}`,
      headers: { cookie: aliceCookie },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Verify it is gone
    const afterDeleteRes = await app.inject({
      method: 'GET',
      url: '/api/auth/passkey/credentials',
      headers: { cookie: aliceCookie },
    });
    const afterDeleteBody = JSON.parse(afterDeleteRes.payload);
    expect(afterDeleteBody.data.credentials.length).toBe(0);
  });
});
