import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Valid roles in the system (3-tier hierarchy)
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

// Role hierarchy for permission checking
const ROLE_HIERARCHY: Record<UserRole, number> = {
    USER: 0,
    ADMIN: 1,
    SUPER_ADMIN: 2,
};

/**
 * Middleware factory to require specific role(s)
 * Usage: router.use(requireRole('ADMIN', 'SUPER_ADMIN'))
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Fetch user with current role from database
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, isActive: true },
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check if user account is active
            if (!user.isActive) {
                return res.status(403).json({ error: 'Account is suspended' });
            }

            // Check if user has required role
            const userRole = user.role as UserRole;
            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    required: allowedRoles,
                    current: userRole
                });
            }

            // Attach role to request for downstream use
            (req as any).userRole = userRole;

            next();
        } catch (error) {
            console.error('Role middleware error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
};

/**
 * Shorthand middleware for requiring ADMIN or SUPER_ADMIN role
 */
export const requireAdmin = requireRole('ADMIN', 'SUPER_ADMIN');

/**
 * Shorthand middleware for requiring SUPER_ADMIN role only
 */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');

/**
 * Middleware to check if user account is active (not suspended)
 * Use this on routes where even regular users need active status check
 */
export const requireActive = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isActive: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.isActive) {
            return res.status(403).json({ error: 'Account is suspended' });
        }

        next();
    } catch (error) {
        console.error('Active check middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Helper function to check if a role can perform an action on another role
 * Prevents admins from modifying super admins, etc.
 */
export const canModifyRole = (actorRole: UserRole, targetRole: UserRole): boolean => {
    return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
};

/**
 * Helper function to check if a role can assign another role
 * Super admins can assign any role, admins cannot assign super admin
 */
export const canAssignRole = (actorRole: UserRole, newRole: UserRole): boolean => {
    if (actorRole === 'SUPER_ADMIN') return true;
    if (actorRole === 'ADMIN' && newRole !== 'SUPER_ADMIN') return true;
    return false;
};
