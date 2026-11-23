import { eq, and, desc, lt } from 'drizzle-orm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { db } from '../db/index';
import { users, userPasskeys, webauthnChallenges } from '../db/schema/index';
import { env } from '../config/env';
import {
  PasskeyDto,
  PasskeyRegistrationOptions,
  PasskeyRegistrationVerifyInput,
  PasskeyAuthenticationOptions,
  PasskeyAuthenticationVerifyInput,
} from '@quiz-forge/shared';
import { signToken } from '../utils/token';

export class PasskeyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'PasskeyError';
  }
}

export class PasskeyService {
  private getExpectedOrigins(): string[] {
    const list = [
      env.WEBAUTHN_ORIGIN,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ];
    // Remove duplicates
    return Array.from(new Set(list));
  }

  async generateRegistrationOptions(
    userId: string,
    database = db
  ): Promise<PasskeyRegistrationOptions> {
    const user = database
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      throw new PasskeyError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Existing credentials to exclude
    const existingPasskeys = database
      .select({
        id: userPasskeys.id,
        transports: userPasskeys.transports,
      })
      .from(userPasskeys)
      .where(eq(userPasskeys.userId, userId))
      .all();

    const options = await generateRegistrationOptions({
      rpName: 'QuizForge Assessment Platform',
      rpID: env.WEBAUTHN_RP_ID,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      userDisplayName: user.displayName,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((p) => ({
        id: p.id,
        transports: p.transports ? JSON.parse(p.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    const now = Date.now();
    // Clean up expired challenges
    database.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now)).run();

    // Store new challenge
    database.insert(webauthnChallenges).values({
      id: crypto.randomUUID(),
      challenge: options.challenge,
      userId: user.id,
      type: 'registration',
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
    }).run();

    return options as unknown as PasskeyRegistrationOptions;
  }

  async verifyRegistration(
    userId: string,
    input: PasskeyRegistrationVerifyInput,
    database = db
  ): Promise<PasskeyDto> {
    const now = Date.now();
    const challengeRecord = database
      .select()
      .from(webauthnChallenges)
      .where(
        and(
          eq(webauthnChallenges.userId, userId),
          eq(webauthnChallenges.type, 'registration')
        )
      )
      .orderBy(desc(webauthnChallenges.createdAt))
      .get();

    if (!challengeRecord || challengeRecord.expiresAt < now) {
      throw new PasskeyError(
        'Registration challenge has expired or is invalid. Please try again.',
        400,
        'CHALLENGE_EXPIRED'
      );
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: input as any,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: this.getExpectedOrigins(),
        expectedRPID: env.WEBAUTHN_RP_ID,
        requireUserVerification: false,
      });
    } catch (err: unknown) {
      throw new PasskeyError(
        err instanceof Error ? err.message : 'Cryptographic verification failed',
        400,
        'VERIFICATION_FAILED'
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw new PasskeyError('Passkey attestation could not be verified', 400, 'VERIFICATION_FAILED');
    }

    // Consume challenge
    database.delete(webauthnChallenges).where(eq(webauthnChallenges.id, challengeRecord.id)).run();

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;

    const nickname = input.nickname?.trim() || 'Biometric Passkey';
    const createdAt = new Date().toISOString();
    const transports = input.response.transports || [];

    // Store in user_passkeys
    database.insert(userPasskeys).values({
      id: credential.id,
      userId,
      name: nickname,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: JSON.stringify(transports),
      aaguid: aaguid || null,
      createdAt,
    }).run();

    return {
      id: credential.id,
      userId,
      name: nickname,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      aaguid: aaguid || undefined,
      transports,
      registeredAt: createdAt,
    };
  }

  async generateAuthenticationOptions(database = db): Promise<PasskeyAuthenticationOptions> {
    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      allowCredentials: [], // Discoverable credentials (autofill & userless)
      userVerification: 'preferred',
    });

    const now = Date.now();
    // Clean up expired challenges
    database.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now)).run();

    database.insert(webauthnChallenges).values({
      id: crypto.randomUUID(),
      challenge: options.challenge,
      userId: null,
      type: 'authentication',
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
    }).run();

    return options as unknown as PasskeyAuthenticationOptions;
  }

  async verifyAuthentication(
    input: PasskeyAuthenticationVerifyInput,
    database = db
  ): Promise<{ user: { id: string; email: string; displayName: string; role: 'student' | 'teacher' | 'admin' }; token: string }> {
    const passkey = database
      .select()
      .from(userPasskeys)
      .where(eq(userPasskeys.id, input.id))
      .get();

    if (!passkey) {
      // Per Modern Web Guidance rule: must return HTTP 404 when credential ID is unknown so client calls Signal API
      throw new PasskeyError('Passkey credential not recognized on this server', 404, 'CREDENTIAL_NOT_FOUND');
    }

    const now = Date.now();
    const challengeRecord = database
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.type, 'authentication'))
      .orderBy(desc(webauthnChallenges.createdAt))
      .get();

    if (!challengeRecord || challengeRecord.expiresAt < now) {
      throw new PasskeyError(
        'Authentication challenge has expired or is invalid. Please try again.',
        400,
        'CHALLENGE_EXPIRED'
      );
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: input as any,
        expectedChallenge: challengeRecord.challenge,
        expectedOrigin: this.getExpectedOrigins(),
        expectedRPID: env.WEBAUTHN_RP_ID,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, 'base64url')),
          counter: passkey.counter,
          transports: passkey.transports ? JSON.parse(passkey.transports) : undefined,
        },
        requireUserVerification: false,
      });
    } catch (err: unknown) {
      throw new PasskeyError(
        err instanceof Error ? err.message : 'Cryptographic assertion verification failed',
        400,
        'VERIFICATION_FAILED'
      );
    }

    if (!verification.verified) {
      throw new PasskeyError('Passkey authentication could not be verified', 400, 'VERIFICATION_FAILED');
    }

    // Consume challenge
    database.delete(webauthnChallenges).where(eq(webauthnChallenges.id, challengeRecord.id)).run();

    // Update counter and lastUsedAt
    const lastUsedAt = new Date().toISOString();
    database
      .update(userPasskeys)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt,
      })
      .where(eq(userPasskeys.id, passkey.id))
      .run();

    const user = database
      .select()
      .from(users)
      .where(eq(users.id, passkey.userId))
      .get();

    if (!user) {
      throw new PasskeyError('User account associated with this passkey was not found', 404, 'USER_NOT_FOUND');
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role as 'student' | 'teacher' | 'admin',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role as 'student' | 'teacher' | 'admin',
      },
      token,
    };
  }

  async listUserPasskeys(userId: string, database = db): Promise<PasskeyDto[]> {
    const list = database
      .select()
      .from(userPasskeys)
      .where(eq(userPasskeys.userId, userId))
      .orderBy(desc(userPasskeys.createdAt))
      .all();

    return list.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.name,
      deviceType: p.deviceType as 'singleDevice' | 'multiDevice',
      backedUp: Boolean(p.backedUp),
      aaguid: p.aaguid || undefined,
      transports: p.transports ? JSON.parse(p.transports) : [],
      registeredAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    }));
  }

  async renamePasskey(
    userId: string,
    credentialId: string,
    name: string,
    database = db
  ): Promise<PasskeyDto> {
    const passkey = database
      .select()
      .from(userPasskeys)
      .where(and(eq(userPasskeys.id, credentialId), eq(userPasskeys.userId, userId)))
      .get();

    if (!passkey) {
      throw new PasskeyError('Passkey not found', 404, 'NOT_FOUND');
    }

    database
      .update(userPasskeys)
      .set({ name: name.trim() })
      .where(eq(userPasskeys.id, credentialId))
      .run();

    return {
      id: passkey.id,
      userId: passkey.userId,
      name: name.trim(),
      deviceType: passkey.deviceType as 'singleDevice' | 'multiDevice',
      backedUp: Boolean(passkey.backedUp),
      aaguid: passkey.aaguid || undefined,
      transports: passkey.transports ? JSON.parse(passkey.transports) : [],
      registeredAt: passkey.createdAt,
      lastUsedAt: passkey.lastUsedAt,
    };
  }

  async deletePasskey(userId: string, credentialId: string, database = db): Promise<void> {
    const passkey = database
      .select()
      .from(userPasskeys)
      .where(and(eq(userPasskeys.id, credentialId), eq(userPasskeys.userId, userId)))
      .get();

    if (!passkey) {
      throw new PasskeyError('Passkey not found', 404, 'NOT_FOUND');
    }

    database.delete(userPasskeys).where(eq(userPasskeys.id, credentialId)).run();
  }
}

export const passkeyService = new PasskeyService();
