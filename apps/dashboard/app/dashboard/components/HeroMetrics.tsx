'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Mail,
    FileText,
    Search,
    Clock,
    Edit3,
    MessageSquare,
    Sparkles,
    Link2
} from 'lucide-react';
import type { DashboardStats } from '@/lib/types';
import { formatTimeSaved } from '@/lib/hooks/useDashboard';
import { cn } from '@/lib/utils';

interface HeroMetricsProps {
    stats: DashboardStats | null;
    isLoading: boolean;
}

interface MetricCardData {
    key: keyof DashboardStats | 'timeSaved';
    title: string;
    icon: React.ElementType;
    color: string;
    borderColor: string;
    format?: (value: number) => string;
}

const METRIC_CARDS: MetricCardData[] = [
    {
        key: 'totalEmails',
        title: 'Total Emails',
        icon: Mail,
        color: 'text-cyan-400',
        borderColor: 'border-l-cyan-400',
    },
    {
        key: 'emailsToday',
        title: "Today's Emails",
        icon: FileText,
        color: 'text-blue-400',
        borderColor: 'border-l-blue-400',
    },
    {
        key: 'questionsAnswered',
        title: 'RAG Queries',
        icon: Search,
        color: 'text-amber-400',
        borderColor: 'border-l-amber-400',
    },
    {
        key: 'timeSaved',
        title: 'Time Saved',
        icon: Clock,
        color: 'text-purple-400',
        borderColor: 'border-l-purple-400',
        format: formatTimeSaved,
    },
    {
        key: 'draftsGenerated',
        title: 'Drafts Generated',
        icon: Edit3,
        color: 'text-violet-400',
        borderColor: 'border-l-violet-400',
    },
    {
        key: 'threadsSummarized',
        title: 'Summaries',
        icon: MessageSquare,
        color: 'text-emerald-400',
        borderColor: 'border-l-emerald-400',
    },
    {
        key: 'textEnhancements',
        title: 'Text Enhanced',
        icon: Sparkles,
        color: 'text-pink-400',
        borderColor: 'border-l-pink-400',
    },
    {
        key: 'connectedAccounts',
        title: 'Connected Accounts',
        icon: Link2,
        color: 'text-orange-400',
        borderColor: 'border-l-orange-400',
    },
];

function SkeletonCard() {
    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border border-l-2 border-l-muted animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
                <div className="h-8 w-16 bg-muted rounded mb-1" />
                <div className="h-3 w-20 bg-muted/50 rounded" />
            </CardContent>
        </Card>
    );
}

function MetricCard({
    metric,
    value,
    isLoading
}: {
    metric: MetricCardData;
    value: number;
    isLoading: boolean;
}) {
    const Icon = metric.icon;
    const displayValue = metric.format ? metric.format(value) : value.toLocaleString();

    if (isLoading) {
        return <SkeletonCard />;
    }

    return (
        <Card
            className={cn(
                'bg-card/50 backdrop-blur-sm border-border border-l-2 transition-all duration-200',
                'hover:border-primary/50 hover:bg-card/70',
                metric.borderColor
            )}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                </CardTitle>
                <Icon className={cn('h-4 w-4', metric.color)} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-card-foreground">
                    {displayValue}
                </div>
            </CardContent>
        </Card>
    );
}

export function HeroMetrics({ stats, isLoading }: HeroMetricsProps) {
    return (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {METRIC_CARDS.map((metric) => {
                let value = 0;
                if (stats) {
                    if (metric.key === 'timeSaved') {
                        value = stats.timeSavedMinutes;
                    } else {
                        value = stats[metric.key] as number;
                    }
                }

                return (
                    <MetricCard
                        key={metric.key}
                        metric={metric}
                        value={value}
                        isLoading={isLoading}
                    />
                );
            })}
        </div>
    );
}
