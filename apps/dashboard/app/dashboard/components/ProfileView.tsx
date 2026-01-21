"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { getUserProfile, updateUserProfile, type UserProfile } from "@/lib/api"

export function ProfileView() {
    const [profile, setProfile] = useState<UserProfile>({
        firstName: '',
        lastName: '',
        email: ''
    })
    const [originalEmail, setOriginalEmail] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [errorMessage, setErrorMessage] = useState('')

    // Password for email change
    const [showPasswordField, setShowPasswordField] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    useEffect(() => {
        loadProfile()
    }, [])

    // Check if email has changed to show password field
    useEffect(() => {
        const emailChanged = profile.email !== originalEmail && originalEmail !== ''
        setShowPasswordField(emailChanged)
        if (!emailChanged) {
            setCurrentPassword('')
        }
    }, [profile.email, originalEmail])

    const loadProfile = async () => {
        try {
            setIsLoading(true)
            const data = await getUserProfile()
            setProfile(data)
            setOriginalEmail(data.email)
        } catch (error) {
            console.error('Failed to load profile:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setIsSaving(true)
            setSaveStatus('idle')
            setErrorMessage('')

            const updateData: any = {
                firstName: profile.firstName,
                lastName: profile.lastName,
            }

            // Only include email if it changed
            if (profile.email !== originalEmail) {
                updateData.email = profile.email
                updateData.currentPassword = currentPassword
            }

            const result = await updateUserProfile(updateData)

            if (result.success) {
                setSaveStatus('success')
                setOriginalEmail(profile.email)
                setShowPasswordField(false)
                setCurrentPassword('')
                setTimeout(() => setSaveStatus('idle'), 3000)
            } else {
                setSaveStatus('error')
                setErrorMessage(result.error || 'Failed to update profile')
            }
        } catch (error: any) {
            setSaveStatus('error')
            setErrorMessage(error.message || 'Failed to update profile')
        } finally {
            setIsSaving(false)
        }
    }

    const getInitials = () => {
        const first = profile.firstName?.[0]?.toUpperCase() || ''
        const last = profile.lastName?.[0]?.toUpperCase() || ''
        return first + last || profile.email?.[0]?.toUpperCase() || 'U'
    }

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile</h2>
                    <p className="text-muted-foreground">Manage your personal information.</p>
                </div>
                <Card className="bg-card border-border md:col-span-2">
                    <CardContent className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </CardContent>
                </Card>
            </div>
        )
    }

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
                        {/* Avatar */}
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20 border-2 border-border">
                                <AvatarImage src="/avatars/01.png" alt="@user" />
                                <AvatarFallback className="bg-muted text-primary text-xl">{getInitials()}</AvatarFallback>
                            </Avatar>
                            <Button variant="outline" className="border-border text-muted-foreground hover:bg-accent hover:text-primary">
                                Change Avatar
                            </Button>
                        </div>

                        {/* Name Fields */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="first-name" className="text-foreground">First name</Label>
                                <Input
                                    id="first-name"
                                    placeholder="John"
                                    value={profile.firstName}
                                    onChange={(e) => setProfile(prev => ({ ...prev, firstName: e.target.value }))}
                                    className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="last-name" className="text-foreground">Last name</Label>
                                <Input
                                    id="last-name"
                                    placeholder="Doe"
                                    value={profile.lastName}
                                    onChange={(e) => setProfile(prev => ({ ...prev, lastName: e.target.value }))}
                                    className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50"
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john.doe@example.com"
                                value={profile.email}
                                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                                className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50"
                            />
                            {showPasswordField && (
                                <p className="text-xs text-amber-500">
                                    Email change requires password verification
                                </p>
                            )}
                        </div>

                        {/* Password Field (shown when email changes) */}
                        {showPasswordField && (
                            <div className="space-y-2 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                <Label htmlFor="current-password" className="text-foreground">
                                    Current Password <span className="text-red-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="current-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your current password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="bg-muted/50 border-input text-foreground focus-visible:ring-primary/50 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Required to verify email change for security
                                </p>
                            </div>
                        )}

                        {/* Error Message */}
                        {saveStatus === 'error' && (
                            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                                <AlertCircle className="h-4 w-4" />
                                {errorMessage}
                            </div>
                        )}

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || (showPasswordField && !currentPassword)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[140px]"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : saveStatus === 'success' ? (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Saved!
                                    </>
                                ) : (
                                    'Save Profile'
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
