import { type Response } from 'express';
import { type AuthenticatedRequest } from '../middleware/authMiddleware.js';
import prisma from '../utils/prisma.js';
import { google } from 'googleapis';
import { decrypt, encrypt } from '../services/encryptionService.js';
import { summarizeEmailBatch } from '../services/aiService.js';
import { getEmailBody, cleanEmailBody, categorizeEmail } from '../utils/emailHelpers.js';
import { OpenRouterService } from '../services/openrouterService.js';
import logger from '../utils/logger.js';
const gmail = google.gmail('v1');

// feauture 1 code

export const getDailyDigest = async (req: AuthenticatedRequest, res: Response) => {
  const userId = Number(req.user?.userId);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'Invalid user id in token.' });
  }

  // Get date from query parameter, default to today
  let targetDate: Date;
  if (req.query.date) {
    targetDate = new Date(req.query.date as string);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
  } else {
    targetDate = new Date();
  }

  // --- Model Selection Logic ---
  let model = process.env.DEFAULT_AI_MODEL || "google/gemini-2.0-flash-exp:free";
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredModel: true }
    });
    if (user?.preferredModel) model = user.preferredModel;
  } catch (e) {
    logger.error("Failed to fetch user preference", e);
  }

  if (req.headers['x-model-id']) {
    model = req.headers['x-model-id'] as string;
  }
  // -----------------------------

  try {
    // 1. Get user's Google token from the database
    let googleAccount;
    let dbRetries = 3;
    while (dbRetries > 0) {
      try {
        googleAccount = await prisma.connectedAccount.findFirst({
          where: { userId, provider: 'google' },
        });
        break;
      } catch (err: any) {
        if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server') && dbRetries > 1) {
          logger.warn(`[DB] Connection error, retrying... (${dbRetries - 1} left)`);
          dbRetries--;
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          throw err;
        }
      }
    }

    if (!googleAccount) {
      return res.status(404).json({ error: 'Google account not connected.' });
    }

    // 2. Setup Google API client with the user's decrypted token
    // 2. Setup Google API client with the user's decrypted token
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALLBACK_URL
    );

    const accessToken = decrypt(googleAccount.accessToken);
    const refreshToken = googleAccount.refreshToken ? decrypt(googleAccount.refreshToken) : null;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // Automatically refresh tokens if expired
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        logger.info('[Gmail] Refreshing access token...');
        const newAccessToken = encrypt(tokens.access_token);
        // If a new refresh token is provided, update it too
        // (Google only sends refresh token on first auth or if revoked, but sometimes it rotates)
        const newRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined;

        await prisma.connectedAccount.update({
          where: {
            userId_provider: {
              userId,
              provider: 'google'
            }
          },
          data: {
            accessToken: newAccessToken,
            ...(newRefreshToken && { refreshToken: newRefreshToken })
          }
        });
        logger.info('[Gmail] Token refreshed and saved to DB.');
      }
    });

    // 3. Query the Gmail API for ALL emails on the specified date
    // Gmail's "after" and "before" filters use UNIX timestamps (seconds)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const startEpoch = Math.floor(startOfDay.getTime() / 1000);
    const endEpoch = Math.floor(endOfDay.getTime() / 1000);

    // Get ALL emails from the specified date
    // Try simpler query first - just get all emails after the date (excluding promotions/social)
    let listResponse;
    let messages: any[] = [];

    // First try: Get all emails from the date (ALL categories: Primary, Social, Promotions)
    try {
      listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: `after:${startEpoch} before:${endEpoch}`, // Removed category exclusions
        maxResults: 100,
        auth: oauth2Client,
      });
      messages = listResponse.data.messages || [];
      logger.info(`Found ${messages.length} emails (all categories) for date ${startOfDay.toISOString()}`);
    } catch (err) {
      logger.error('First query attempt failed:', err);
    }

    // Fallback logic for queries removed/simplified since we want everything now.
    // Kept the filter logic in case list returns broader range, but simplified search queries above.

    // If still no results, try with just after: (broader search) and filter by date manually
    if (!messages || messages.length === 0) {
      try {
        listResponse = await gmail.users.messages.list({
          userId: 'me',
          q: `after:${startEpoch}`,
          maxResults: 100,
          auth: oauth2Client,
        });

        if (listResponse.data.messages && listResponse.data.messages.length > 0) {
          // Fetch email dates to filter
          const emailDetails = await Promise.all(
            listResponse.data.messages.slice(0, 100).map(msg =>
              gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                auth: oauth2Client,
                format: 'METADATA',
                metadataHeaders: ['Date'],
              }).catch(() => null)
            )
          );

          // Filter emails by date
          const targetDateStr = startOfDay.toISOString().split('T')[0];
          messages = listResponse.data.messages.filter((msg, idx) => {
            const emailDetail = emailDetails[idx];
            if (!emailDetail?.data?.payload?.headers) return false;

            const emailDate = emailDetail.data.payload.headers.find(h => h.name === 'Date');
            if (emailDate?.value) {
              try {
                const emailDateObj = new Date(emailDate.value);
                const emailDateStr = emailDateObj.toISOString().split('T')[0];
                return emailDateStr === targetDateStr;
              } catch {
                return false;
              }
            }
            return false;
          });
          logger.info(`Found ${messages.length} emails after date filtering for date ${startOfDay.toISOString()}`);
        }
      } catch (err) {
        logger.error('Third query attempt failed:', err);
      }
    }

    if (!messages || messages.length === 0) {
      // Return a consistent JSON format even when there are no emails
      const dateStr = targetDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const emptyDigest = JSON.stringify({
        title: `Email Digest - ${dateStr}`,
        sections: [
          {
            title: "No New Emails",
            items: [
              {
                heading: `No emails found for ${dateStr}.`,
                description: "You're all caught up!",
                action: null
              }
            ]
          }
        ]
      });
      return res.status(200).json({ summary: emptyDigest });
    }

    // 4. Fetch details (From, Subject, Body, Labels) for each email
    logger.info(`Processing ${messages.length} emails for digest...`);
    const emailPromises = messages.map(message =>
      gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        auth: oauth2Client,
        format: 'full',
      })
    );

    const emailResponses = await Promise.all(emailPromises);



    // 5. Format details into structured objects with ID and Category
    const emailData = emailResponses.map(res => {
      const payload = res.data.payload;
      const headers = payload?.headers;
      const from = headers?.find(h => h.name === 'From')?.value || 'N/A';
      const subject = headers?.find(h => h.name === 'Subject')?.value || 'N/A';
      const labelIds = res.data.labelIds || [];
      const id = res.data.id || 'unknown_id';

      const category = categorizeEmail(labelIds);

      logger.info(`[Digest Debug] ID: ${id}, Category: ${category}, From: ${from}, Subject: ${subject}`);

      const rawBody = getEmailBody(payload);
      const cleanBody = cleanEmailBody(rawBody);

      // Return structured object
      return {
        id: id,
        category: category,
        content: `From: ${from}\nSubject: ${subject}\nCategory: ${category}\nBody: ${cleanBody}`
      };
    });

    logger.info(`Sending ${emailData.length} emails in a single batch to LLM API...`);

    // 6. Call our AI service with STRUCTURED data
    const model = (req.headers['x-model-id'] as string) || (req.query.model as string);
    const digest = await summarizeEmailBatch(emailData, model);

    logger.info(`Successfully generated digest for ${emailData.length} emails`);

    // Ensure digest is a valid JSON string
    if (typeof digest !== 'string') {
      throw new Error('AI service returned invalid format');
    }

    // Validate that it's valid JSON before sending
    try {
      JSON.parse(digest);
    } catch (parseError) {
      logger.error('Invalid JSON from AI service:', digest);
      throw new Error('AI service returned invalid JSON');
    }

    res.status(200).json({ summary: digest });

  } catch (error: any) {
    logger.error('Error in getDailyDigest controller:', error);
    if (error.code === 401) { // Handle Google Auth errors specifically
      return res.status(401).json({ error: 'Google authentication failed. Please reconnect your account.' });
    }
    res.status(500).json({ error: 'Failed to generate the daily digest.' });
  }
};