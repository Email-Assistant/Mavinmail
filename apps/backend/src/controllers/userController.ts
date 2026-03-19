import { type Response } from 'express';
import { type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import prisma from '../utils/prisma.js';
import { encrypt, decrypt } from '../services/encryptionService.js';
import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger.js';

// Controller to get the status of the user's Google connection
export const getConnectionStatus = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const googleAccount = await prisma.connectedAccount.findFirst({
      where: { userId: Number(userId), provider: 'google' },
    });

    if (googleAccount) {
      res.status(200).json({ isConnected: true, email: googleAccount.email });
    } else {
      res.status(200).json({ isConnected: false });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error checking connection status' });
  }
};

// Controller to disconnect a Google account
export const disconnectGoogleAccount = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const account = await prisma.connectedAccount.findFirst({
      where: { userId: Number(userId), provider: 'google' },
    });

    if (account) {
      // CRITICAL STEP: Revoke the token with Google first.
      // This tells Google the user has withdrawn permission.
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        // We need to decrypt the token to revoke it.
        const decryptedToken = decrypt(account.refreshToken || account.accessToken);
        await oauth2Client.revokeToken(decryptedToken);
        logger.info(`Successfully revoked token for user ${userId}`);
      } catch (revocationError) {
        logger.error('Failed to revoke Google token, but proceeding with DB deletion:', revocationError);
      }

      // Now, delete the record from our database.
      await prisma.connectedAccount.delete({
        where: { id: account.id },
      });
    }

    res.status(200).json({ message: 'Account disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during disconnection' });
  }
};

// ====================================================================
// =====> NEW: Handlers for User Preferences <=====
// ====================================================================

export const getPreferences = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { preferredModel: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user has no preference, get the system default (from DB or env)
    let preferredModel = user.preferredModel;
    if (!preferredModel) {
      // Get default from database first, then fall back to env
      const defaultModel = await prisma.aIModel.findFirst({
        where: { isDefault: true, isActive: true },
        select: { modelId: true },
      });
      preferredModel = defaultModel?.modelId || process.env.DEFAULT_AI_MODEL || process.env.FALLBACK_AI_MODEL || null;
    }

    res.status(200).json({
      preferredModel,
    });
  } catch (error) {
    logger.error('Error fetching preferences:', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
};

export const updatePreferences = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { preferredModel } = req.body;

  if (!preferredModel) {
    return res.status(400).json({ message: 'preferredModel is required' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { preferredModel },
    });

    logger.info(`✅ Updated model preference for user ${userId} to: ${preferredModel}`);

    res.status(200).json({
      message: 'Preferences updated successfully',
      preferredModel: user.preferredModel,
    });
  } catch (error) {
    logger.error('Error updating preferences:', error);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
};

// ====================================================================
// =====> User Profile Handlers <=====
// ====================================================================

/**
 * GET /api/user/profile
 * Returns the user's profile information (firstName, lastName, email)
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
    });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * PUT /api/user/profile
 * Updates the user's profile information
 * - firstName and lastName can be updated directly
 * - Email change requires currentPassword for security
 */
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { firstName, lastName, email, currentPassword } = req.body;

  try {
    // Fetch current user data
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        email: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build the update data
    const updateData: { firstName?: string; lastName?: string; email?: string } = {};

    // Always allow firstName/lastName updates
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;

    // Handle email change with security verification
    if (email && email !== user.email) {
      // Password is required to change email
      if (!currentPassword) {
        return res.status(400).json({
          error: 'Password required to change email',
          code: 'PASSWORD_REQUIRED'
        });
      }

      // Verify the password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          error: 'Invalid password',
          code: 'INVALID_PASSWORD'
        });
      }

      // Check if new email is already taken
      const existingUser = await prisma.user.findUnique({
        where: { email: email },
      });

      if (existingUser) {
        return res.status(409).json({
          error: 'Email already in use',
          code: 'EMAIL_TAKEN'
        });
      }

      updateData.email = email;
      logger.info(`📧 Email change requested for user ${userId}: ${user.email} → ${email}`);
    }

    // Perform the update
    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data: updateData,
      select: {
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    logger.info(`✅ Profile updated for user ${userId}`);

    res.status(200).json({
      success: true,
      firstName: updatedUser.firstName || '',
      lastName: updatedUser.lastName || '',
      email: updatedUser.email,
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// ====================================================================
// =====&gt; Credit System Handlers &lt;=====
// ====================================================================

/**
 * GET /api/user/credits
 * Returns the user's current credit balance and plan
 */
export const getCredits = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { credits: true, plan: true, role: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Admins have unlimited credits
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return res.status(200).json({
        credits: -1, // -1 signals unlimited to the frontend
        plan: 'ADMIN',
        role: user.role,
      });
    }

    res.status(200).json({
      credits: user.credits,
      plan: user.plan,
      role: user.role,
    });
  } catch (error) {
    logger.error('Error fetching credits:', error);
    res.status(500).json({ error: 'Failed to fetch credit balance' });
  }
};

// ====================================================================
// =====> Custom Google OAuth Credentials <=====
// ====================================================================

/**
 * GET /api/user/google-credentials
 * Returns the configured googleClientId (secret is never returned)
 */
export const getGoogleCredentials = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const settings = await prisma.userSettings.findUnique({
      where: { userId: Number(userId) },
      select: { googleClientId: true },
    });

    res.status(200).json({
      googleClientId: settings?.googleClientId || null,
      hasCustomCredentials: !!settings?.googleClientId,
    });
  } catch (error) {
    logger.error('Error fetching google credentials:', error);
    res.status(500).json({ error: 'Failed to fetch google credentials' });
  }
};

/**
 * PUT /api/user/google-credentials
 * Updates custom Google Client ID and Secret for this user
 */
export const updateGoogleCredentials = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { googleClientId, googleClientSecret } = req.body;

  try {
    // Both or neither must be provided. If both null/empty, we remove them.
    const isClearing = !googleClientId && !googleClientSecret;
    const isSetting = googleClientId && googleClientSecret;

    if (!isClearing && !isSetting) {
      return res.status(400).json({ error: 'Both Client ID and Secret must be provided to set custom credentials, or both empty to clear them.' });
    }

    const data: any = {};
    if (isClearing) {
      data.googleClientId = null;
      data.googleClientSecret = null;
    } else {
      data.googleClientId = googleClientId;
      data.googleClientSecret = encrypt(googleClientSecret); // Encrypt before storing
    }

    // Upsert user settings
    await prisma.userSettings.upsert({
      where: { userId: Number(userId) },
      update: data,
      create: {
        userId: Number(userId),
        ...data,
      },
    });

    logger.info(`${isClearing ? 'Cleared' : 'Updated'} custom Google credentials for user ${userId}`);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error updating google credentials:', error);
    res.status(500).json({ error: 'Failed to update google credentials' });
  }
};