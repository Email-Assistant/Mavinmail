"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Check } from "lucide-react"

export function SubscriptionView() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Subscription</h2>
                <p className="text-muted-foreground">Manage your plan and billing details.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-card border-border border-l-4 border-l-primary">
                    <CardHeader>
                        <CardTitle className="text-foreground">Current Plan: Pro</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            You are currently on the Pro plan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Monthly AI Actions</span>
                                <span className="text-primary font-medium">1,203 / 5,000</span>
                            </div>
                            <Progress value={24} className="h-2 bg-muted" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Storage Used</span>
                                <span className="text-primary font-medium">2.1 GB / 10 GB</span>
                            </div>
                            <Progress value={21} className="h-2 bg-muted" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button variant="outline" className="w-full border-border text-muted-foreground hover:bg-accent hover:text-primary">
                            Manage Billing
                        </Button>
                    </CardFooter>
                </Card>

                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="text-foreground">Upgrade to Enterprise</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Get more power and features.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center">
                                <Check className="mr-2 h-4 w-4 text-primary" /> Unlimited AI Actions
                            </li>
                            <li className="flex items-center">
                                <Check className="mr-2 h-4 w-4 text-primary" /> Dedicated Support
                            </li>
                            <li className="flex items-center">
                                <Check className="mr-2 h-4 w-4 text-primary" /> Custom Integrations
                            </li>
                            <li className="flex items-center">
                                <Check className="mr-2 h-4 w-4 text-primary" /> Advanced Analytics
                            </li>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                            Upgrade Now
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
