import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { encrypt } from './encryptionService.js';

const prisma = new PrismaClient();

export const createUser = async (email: string, password: string) => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      preferredModel: process.env.DEFAULT_AI_MODEL || "google/gemini-2.0-flash-exp:free",
    },
  });
  return user;
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if account is suspended
  if (!user.isActive) {
    throw new Error('Account is suspended. Please contact support.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Include role in JWT payload for role-based access control
  const tokenPayload = {
    userId: user.id,
    role: user.role,
  };

  const token = jwt.sign(tokenPayload, process.env.JWT_SECRET!, {
    expiresIn: '30d',
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
    },
    token
  };
};


interface ConnectGoogleAccountArgs {
  userId: number;
  email: string;
  accessToken: string;
  refreshToken: string | null;
}

export const connectGoogleAccount = async ({ userId, email, accessToken, refreshToken }: ConnectGoogleAccountArgs) => {
  const encryptedAccessToken = encrypt(accessToken);
  const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

  // Use upsert to create or update the connection
  await prisma.connectedAccount.upsert({
    where: {
      userId_provider: {
        userId,
        provider: 'google',
      },
    },
    update: {
      email,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
    },
    create: {
      userId,
      provider: 'google',
      email,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
    },
  });
};