'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    getDashboardStats,
    getActivityFeed,
    getUsageTrends,
    getUserProfile,
    getConnectedAccounts,
} from '@/lib/api';
import type {
    DashboardStats,
    ActivityItem,
    UsageTrend,
} from '@/lib/types';

/**
 * Dashboard data state
 */
interface DashboardData {
    stats: DashboardStats | null;
    activities: ActivityItem[];
    trends: UsageTrend[];
    userEmail: string;
    userName: string;
}

/**
 * Dashboard hook return type
 */
interface UseDashboardReturn {
    data: DashboardData;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    lastUpdated: Date | null;
}

/**
 * Custom hook for fetching and managing dashboard data
 * Handles loading states, errors, and provides refresh capability
 */
export function useDashboard(): UseDashboardReturn {
    const [data, setData] = useState<DashboardData>({
        stats: null,
        activities: [],
        trends: [],
        userEmail: '',
        userName: 'User',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Fetch all data in parallel for better performance
            const [stats, activities, trends, profile, accounts] = await Promise.all([
                getDashboardStats(),
                getActivityFeed(10),
                getUsageTrends(7),
                getUserProfile(),
                getConnectedAccounts(),
            ]);

            setData({
                stats: {
                    ...stats,
                    connectedAccounts: accounts.length,
                },
                activities,
                trends,
                userEmail: profile.email,
                userName: profile.name || profile.email.split('@')[0] || 'User',
            });
            setLastUpdated(new Date());
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
            setError(message);
            console.error('Dashboard data fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch data on mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return {
        data,
        isLoading,
        error,
        refresh: fetchData,
        lastUpdated,
    };
}

/**
 * Format minutes into human-readable time string
 */
export function formatTimeSaved(minutes: number): string {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format relative timestamp (e.g., "2h ago", "1d ago")
 */
export function formatRelativeTime(isoTimestamp: string): string {
    const date = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}
