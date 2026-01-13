"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export function SettingsView() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
                <p className="text-muted-foreground">Manage your preferences and AI behavior.</p>
            </div>

            <div className="grid gap-6">
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">AI Behavior</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Configure how the AI interacts with your emails.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="auto-reply" className="text-foreground">Auto-reply</Label>
                                <p className="text-sm text-muted-foreground">Automatically reply to emails marked as 'Urgent' if I'm away.</p>
                            </div>
                            <Switch id="auto-reply" />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="draft-mode" className="text-foreground">Draft Mode</Label>
                                <p className="text-sm text-muted-foreground">Only draft responses, never send without approval.</p>
                            </div>
                            <Switch id="draft-mode" defaultChecked />
                        </div>
                        <Separator className="bg-border" />
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="smart-summary" className="text-foreground">Smart Summary</Label>
                                <p className="text-sm text-muted-foreground">Generate a daily summary of all incoming emails.</p>
                            </div>
                            <Switch id="smart-summary" defaultChecked />
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Notifications</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Control when and how you receive alerts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="space-y-0.5">
                                <Label htmlFor="email-alerts" className="text-foreground">Email Alerts</Label>
                                <p className="text-sm text-muted-foreground">Receive a weekly digest via email.</p>
                            </div>
                            <Switch id="email-alerts" defaultChecked />
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Changes</Button>
                </div>
            </div>
        </div>
    )
}
