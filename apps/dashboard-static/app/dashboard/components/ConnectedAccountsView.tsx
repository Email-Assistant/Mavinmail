"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Mail, Loader2 } from "lucide-react"
import { getConnectedAccounts, getGoogleUrl, disconnectGoogle, type ConnectedAccount } from "@/lib/api"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function ConnectedAccountsView() {
    const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string>("")
    const [connectingAccountId, setConnectingAccountId] = useState<number | null>(null)
    const [disconnectingAccountId, setDisconnectingAccountId] = useState<number | null>(null)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const searchParams = useSearchParams()

    // Helper to format last sync time
    const formatLastSync = useCallback((lastSync?: string): string => {
        if (!lastSync) return "Never"
        try {
            const date = new Date(lastSync)
            const now = new Date()
            const diffMs = now.getTime() - date.getTime()
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMs / 3600000)
            const diffDays = Math.floor(diffMs / 86400000)

            if (diffMins < 1) return "Just now"
            if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "min" : "mins"} ago`
            if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`
            return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`
        } catch {
            return "Unknown"
        }
    }, [])

    // Fetch accounts from backend
    const fetchAccounts = useCallback(async () => {
        setIsLoading(true)
        setError("")
        try {
            const fetchedAccounts = await getConnectedAccounts()
            // Transform backend response to match component needs
            const transformedAccounts = fetchedAccounts.map(acc => ({
                ...acc,
                lastSync: formatLastSync(acc.lastSync),
            }))
            setAccounts(transformedAccounts)
        } catch (err: any) {
            console.error("Failed to fetch accounts:", err)
            setError(err.message || "Failed to load connected accounts")
        } finally {
            setIsLoading(false)
        }
    }, [formatLastSync])

    // Handle OAuth callback redirect
    useEffect(() => {
        const success = searchParams.get("success")
        const authError = searchParams.get("error")

        if (success === "gmail_connected") {
            // Refresh accounts after successful connection
            fetchAccounts()
            // Clean URL
            if (typeof window !== "undefined") {
                window.history.replaceState(null, "", "/dashboard")
            }
        } else if (authError) {
            setError("Failed to connect Gmail account. Please try again.")
            if (typeof window !== "undefined") {
                window.history.replaceState(null, "", "/dashboard")
            }
        } else {
            // Initial load
            fetchAccounts()
        }
    }, [searchParams, fetchAccounts])

    // Handle Gmail connection
    const handleConnectGmail = async () => {
        setError("")
        setConnectingAccountId(0) // Using 0 as a flag for "adding new account"
        try {
            const googleAuthUrl = await getGoogleUrl()
            // Redirect to Google OAuth
            window.location.href = googleAuthUrl
        } catch (err: any) {
            setError(err.message || "Failed to initiate Gmail connection")
            setConnectingAccountId(null)
        }
    }

    // Handle account disconnect
    const handleDisconnect = async (accountId: number, provider: string) => {
        if (!window.confirm("Are you sure you want to disconnect this account?")) {
            return
        }

        setError("")
        setDisconnectingAccountId(accountId)
        try {
            // Backend currently only supports disconnecting Google account
            // For now, always call without accountId to use the /connections/google endpoint
            // TODO: Update backend to support disconnecting by accountId when multiple accounts are supported
            await disconnectGoogle()
            // Refresh accounts list
            await fetchAccounts()
        } catch (err: any) {
            setError(err.message || "Failed to disconnect account")
        } finally {
            setDisconnectingAccountId(null)
        }
    }

    // Handle refresh/sync
    const handleRefresh = async (accountId: number) => {
        setError("")
        try {
            // TODO: Implement sync endpoint call when backend adds it
            // For now, just refetch accounts
            await fetchAccounts()
        } catch (err: any) {
            setError(err.message || "Failed to refresh account")
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Connected Accounts</h2>
                    <p className="text-muted-foreground">Manage your linked email accounts and data sources.</p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Plus className="mr-2 h-4 w-4" /> Add Account
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle id="connect-account-title">Connect Email Account</DialogTitle>
                            <DialogDescription id="connect-account-description">
                                Choose an email provider to connect your account.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4" role="group" aria-labelledby="connect-account-title" aria-describedby="connect-account-description">
                            <Button
                                onClick={handleConnectGmail}
                                disabled={connectingAccountId !== null}
                                className="w-full justify-start"
                                variant="outline"
                            >
                                {connectingAccountId === 0 ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Connect Gmail
                                    </>
                                )}
                            </Button>
                            {/* Future: Add more providers here (Outlook, IMAP, etc.) */}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading accounts...</span>
                </div>
            ) : accounts.length === 0 ? (
                <Card className="bg-card border-border">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No connected accounts</h3>
                        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                            Connect your first email account to get started with AI-powered email management.
                        </p>
                        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                            <Plus className="mr-2 h-4 w-4" /> Add Your First Account
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {accounts.map((account) => {
                        const isDisconnecting = disconnectingAccountId === account.id
                        const statusMap: Record<string, 'Active' | 'Re-auth Needed' | 'Error'> = {
                            active: 'Active',
                            're-auth needed': 'Re-auth Needed',
                            error: 'Error',
                        }
                        const normalizedStatus = account.status || 'Active'
                        const isActive = normalizedStatus.toLowerCase() === 'active'

                        return (
                            <Card key={account.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                                <CardContent className="flex items-center justify-between p-6">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-3 rounded-full bg-muted text-muted-foreground">
                                            <Mail className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2">
                                                <h3 className="text-lg font-medium text-foreground">{account.provider}</h3>
                                                {isActive ? (
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                                        <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                                                        <AlertTriangle className="mr-1 h-3 w-3" /> {normalizedStatus}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{account.email}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-4">
                                        <div className="text-right hidden sm:block">
                                            <p className="text-xs text-muted-foreground">Last synced</p>
                                            <p className="text-sm text-foreground/80">
                                                {account.lastSync || "Never"}
                                            </p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {!isActive && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
                                                    onClick={() => handleConnectGmail()}
                                                    disabled={connectingAccountId !== null}
                                                >
                                                    {connectingAccountId === account.id ? (
                                                        <>
                                                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                            Reconnecting...
                                                        </>
                                                    ) : (
                                                        "Re-connect"
                                                    )}
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-primary"
                                                onClick={() => handleRefresh(account.id)}
                                                title="Refresh sync"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => handleDisconnect(account.id, account.provider)}
                                                disabled={isDisconnecting}
                                                title="Disconnect account"
                                            >
                                                {isDisconnecting ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
