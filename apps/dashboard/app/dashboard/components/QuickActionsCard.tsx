'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Mail,
    Search,
    BarChart3,
    Settings,
    ExternalLink
} from 'lucide-react';

interface QuickAction {
    label: string;
    description: string;
    icon: React.ElementType;
    variant: 'primary' | 'outline';
    action: () => void;
}

export function QuickActionsCard() {
    const quickActions: QuickAction[] = [
        {
            label: "Get Today's Digest",
            description: 'AI summary of your inbox',
            icon: Mail,
            variant: 'primary',
            action: () => {
                // Open extension or trigger digest
                window.open('chrome-extension://your-extension-id/popup.html', '_blank');
            },
        },
        {
            label: 'Ask Your Inbox',
            description: 'Search with AI',
            icon: Search,
            variant: 'outline',
            action: () => {
                // Open extension RAG feature
                window.open('chrome-extension://your-extension-id/popup.html', '_blank');
            },
        },
        {
            label: 'View Analytics',
            description: 'Detailed insights',
            icon: BarChart3,
            variant: 'outline',
            action: () => {
                // This would navigate to analytics view - handled by parent
                console.log('Navigate to analytics');
            },
        },
        {
            label: 'Open Settings',
            description: 'Configure preferences',
            icon: Settings,
            variant: 'outline',
            action: () => {
                // This would navigate to settings view - handled by parent
                console.log('Navigate to settings');
            },
        },
    ];

    return (
        <Card className="bg-card/50 backdrop-blur-sm border-border h-full relative overflow-hidden">
            {/* Corner accents for visual detail */}
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/20" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary/20" />

            <CardHeader className="pb-3">
                <CardTitle className="text-card-foreground flex items-center gap-2">
                    ⚡ Quick Actions
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    Common tasks at your fingertips
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0">
                {quickActions.map((action) => {
                    const Icon = action.icon;
                    const isPrimary = action.variant === 'primary';

                    return (
                        <Button
                            key={action.label}
                            onClick={action.action}
                            className={
                                isPrimary
                                    ? 'w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground rounded-none relative group overflow-hidden'
                                    : 'w-full justify-start border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-none hover:border-l-primary hover:border-l-4 transition-all duration-200'
                            }
                            variant={isPrimary ? 'default' : 'outline'}
                        >
                            {isPrimary && (
                                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                            )}
                            <Icon className="mr-2 h-4 w-4" />
                            <span className="flex-1 text-left">{action.label}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </Button>
                    );
                })}
            </CardContent>
        </Card>
    );
}
