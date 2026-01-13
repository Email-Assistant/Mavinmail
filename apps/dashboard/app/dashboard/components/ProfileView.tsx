"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function ProfileView() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile</h2>
                <p className="text-muted-foreground">Manage your personal information.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-card border-border md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-foreground">Personal Information</CardTitle>
                        <CardDescription className="text-muted-foreground">
                            Update your photo and personal details here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20 border-2 border-border">
                                <AvatarImage src="/avatars/01.png" alt="@user" />
                                <AvatarFallback className="bg-muted text-primary text-xl">JD</AvatarFallback>
                            </Avatar>
                            <Button variant="outline" className="border-border text-muted-foreground hover:bg-accent hover:text-primary">
                                Change Avatar
                            </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="first-name" className="text-foreground">First name</Label>
                                <Input id="first-name" placeholder="John" className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last-name" className="text-foreground">Last name</Label>
                                <Input id="last-name" placeholder="Doe" className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground">Email</Label>
                            <Input id="email" type="email" placeholder="john.doe@example.com" className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="bio" className="text-foreground">Bio</Label>
                            <Input id="bio" placeholder="I'm a software engineer..." className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50" />
                        </div>

                        <div className="flex justify-end">
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Save Profile</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
