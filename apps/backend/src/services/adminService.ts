import { PrismaClient } from '@prisma/client';
import { UserRole } from '../middleware/roleMiddleware.js';

const prisma = new PrismaClient();

// ============================================================================
// USER LISTING & DETAILS
// ============================================================================

interface ListUsersOptions {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    isActive?: boolean;
}

export const listUsers = async (options: ListUsersOptions = {}) => {
    const { page = 1, limit = 20, search, role, isActive } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
        where.OR = [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (role) {
        where.role = role;
    }

    if (typeof isActive === 'boolean') {
        where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
                _count: {
                    select: {
                        usageLogs: true,
                        connectedAccounts: true,
                    },
                },
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        users,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};

export const getUserById = async (id: number) => {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            preferredModel: true,
            _count: {
                select: {
                    usageLogs: true,
                    connectedAccounts: true,
                    syncHistory: true,
                    scheduledTasks: true,
                },
            },
            connectedAccounts: {
                select: {
                    id: true,
                    provider: true,
                    email: true,
                    createdAt: true,
                },
            },
            settings: true,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    return user;
};

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export const updateUserRole = async (
    userId: number,
    newRole: UserRole,
    actorId: number,
    ipAddress?: string
) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const oldRole = user.role;

    // Update the role
    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { role: newRole },
        select: {
            id: true,
            email: true,
            role: true,
        },
    });

    // Log the action
    await logAdminAction({
        actorId,
        action: 'ROLE_CHANGED',
        targetType: 'USER',
        targetId: userId,
        metadata: { oldRole, newRole },
        ipAddress,
    });

    return updatedUser;
};

export const suspendUser = async (
    userId: number,
    actorId: number,
    reason?: string,
    ipAddress?: string
) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true, role: true },
    });

    if (!user) {
        throw new Error('User not found');
    }

    if (!user.isActive) {
        throw new Error('User is already suspended');
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
        select: {
            id: true,
            email: true,
            isActive: true,
        },
    });

    await logAdminAction({
        actorId,
        action: 'USER_SUSPENDED',
        targetType: 'USER',
        targetId: userId,
        metadata: { reason },
        ipAddress,
    });

    return updatedUser;
};

export const activateUser = async (
    userId: number,
    actorId: number,
    ipAddress?: string
) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
    });

    if (!user) {
        throw new Error('User not found');
    }

    if (user.isActive) {
        throw new Error('User is already active');
    }

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
        select: {
            id: true,
            email: true,
            isActive: true,
        },
    });

    await logAdminAction({
        actorId,
        action: 'USER_ACTIVATED',
        targetType: 'USER',
        targetId: userId,
        metadata: {},
        ipAddress,
    });

    return updatedUser;
};

// ============================================================================
// PLATFORM STATS
// ============================================================================

export const getPlatformStats = async () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        usersToday,
        usersByRole,
        apiCallsToday,
        apiCallsMonth,
        syncHistoryToday,
    ] = await Promise.all([
        // Total users
        prisma.user.count(),

        // Active users (not suspended)
        prisma.user.count({ where: { isActive: true } }),

        // Suspended users
        prisma.user.count({ where: { isActive: false } }),

        // New users today
        prisma.user.count({
            where: { createdAt: { gte: startOfToday } },
        }),

        // Users by role
        prisma.user.groupBy({
            by: ['role'],
            _count: { role: true },
        }),

        // API calls today
        prisma.usageLog.count({
            where: { createdAt: { gte: startOfToday } },
        }),

        // API calls this month
        prisma.usageLog.count({
            where: { createdAt: { gte: startOfMonth } },
        }),

        // Total emails synced today
        prisma.syncHistory.aggregate({
            where: { syncedAt: { gte: startOfToday } },
            _sum: { emailCount: true },
        }),
    ]);

    // Transform role counts
    const roleBreakdown = usersByRole.reduce((acc: Record<string, number>, item) => {
        acc[item.role] = item._count.role;
        return acc;
    }, {});

    return {
        users: {
            total: totalUsers,
            active: activeUsers,
            suspended: suspendedUsers,
            newToday: usersToday,
            byRole: roleBreakdown,
        },
        activity: {
            apiCallsToday,
            apiCallsMonth,
            emailsSyncedToday: syncHistoryToday._sum.emailCount || 0,
        },
    };
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================

interface LogAdminActionParams {
    actorId: number;
    action: string;
    targetType: string;
    targetId?: number;
    metadata?: Record<string, any>;
    ipAddress?: string;
}

export const logAdminAction = async (params: LogAdminActionParams) => {
    return prisma.auditLog.create({
        data: {
            actorId: params.actorId,
            action: params.action,
            targetType: params.targetType,
            targetId: params.targetId,
            metadata: params.metadata || {},
            ipAddress: params.ipAddress,
        },
    });
};

export const getAuditLogs = async (options: {
    page?: number;
    limit?: number;
    actorId?: number;
    action?: string;
}) => {
    const { page = 1, limit = 50, actorId, action } = options;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (actorId) {
        where.actorId = actorId;
    }

    if (action) {
        where.action = action;
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                actor: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        }),
        prisma.auditLog.count({ where }),
    ]);

    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    };
};
