"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopNav } from "@/components/layout/TopNav"
import { DashboardView } from "./components/DashboardView"
import { ConnectedAccountsView } from "./components/ConnectedAccountsView"
import { SettingsView } from "./components/SettingsView"
import { ProfileView } from "./components/ProfileView"
import { SubscriptionView } from "./components/SubscriptionView"
import { SupportView } from "./components/SupportView"
import { AnalyticsView } from "./components/AnalyticsView"

/** Internal component that uses useSearchParams */
function DashboardPageContent() {
    const searchParams = useSearchParams()
    const [activeView, setActiveView] = React.useState("dashboard")
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false)

    // Handle OAuth callback redirect - automatically show accounts view
    React.useEffect(() => {
        const success = searchParams.get("success")
        const error = searchParams.get("error")
        if (success === "gmail_connected" || error) {
            setActiveView("accounts")
        }
    }, [searchParams])

    const renderView = () => {
        switch (activeView) {
            case "dashboard":
                return <DashboardView />
            case "analytics":
                return <AnalyticsView />
            case "accounts":
                return <ConnectedAccountsView />
            case "settings":
                return <SettingsView />
            case "profile":
                return <ProfileView />
            case "subscription":
                return <SubscriptionView />
            case "support":
                return <SupportView />
            default:
                return <DashboardView />
        }
    }

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
            <Sidebar
                className="hidden md:flex"
                activeView={activeView}
                onViewChange={setActiveView}
                isCollapsed={isSidebarCollapsed}
                toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <TopNav activeView={activeView} onViewChange={setActiveView} />

                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
                    <div className="max-w-7xl mx-auto w-full">
                        {renderView()}
                    </div>
                </main>
            </div>
        </div>
    )
}

/** Loading fallback for Suspense */
function DashboardLoading() {
    return (
        <div className="flex h-screen bg-background text-foreground items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20" />
                <div className="h-4 w-32 rounded bg-muted" />
            </div>
        </div>
    )
}

/** Main export wrapped in Suspense for useSearchParams */
export default function DashboardPage() {
    return (
        <Suspense fallback={<DashboardLoading />}>
            <DashboardPageContent />
        </Suspense>
    )
}
