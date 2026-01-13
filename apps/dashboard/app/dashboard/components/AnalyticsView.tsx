'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from 'recharts';
import { getUsageTrends, getDashboardStats } from '@/lib/api';
import type { UsageTrend, DashboardStats } from '@/lib/types';
import { ACTION_COLORS } from '@/lib/types';
import { formatTimeSaved } from '@/lib/hooks/useDashboard';
import { RefreshCw, TrendingUp, PieChartIcon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type TimeRange = '7d' | '30d';

export function AnalyticsView() {
    const [timeRange, setTimeRange] = useState<TimeRange>('7d');
    const [trends, setTrends] = useState<UsageTrend[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const days = timeRange === '7d' ? 7 : 30;
            const [trendsData, statsData] = await Promise.all([
                getUsageTrends(days),
                getDashboardStats(),
            ]);
            setTrends(trendsData);
            setStats(statsData);
            setIsLoading(false);
        };
        fetchData();
    }, [timeRange]);

    // Prepare data for pie chart
    const pieData = stats ? [
        { name: 'Summaries', value: stats.threadsSummarized, color: ACTION_COLORS.summarize },
        { name: 'Drafts', value: stats.draftsGenerated, color: ACTION_COLORS.draft },
        { name: 'Enhanced', value: stats.textEnhancements, color: ACTION_COLORS.enhance },
        { name: 'RAG Queries', value: stats.questionsAnswered, color: ACTION_COLORS.rag_query },
    ] : [];

    // Prepare data for line chart
    const lineData = trends.map((t) => ({
        name: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        Total: t.total,
    }));

    // Prepare weekly time saved data (mock for now)
    const timeSavedData = Array.from({ length: 4 }, (_, i) => ({
        week: `Week ${i + 1}`,
        hours: Math.floor(Math.random() * 15) + 5,
    }));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">
                        📊 Analytics
                    </h2>
                    <p className="text-muted-foreground">
                        Detailed insights into your AI assistant usage
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        <Button
                            variant={timeRange === '7d' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setTimeRange('7d')}
                            className="rounded-none"
                        >
                            7 Days
                        </Button>
                        <Button
                            variant={timeRange === '30d' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setTimeRange('30d')}
                            className="rounded-none"
                        >
                            30 Days
                        </Button>
                    </div>
                </div>
            </div>

            {/* Usage Over Time - Line Chart */}
            <Card className="bg-card/50 backdrop-blur-sm border-border">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Usage Over Time
                    </CardTitle>
                    <CardDescription>Daily AI interactions</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center">
                                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={lineData}>
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                        axisLine={{ stroke: 'var(--border)' }}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                        }}
                                        labelStyle={{ color: 'var(--foreground)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="Total"
                                        stroke="#22d3ee"
                                        strokeWidth={2}
                                        dot={{ fill: '#22d3ee', r: 4 }}
                                        activeDot={{ r: 6, fill: '#22d3ee' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Bottom Row - Pie Chart + Time Saved */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Feature Breakdown Pie Chart */}
                <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PieChartIcon className="h-5 w-5 text-primary" />
                            Feature Breakdown
                        </CardTitle>
                        <CardDescription>Usage distribution by feature</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            label={({ name, percent }) =>
                                                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                                            }
                                            labelLine={{ stroke: 'var(--muted-foreground)' }}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--card)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Time Saved Chart */}
                <Card className="bg-card/50 backdrop-blur-sm border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Time Saved
                        </CardTitle>
                        <CardDescription>
                            Total: {stats ? formatTimeSaved(stats.timeSavedMinutes) : '0m'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[280px]">
                            {isLoading ? (
                                <div className="h-full flex items-center justify-center">
                                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={timeSavedData}>
                                        <XAxis
                                            dataKey="week"
                                            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                            axisLine={{ stroke: 'var(--border)' }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                                            axisLine={{ stroke: 'var(--border)' }}
                                            tickLine={false}
                                            label={{
                                                value: 'Hours',
                                                angle: -90,
                                                position: 'insideLeft',
                                                style: { fill: 'var(--muted-foreground)' }
                                            }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--card)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '8px',
                                            }}
                                            formatter={(value) => [`${value}h`, 'Time Saved']}
                                        />
                                        <Bar
                                            dataKey="hours"
                                            fill="#22d3ee"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
