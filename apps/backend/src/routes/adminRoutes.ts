import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/roleMiddleware.js';
import {
    listUsers,
    getUserById,
    updateUserRole,
    suspendUser,
    activateUser,
    getPlatformStats,
    getAuditLogs,
} from '../controllers/adminController.js';

const router = Router();

// ============================================================================
// ALL ADMIN ROUTES REQUIRE:
// 1. Authentication (authMiddleware)
// 2. Admin role (requireAdmin) - ADMIN or SUPER_ADMIN
// ============================================================================

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================================================
// USER MANAGEMENT ROUTES - Requires ADMIN or SUPER_ADMIN
// ============================================================================

// GET /api/admin/users - List all users (paginated)
router.get('/users', requireAdmin, listUsers);

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', requireAdmin, getUserById);

// PUT /api/admin/users/:id - Update user role
router.put('/users/:id', requireAdmin, updateUserRole);

// POST /api/admin/users/:id/suspend - Suspend user
router.post('/users/:id/suspend', requireAdmin, suspendUser);

// POST /api/admin/users/:id/activate - Activate user
router.post('/users/:id/activate', requireAdmin, activateUser);

// ============================================================================
// PLATFORM STATS ROUTES - Requires ADMIN or SUPER_ADMIN
// ============================================================================

// GET /api/admin/stats - Platform overview statistics
router.get('/stats', requireAdmin, getPlatformStats);

// ============================================================================
// AUDIT LOG ROUTES - Requires SUPER_ADMIN only
// ============================================================================

// GET /api/admin/audit-logs - View audit history
router.get('/audit-logs', requireSuperAdmin, getAuditLogs);

export default router;
