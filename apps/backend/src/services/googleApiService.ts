import { google } from 'googleapis';
import prisma from '../utils/prisma.js';
import { decrypt } from './encryptionService.js';

/**
 * Creates a fully authenticated Google OAuth2 client for a given user.
 * This client will automatically handle token refreshing, solving 'invalid_grant' errors.
 * @param userId The ID of the user from your database.
 * @returns A promise that resolves to a fully authenticated OAuth2Client instance.
 */
export const getAuthenticatedClient = async (userId: number | string) => {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) {
    throw new Error('Invalid user id');
  }
  // 1. Fetch the user's connected account from your database.
  const account = await prisma.connectedAccount.findFirst({
    where: {
      userId: numericUserId,
      provider: 'google'
    }
  });

  const settings = await prisma.userSettings.findUnique({
    where: { userId: numericUserId }
  });

  if (!account || !account.accessToken || !account.refreshToken) {
    throw new Error('Google account is not connected or tokens are missing. Please go to the dashboard and reconnect your account.');
  }

  // 2. Create the OAuth client using either custom credentials or global fallback.
  let oauth2Client;
  if (settings && settings.googleClientId && settings.googleClientSecret) {
    oauth2Client = new google.auth.OAuth2(
      settings.googleClientId,
      decrypt(settings.googleClientSecret),
      process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL
    );
  } else {
    oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || process.env.GOOGLE_CALLBACK_URL
    );
  }

  // 3. Decrypt and set BOTH the access token and the refresh token.
  // This is the crucial step that enables automatic token refreshing.
  oauth2Client.setCredentials({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken)
  });

  return oauth2Client;
};