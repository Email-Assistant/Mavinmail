import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import * as adminService from '../services/adminService.js';
import { canModifyRole, canAssignRole, UserRole } from '../middleware/roleMiddleware.js';

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/users
 * List all users with pagination and search
 */
export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { page, limit, search, role, isActive } = req.query;

        const result = await adminService.listUsers({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            search: search as string,
            role: role as UserRole,
            isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        });

        res.json(result);
    } catch (error: any) {
        console.error('List users error:', error);
        res.status(500).json({ error: error.message || 'Failed to list users' });
    }
};

/**
 * GET /api/admin/users/:id
 * Get detailed user information
 */
export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await adminService.getUserById(userId);
        res.json(user);
    } catch (error: any) {
        console.error('Get user error:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: error.message || 'Failed to get user' });
    }
};

/**
 * PUT /api/admin/users/:id
 * Update user role
 */
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        const { role: newRole } = req.body;
        const actorId = req.user!.userId;
        const actorRole = req.user!.role;

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Validate new role
        const validRoles: UserRole[] = ['USER', 'ADMIN', 'SUPER_ADMIN'];
        if (!validRoles.includes(newRole)) {
            return res.status(400).json({ error: 'Invalid role', validRoles });
        }

        // Prevent self-modification of role
        if (userId === actorId) {
            return res.status(403).json({ error: 'Cannot modify your own role' });
        }

        // Check if actor can assign this role
        if (!canAssignRole(actorRole, newRole)) {
            return res.status(403).json({
                error: 'Insufficient permissions to assign this role',
                yourRole: actorRole,
                targetRole: newRole
            });
        }

        // Get target user's current role to check permissions
        const targetUser = await adminService.getUserById(userId);
        const targetRole = targetUser.role as UserRole;

        // Check if actor can modify this user
        if (!canModifyRole(actorRole, targetRole)) {
            return res.status(403).json({
                error: 'Cannot modify a user with equal or higher privileges',
                yourRole: actorRole,
                targetRole: targetRole
            });
        }

        // Get IP address for audit logging
        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

        const result = await adminService.updateUserRole(userId, newRole, actorId, ipAddress);
        res.json(result);
    } catch (error: any) {
        console.error('Update role error:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        res.status(500).json({ error: error.message || 'Failed to update role' });
    }
};

/**
 * POST /api/admin/users/:id/suspend
 * Suspend a user account
 */
export const suspendUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        const { reason } = req.body;
        const actorId = req.user!.userId;
        const actorRole = req.user!.role;

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Prevent self-suspension
        if (userId === actorId) {
            return res.status(403).json({ error: 'Cannot suspend your own account' });
        }

        // Check target user's role
        const targetUser = await adminService.getUserById(userId);
        const targetRole = targetUser.role as UserRole;

        // Check if actor can modify this user
        if (!canModifyRole(actorRole, targetRole)) {
            return res.status(403).json({
                error: 'Cannot suspend a user with equal or higher privileges'
            });
        }

        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
        const result = await adminService.suspendUser(userId, actorId, reason, ipAddress);
        res.json({ message: 'User suspended successfully', user: result });
    } catch (error: any) {
        console.error('Suspend user error:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        if (error.message === 'User is already suspended') {
            return res.status(400).json({ error: 'User is already suspended' });
        }
        res.status(500).json({ error: error.message || 'Failed to suspend user' });
    }
};

/**
 * POST /api/admin/users/:id/activate
 * Activate a suspended user account
 */
export const activateUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = parseInt(req.params.id);
        const actorId = req.user!.userId;
        const actorRole = req.user!.role;

        if (isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Check target user's role
        const targetUser = await adminService.getUserById(userId);
        const targetRole = targetUser.role as UserRole;

        // Check if actor can modify this user
        if (!canModifyRole(actorRole, targetRole)) {
            return res.status(403).json({
                error: 'Cannot activate a user with equal or higher privileges'
            });
        }

        const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
        const result = await adminService.activateUser(userId, actorId, ipAddress);
        res.json({ message: 'User activated successfully', user: result });
    } catch (error: any) {
        console.error('Activate user error:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }
        if (error.message === 'User is already active') {
            return res.status(400).json({ error: 'User is already active' });
        }
        res.status(500).json({ error: error.message || 'Failed to activate user' });
    }
};

// ============================================================================
// PLATFORM STATS ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/stats
 * Get platform-wide statistics
 */
export const getPlatformStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const stats = await adminService.getPlatformStats();
        res.json(stats);
    } catch (error: any) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get platform stats' });
    }
};

// ============================================================================
// AUDIT LOG ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/audit-logs
 * Get admin audit logs (SUPER_ADMIN only)
 */
export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { page, limit, actorId, action } = req.query;

        const result = await adminService.getAuditLogs({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            actorId: actorId ? parseInt(actorId as string) : undefined,
            action: action as string,
        });

        res.json(result);
    } catch (error: any) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: error.message || 'Failed to get audit logs' });
    }
};
