import { Router } from 'express';
import {
    getConnectionStatus,
    disconnectGoogleAccount,
    getPreferences,
    updatePreferences,
    getProfile,
    updateProfile
} from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// All routes in this file are protected and require a valid token
router.use(authMiddleware);

// GET /api/user/connection-status
router.get('/connection-status', getConnectionStatus);

// DELETE /api/user/connections/google
router.delete('/connections/google', disconnectGoogleAccount);

// ====================================================================
// =====> Routes for User Preferences <=====
// ====================================================================

// GET /api/user/preferences
router.get('/preferences', getPreferences);

// PUT /api/user/preferences
router.put('/preferences', updatePreferences);

// ====================================================================
// =====> Routes for User Profile <=====
// ====================================================================

// GET /api/user/profile - Fetch user profile
router.get('/profile', getProfile);

// PUT /api/user/profile - Update user profile (secure email change)
router.put('/profile', updateProfile);

export default router;