'use client';

import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, LogOut } from 'lucide-react';
import { useDashboard, formatRelativeTime } from '@/lib/hooks/useDashboard';
import { HeroMetrics } from './HeroMetrics';
import { ActivityChart } from './ActivityChart';
import { RecentActivityFeed } from './RecentActivityFeed';
import { QuickActionsCard } from './QuickActionsCard';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

export function DashboardView() {
    const { data, isLoading, error, refresh, lastUpdated } = useDashboard();

    const handleLogout = () => {
        signOut({ callbackUrl: '/login' });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        Welcome back, {data.userName}
                    </h2>
                    <p className="text-muted-foreground">
                        Here's what your AI assistant has been doing.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-muted-foreground">
                            Updated {formatRelativeTime(lastUpdated.toISOString())}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="text-muted-foreground hover:text-destructive"
                    >
                        <LogOut className="h-4 w-4 mr-2" />
                        Log out
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={isLoading}
                        className="border-border text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div className="flex-1">
                        <p className="text-sm font-medium">Failed to load dashboard data</p>
                        <p className="text-xs opacity-80">{error}</p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                        Retry
                    </Button>
                </div>
            )}

            {/* Hero Metrics - 8 Cards in 2 Rows */}
            <HeroMetrics stats={data.stats} isLoading={isLoading} />

            {/* Activity Chart - Full Width */}
            <ActivityChart trends={data.trends} isLoading={isLoading} />

            {/* Bottom Section - Activity Feed + Quick Actions */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="lg:col-span-4">
                    <RecentActivityFeed activities={data.activities} isLoading={isLoading} />
                </div>
                <div className="lg:col-span-3">
                    <QuickActionsCard />
                </div>
            </div>
        </div>
    );
}
