import { type Request, type Response } from 'express';
import { createUser, loginUser , connectGoogleAccount} from '../services/authService.js';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await createUser(email, password);
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await loginUser(email, password);
    res.status(200).json({ user, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// 1. Create the Google OAuth Client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// 2. Controller to generate the Auth URL
export const getGoogleAuthUrl = (req: any, res: Response) => {
  const userId = req.user.userId; // From authMiddleware

  // Create a short-lived JWT to use as the 'state'
  const stateToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '24h' });

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important to get a refresh token
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
    state: stateToken, // Pass the JWT as the state
  });

  res.status(200).json({ url });
};

// 3. Controller to handle the callback from Google
export const handleGoogleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      throw new Error('Missing code or state from Google callback');
    }

    // Verify the state token to get the user ID
    const decodedState: any = jwt.verify(state as string, process.env.JWT_SECRET!);
    const userId = decodedState.userId;

    // Exchange the authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);
    const { access_token, refresh_token } = tokens;

    // Get user's email from Google
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!access_token || !data.email) {
        throw new Error('Failed to retrieve token or email from Google.');
    }

    // Save the encrypted tokens to the database
    await connectGoogleAccount({
        userId,
        email: data.email,
        accessToken: access_token,
        refreshToken: refresh_token || null,
    });

    // Redirect user back to the dashboard with a success message
    // Support both old dashboard (3000) and new dashboard-static
    // Use environment variable if set, otherwise default to new dashboard
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/dashboard?success=gmail_connected`);

  } catch (error) {
    console.error('Google callback error:', error);
    const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3000';
    res.redirect(`${dashboardUrl}/dashboard?error=auth_failed`);
  }
};