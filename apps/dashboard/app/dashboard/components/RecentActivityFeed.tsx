'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    FileText,
    Edit3,
    Sparkles,
    Search,
    Mail,
    CheckCircle2,
    XCircle,
    Zap,
    MessageSquare
} from 'lucide-react';
import type { ActivityItem } from '@/lib/types';
import { ACTION_LABELS } from '@/lib/types';
import { formatRelativeTime } from '@/lib/hooks/useDashboard';
import { cn } from '@/lib/utils';

interface RecentActivityFeedProps {
    activities: ActivityItem[];
    isLoading: boolean;
}

const ACTION_ICONS: Record<ActivityItem['action'], React.ElementType> = {
    summarize: FileText,
    draft: Edit3,
    enhance: Sparkles,
    rag_query: Search,
    digest: Mail,
    thread_summary: MessageSquare,
    autocomplete: Zap,
};

const ACTION_COLORS: Record<ActivityItem['action'], string> = {
    summarize: 'text-cyan-400 bg-cyan-400/10',
    draft: 'text-violet-400 bg-violet-400/10',
    enhance: 'text-green-400 bg-green-400/10',
    rag_query: 'text-amber-400 bg-amber-400/10',
    digest: 'text-pink-400 bg-pink-400/10',
    thread_summary: 'text-sky-400 bg-sky-400/10',
    autocomplete: 'text-slate-400 bg-slate-400/10',
};

function ActivityItemRow({ activity }: { activity: ActivityItem }) {
    const Icon = ACTION_ICONS[activity.action];
    const colorClasses = ACTION_COLORS[activity.action];

    return (
        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
            <div className={cn('p-2 rounded-lg shrink-0', colorClasses)}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                        {ACTION_LABELS[activity.action]}
                    </span>
                    {activity.success ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    ) : (
                        <XCircle className="h-3 w-3 text-destructive" />
                    )}
                </div>
                <p className="text-sm text-foreground truncate mt-0.5">
                    {activity.description}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                    {formatRelativeTime(activity.timestamp)}
                </p>
            </div>
        </div>
    );
}

function SkeletonActivityItem() {
    return (
        <div className="flex items-start gap-3 p-3 animate-pulse">
            <div className="h-8 w-8 bg-muted rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-4 w-full bg-muted/70 rounded" />
                <div className="h-3 w-16 bg-muted/50 rounded" />
            </div>
        </div>
    );
}

export function RecentActivityFeed({ activities, isLoading }: RecentActivityFeedProps) {
    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-card-foreground flex items-center gap-2">
                    🤖 Recent AI Activity
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Your assistant has been busy
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <ScrollArea className="h-[280px] pr-4">
                    <div className="space-y-1">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonActivityItem key={i} />
                            ))
                        ) : activities.length > 0 ? (
                            activities.map((activity) => (
                                <ActivityItemRow key={activity.id} activity={activity} />
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                                <Mail className="h-8 w-8 mb-2 opacity-50" />
                                <p className="text-sm">No recent activity</p>
                                <p className="text-xs">Start using the extension to see activity here</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
