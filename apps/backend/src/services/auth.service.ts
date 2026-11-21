import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/index';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/token';
import { LoginInput, RegisterInput, UserProfile } from '@quiz-forge/shared';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  async register(
    input: RegisterInput,
    database = db
  ): Promise<{ user: UserProfile; token: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Check if user already exists
    const existing = database
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .get();

    if (existing) {
      throw new AuthError(
        'An account with this email address already exists.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }

    const passwordHash = await hashPassword(input.password);
    const userRole = input.role || 'student';

    const [newUser] = database
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: input.displayName.trim(),
        role: userRole,
      })
      .returning()
      .all();

    if (!newUser) {
      throw new AuthError('Failed to create user account.', 500, 'USER_CREATION_FAILED');
    }

    const token = await signToken({
      sub: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
    });

    const userProfile: UserProfile = {
      id: newUser.id,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
      createdAt: newUser.createdAt,
    };

    return { user: userProfile, token };
  }

  async login(
    input: LoginInput,
    database = db
  ): Promise<{ user: UserProfile; token: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    const user = database
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .get();

    if (!user) {
      throw new AuthError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new AuthError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    });

    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    };

    return { user: userProfile, token };
  }

  async getUserProfile(userId: string, database = db): Promise<UserProfile> {
    const user = database
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!user) {
      throw new AuthError('User account not found.', 404, 'USER_NOT_FOUND');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}

export const authService = new AuthService();
