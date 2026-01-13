'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from 'recharts';
import type { UsageTrend } from '@/lib/types';
import { ACTION_COLORS } from '@/lib/types';

interface ActivityChartProps {
    trends: UsageTrend[];
    isLoading: boolean;
}

// Custom tooltip component for better styling
function CustomTooltip({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}) {
    if (!active || !payload) return null;

    return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
            <p className="text-sm font-medium text-foreground mb-2">{label}</p>
            <div className="space-y-1">
                {payload.map((entry) => (
                    <div key={entry.name} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground capitalize">{entry.name}</span>
                        <span className="text-xs font-medium" style={{ color: entry.color }}>
                            {entry.value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function SkeletonChart() {
    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                    <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] flex items-end justify-around gap-2 px-4">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-muted rounded-t animate-pulse"
                            style={{
                                width: '40px',
                                height: `${((i * 37) % 150) + 50}px`,
                            }}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

export function ActivityChart({ trends, isLoading }: ActivityChartProps) {
    if (isLoading) {
        return <SkeletonChart />;
    }

    // Transform data for recharts - handle both backend breakdown format and flat format
    const chartData = trends.map((trend) => {
        // Backend returns breakdown as object, mock data has flat properties
        const breakdown = trend.breakdown;
        return {
            name: formatDate(trend.date),
            Summaries: breakdown?.summarize ?? trend.summarize ?? 0,
            Drafts: breakdown?.draft ?? trend.draft ?? 0,
            Enhance: breakdown?.enhance ?? trend.enhance ?? 0,
            'RAG Queries': breakdown?.rag ?? trend.rag ?? 0,
        };
    });

    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
                <CardTitle className="text-card-foreground flex items-center gap-2">
                    📊 Activity This Week
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barCategoryGap="20%">
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
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
                            <Legend
                                wrapperStyle={{ paddingTop: '10px' }}
                                formatter={(value) => (
                                    <span className="text-xs text-muted-foreground">{value}</span>
                                )}
                            />
                            <Bar
                                dataKey="Summaries"
                                stackId="a"
                                fill={ACTION_COLORS.summarize}
                                radius={[0, 0, 0, 0]}
                            />
                            <Bar
                                dataKey="Drafts"
                                stackId="a"
                                fill={ACTION_COLORS.draft}
                                radius={[0, 0, 0, 0]}
                            />
                            <Bar
                                dataKey="Enhance"
                                stackId="a"
                                fill={ACTION_COLORS.enhance}
                                radius={[0, 0, 0, 0]}
                            />
                            <Bar
                                dataKey="RAG Queries"
                                stackId="a"
                                fill={ACTION_COLORS.rag_query}
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
