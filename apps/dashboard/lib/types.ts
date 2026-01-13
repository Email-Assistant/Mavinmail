// ====================================================================
// Dashboard Types
// ====================================================================

/**
 * Main dashboard statistics shown in hero metric cards
 */
export interface DashboardStats {
    /** Total number of emails ever synced */
    totalEmails: number;
    /** Emails received today */
    emailsToday: number;
    /** Number of emails indexed in vector store */
    emailsIndexed: number;
    /** Number of AI draft replies generated */
    draftsGenerated: number;
    /** Number of RAG queries answered */
    questionsAnswered: number;
    /** Number of thread summaries created */
    threadsSummarized: number;
    /** Number of text enhancements made */
    textEnhancements: number;
    /** Estimated time saved in minutes */
    timeSavedMinutes: number;
    /** Last sync timestamp (ISO string) */
    lastSyncTime: string | null;
    /** Number of connected email accounts */
    connectedAccounts: number;
}

/**
 * Single AI activity item for the activity feed
 */
export interface ActivityItem {
    id: number;
    /** Action type: summarize, draft, enhance, rag_query, digest, thread_summary, autocomplete */
    action: 'summarize' | 'draft' | 'enhance' | 'rag_query' | 'digest' | 'thread_summary' | 'autocomplete';
    /** Human-readable description of the action */
    description: string;
    /** When the action occurred (ISO string) */
    timestamp: string;
    /** Whether the action completed successfully */
    success: boolean;
    /** Optional metadata about the action */
    metadata?: Record<string, unknown>;
}

/**
 * Usage trend data point for charts
 * Backend returns breakdown as an object
 */
export interface UsageTrend {
    /** Date string (YYYY-MM-DD) */
    date: string;
    /** Total actions on this day */
    total: number;
    /** Breakdown by action type (backend format) */
    breakdown?: {
        summarize: number;
        draft: number;
        enhance: number;
        rag: number;
        digest: number;
    };
    /** Flat format for frontend compatibility */
    summarize?: number;
    draft?: number;
    enhance?: number;
    rag?: number;
    digest?: number;
}

/**
 * Response from /api/dashboard/stats endpoint
 */
export interface DashboardStatsResponse {
    success: boolean;
    stats: DashboardStats;
}

/**
 * Response from /api/dashboard/activity endpoint
 */
export interface ActivityFeedResponse {
    success: boolean;
    activities: ActivityItem[];
}

/**
 * Response from /api/dashboard/usage-trends endpoint
 */
export interface UsageTrendsResponse {
    success: boolean;
    trends: UsageTrend[];
}

// ====================================================================
// Helper Types
// ====================================================================

/**
 * Common loading state for data fetching
 */
export interface LoadingState<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
}

/**
 * Time range options for analytics
 */
export type TimeRange = '7d' | '30d' | '90d';

/**
 * Action type labels for display
 */
export const ACTION_LABELS: Record<ActivityItem['action'], string> = {
    summarize: 'Email Summary',
    draft: 'Draft Reply',
    enhance: 'Text Enhancement',
    rag_query: 'Inbox Search',
    digest: 'Daily Digest',
    thread_summary: 'Thread Summary',
    autocomplete: 'Autocomplete',
};

/**
 * Action type colors for charts and icons
 */
export const ACTION_COLORS: Record<ActivityItem['action'], string> = {
    summarize: '#22d3ee',      // cyan-400
    draft: '#a78bfa',          // violet-400
    enhance: '#4ade80',        // green-400
    rag_query: '#fbbf24',      // amber-400
    digest: '#f472b6',         // pink-400
    thread_summary: '#38bdf8', // sky-400
    autocomplete: '#94a3b8',   // slate-400
};
