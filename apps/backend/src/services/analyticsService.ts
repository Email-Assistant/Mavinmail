/**
 * Analytics Service
 * 
 * Handles all analytics-related operations including:
 * - Logging AI usage events
 * - Fetching aggregated dashboard statistics
 * - Calculating time-saved metrics
 * - Usage trend analysis
 */

import prisma from '../utils/prisma.js';
import { google } from 'googleapis';
import { decrypt } from './encryptionService.js';

// ============================================================================
// TYPES
// ============================================================================

export type ActionType =
    | 'summarize'
    | 'draft'
    | 'enhance'
    | 'rag_query'
    | 'digest'
    | 'thread_summary'
    | 'autocomplete';

export interface LogUsageParams {
    userId: number;
    action: ActionType;
    metadata?: Record<string, any>;
    success?: boolean;
}

export interface DashboardStats {
    emailsToday: number;
    totalEmails: number;
    emailsIndexed: number;
    draftsGenerated: number;
    questionsAnswered: number;
    threadsSummarized: number;
    textEnhancements: number;
    timeSavedMinutes: number;
    lastSyncTime: string | null;
    connectedAccounts: number;
}

export interface ActivityItem {
    id: number;
    action: string;
    description: string;
    timestamp: string;
    success: boolean;
}

export interface UsageTrend {
    date: string;
    total: number;
    breakdown: {
        summarize: number;
        draft: number;
        enhance: number;
        rag: number;
        digest: number;
    };
}

// ============================================================================
// TIME ESTIMATES (in minutes)
// ============================================================================

const TIME_ESTIMATES: Record<ActionType, number> = {
    summarize: 3,        // Time to read an email thread manually
    draft: 5,            // Time to write a reply from scratch
    enhance: 2,          // Time to edit and polish text
    rag_query: 4,        // Time to search through emails manually
    digest: 10,          // Time to read all daily emails individually
    thread_summary: 3,   // Time to read a thread
    autocomplete: 1,     // Time saved on typing
};

// ============================================================================
// LOGGING FUNCTIONS
// ============================================================================

/**
 * Log a usage event for analytics tracking
 */
export async function logUsage(params: LogUsageParams): Promise<void> {
    const { userId, action, metadata = {}, success = true } = params;

    try {
        await prisma.usageLog.create({
            data: {
                userId,
                action,
                metadata,
                success,
            },
        });
    } catch (error) {
        // Don't throw - logging failures shouldn't break main functionality
        console.error('[AnalyticsService] Failed to log usage:', error);
    }
}

/**
 * Log sync history when emails are synced
 */
export async function logSyncHistory(
    userId: number,
    emailCount: number,
    status: 'success' | 'failed' | 'partial' = 'success',
    errorMsg?: string
): Promise<void> {
    try {
        await prisma.syncHistory.create({
            data: {
                userId,
                emailCount,
                status,
                errorMsg,
            },
        });
    } catch (error) {
        console.error('[AnalyticsService] Failed to log sync history:', error);
    }
}

// ============================================================================
// DASHBOARD STATISTICS
// ============================================================================

/**
 * Get comprehensive dashboard statistics for a user
 */
export async function getDashboardStats(userId: number): Promise<DashboardStats> {
    // Get start of today (UTC)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Run all queries in parallel for performance
    const [
        usageCounts,
        todayDigest,
        syncStats,
        connectedAccountsCount,
        lastSync,
    ] = await Promise.all([
        // Count all usage by action type (all time)
        prisma.usageLog.groupBy({
            by: ['action'],
            where: { userId, success: true },
            _count: { action: true },
        }),

        // Count emails synced today
        prisma.syncHistory.aggregate({
            where: {
                userId,
                status: 'success',
                syncedAt: { gte: todayStart },
            },
            _sum: { emailCount: true },
        }),

        // Get total emails synced and indexed
        prisma.syncHistory.aggregate({
            where: { userId, status: 'success' },
            _sum: { emailCount: true },
        }),

        // Count connected accounts
        prisma.connectedAccount.count({
            where: { userId },
        }),

        // Get last sync time
        prisma.syncHistory.findFirst({
            where: { userId, status: 'success' },
            orderBy: { syncedAt: 'desc' },
            select: { syncedAt: true, emailCount: true },
        }),
    ]);

    // --- LIVE STATS FETCHING ---
    // User requested "real data fetched from backend" for today's emails.
    // We try to fetch live stats from Gmail API if a connected account exists.
    let liveStats = { today: 0, total: 0, usingLive: false };

    try {
        const googleAccount = await prisma.connectedAccount.findFirst({
            where: { userId, provider: 'google' }
        });

        if (googleAccount) {
            const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID!,
                process.env.GOOGLE_CLIENT_SECRET!
            );
            // We need to handle potential token decryption errors or refresh logic here ideally,
            // but for a dashboard read, we'll try the access token we have.
            oauth2Client.setCredentials({ access_token: decrypt(googleAccount.accessToken) });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Parallel fetch for speed
            const [profileRes, todayRes] = await Promise.all([
                // Get user profile which contains messagesTotal (All Mail count)
                gmail.users.getProfile({
                    userId: 'me'
                }).catch(() => null),
                // Get emails received today - using after: timestamp for accurate count
                // The timestamp is in seconds since epoch for the start of today
                gmail.users.messages.list({
                    userId: 'me',
                    q: `after:${Math.floor(todayStart.getTime() / 1000)}`,
                    maxResults: 500  // Get actual list to count accurately
                }).catch(() => null)
            ]);

            if (profileRes && todayRes) {
                liveStats = {
                    // Count actual messages returned for today
                    today: todayRes.data.messages?.length || 0,
                    // messagesTotal from profile is the exact count of all emails (All Mail)
                    total: profileRes.data.messagesTotal || 0,
                    usingLive: true
                };
            }
        }
    } catch (e) {
        console.warn('Failed to fetch live Gmail stats for dashboard:', e);
        // Fallback to DB stats seamlessly
    }

    // Process usage counts into a map
    const usageMap: Record<string, number> = {};
    for (const item of usageCounts) {
        usageMap[item.action] = item._count.action;
    }

    // Calculate time saved
    let timeSavedMinutes = 0;
    for (const [action, count] of Object.entries(usageMap)) {
        const estimate = TIME_ESTIMATES[action as ActionType] || 0;
        timeSavedMinutes += count * estimate;
    }

    // Determine final stats values (Prefer live -> DB fallback)
    const emailsToday = liveStats.usingLive ? liveStats.today : 0;
    // For total emails, if we have live stats, use that. Otherwise use sync history sum.
    const totalEmails = liveStats.usingLive ? liveStats.total : (syncStats._sum.emailCount || 0);

    return {
        emailsToday,
        totalEmails,
        emailsIndexed: syncStats._sum.emailCount || 0, // Indexed count remains DB-based
        draftsGenerated: usageMap['draft'] || 0,
        questionsAnswered: usageMap['rag_query'] || 0,
        threadsSummarized: (usageMap['summarize'] || 0) + (usageMap['thread_summary'] || 0),
        textEnhancements: usageMap['enhance'] || 0,
        timeSavedMinutes,
        lastSyncTime: lastSync?.syncedAt?.toISOString() || null,
        connectedAccounts: connectedAccountsCount,
    };
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

/**
 * Get recent AI activity for a user
 */
export async function getRecentActivity(
    userId: number,
    limit: number = 10
): Promise<ActivityItem[]> {
    const logs = await prisma.usageLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });

    return logs.map((log) => ({
        id: log.id,
        action: log.action,
        description: getActionDescription(log.action, log.metadata as any),
        timestamp: log.createdAt.toISOString(),
        success: log.success,
        metadata: log.metadata as any,
    }));
}

/**
 * Generate human-readable description for an action
 */
function getActionDescription(action: string, metadata?: Record<string, any>): string {
    switch (action) {
        case 'summarize':
            return 'Summarized an email';
        case 'thread_summary':
            return 'Summarized email thread';
        case 'draft':
            return 'Generated draft reply';
        case 'enhance':
            const type = metadata?.type || 'general';
            return `Enhanced text (${type})`;
        case 'rag_query':
            const query = metadata?.query?.slice(0, 50) || 'question';
            return `Answered: "${query}..."`;
        case 'digest':
            const count = metadata?.emailCount || 0;
            return `Generated daily digest (${count} emails)`;
        case 'autocomplete':
            return 'AI autocomplete suggestion';
        default:
            return `AI action: ${action}`;
    }
}

// ============================================================================
// USAGE TRENDS
// ============================================================================

/**
 * Get usage trends for the past N days
 */
export async function getUsageTrends(
    userId: number,
    days: number = 7
): Promise<UsageTrend[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get all logs in the period
    const logs = await prisma.usageLog.findMany({
        where: {
            userId,
            createdAt: { gte: startDate },
            success: true,
        },
        select: {
            action: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const trendMap: Record<string, UsageTrend> = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        const dateStr = date.toISOString().split('T')[0];
        trendMap[dateStr] = {
            date: dateStr,
            total: 0,
            breakdown: {
                summarize: 0,
                draft: 0,
                enhance: 0,
                rag: 0,
                digest: 0,
            },
        };
    }

    // Populate with actual data
    for (const log of logs) {
        const dateStr = log.createdAt.toISOString().split('T')[0];
        if (trendMap[dateStr]) {
            trendMap[dateStr].total++;

            const action = log.action;
            if (action === 'summarize' || action === 'thread_summary') {
                trendMap[dateStr].breakdown.summarize++;
            } else if (action === 'draft') {
                trendMap[dateStr].breakdown.draft++;
            } else if (action === 'enhance') {
                trendMap[dateStr].breakdown.enhance++;
            } else if (action === 'rag_query') {
                trendMap[dateStr].breakdown.rag++;
            } else if (action === 'digest') {
                trendMap[dateStr].breakdown.digest++;
            }
        }
    }

    return Object.values(trendMap);
}

// ============================================================================
// EMAIL STATISTICS (per account)
// ============================================================================

/**
 * Get email statistics for connected accounts
 */
export async function getAccountEmailStats(userId: number) {
    const [syncStats, lastSync] = await Promise.all([
        prisma.syncHistory.aggregate({
            where: { userId, status: 'success' },
            _sum: { emailCount: true },
        }),
        prisma.syncHistory.findFirst({
            where: { userId, status: 'success' },
            orderBy: { syncedAt: 'desc' },
        }),
    ]);

    return {
        totalProcessed: syncStats._sum.emailCount || 0,
        indexed: syncStats._sum.emailCount || 0,
        lastSync: lastSync?.syncedAt?.toISOString() || null,
    };
}

export default {
    logUsage,
    logSyncHistory,
    getDashboardStats,
    getRecentActivity,
    getUsageTrends,
    getAccountEmailStats,
};
