import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../services/encryptionService.js';
import { google } from 'googleapis';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Controller to get the status of the user's Google connection
export const getConnectionStatus = async (req: any, res: Response) => {
  const userId = req.user.userId;

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
export const disconnectGoogleAccount = async (req: any, res: Response) => {
  const userId = req.user.userId;

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
        console.log(`Successfully revoked token for user ${userId}`);
      } catch (revocationError) {
        console.error('Failed to revoke Google token, but proceeding with DB deletion:', revocationError);
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

export const getPreferences = async (req: any, res: Response) => {
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { preferredModel: true }, // Only fetch what we need
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      preferredModel: user.preferredModel || process.env.DEFAULT_AI_MODEL || 'google/gemini-2.0-flash-exp:free',
    });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ message: 'Failed to fetch preferences' });
  }
};

export const updatePreferences = async (req: any, res: Response) => {
  const userId = req.user.userId;
  const { preferredModel } = req.body;

  if (!preferredModel) {
    return res.status(400).json({ message: 'preferredModel is required' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: Number(userId) },
      data: { preferredModel },
    });

    console.log(`✅ Updated model preference for user ${userId} to: ${preferredModel}`);

    res.status(200).json({
      message: 'Preferences updated successfully',
      preferredModel: user.preferredModel,
    });
  } catch (error) {
    console.error('Error updating preferences:', error);
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
export const getProfile = async (req: any, res: Response) => {
  const userId = req.user.userId;

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
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * PUT /api/user/profile
 * Updates the user's profile information
 * - firstName and lastName can be updated directly
 * - Email change requires currentPassword for security
 */
export const updateProfile = async (req: any, res: Response) => {
  const userId = req.user.userId;
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
      console.log(`📧 Email change requested for user ${userId}: ${user.email} → ${email}`);
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

    console.log(`✅ Profile updated for user ${userId}`);

    res.status(200).json({
      success: true,
      firstName: updatedUser.firstName || '',
      lastName: updatedUser.lastName || '',
      email: updatedUser.email,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};