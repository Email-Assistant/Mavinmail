import React from 'react'
import { DitherBackground } from "@/components/ui/dither-background"
import { cn } from "@/lib/utils"

interface AuthLayoutProps {
    children: React.ReactNode
    heading: string
    subheading: string
    quote?: string
}

export function AuthLayout({ children, heading, subheading, quote }: AuthLayoutProps) {
    return (
        <div className="flex min-h-screen w-full bg-[#111] text-cyan-400 overflow-hidden font-sans">
            <DitherBackground />
            <div className="flex w-full h-screen z-10">
                {/* Left Side: Cinematic Story */}
                <div className="hidden lg:flex w-[55%] relative flex-col justify-between p-12 overflow-hidden">
                    {/* Background Image Container */}
                    <div
                        className="absolute inset-0 z-0 bg-cover bg-center opacity-60 mix-blend-overlay"
                        style={{ backgroundImage: 'url(/background_cinematic_dither.png)' }}
                    />
                    {/* Gradient Overlay for readibility */}
                    <div className="absolute inset-0 z-10 bg-gradient-to-tr from-black/80 via-transparent to-transparent" />
                    {/* Top Brand */}
                    <div className="relative z-20 flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10">
                            <span className="text-white font-bold text-sm">M</span>
                        </div>
                        <span className="text-xl font-medium tracking-tight text-white/90">MavinMail</span>
                    </div>
                    {/* Bottom Quote/Story */}
                    <div className="relative z-20 max-w-lg">
                        <blockquote className="text-2xl font-light leading-relaxed text-white/90 tracking-wide">
                            {quote || `\"Email wasn’t meant to be overwhelming. This is where clarity begins.\"`}
                        </blockquote>
                    </div>
                </div>

                {/* Right Side: Form Container */}
                <div className="w-full lg:w-[45%] h-full flex flex-col items-center justify-start p-6 relative overflow-y-auto no-scrollbar">
                    {/* Mobile Brand (Visible only when sidebar is hidden) */}
                    <div className="lg:hidden absolute top-6 left-6 flex items-center gap-3 z-50">
                        <div className="w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10">
                            <span className="text-white font-bold text-sm">M</span>
                        </div>
                        <span className="text-xl font-medium tracking-tight text-white/90">MavinMail</span>
                    </div>

                    <div className="w-full max-w-[420px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 my-auto py-12">
                        <div className="space-y-2 text-center lg:text-left">
                            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-white">
                                {heading}
                            </h1>
                            <p className="text-white/50 text-base font-light">
                                {subheading}
                            </p>
                        </div>

                        {/* Form Content - Simple Square Design */}
                        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl">
                            {children}
                        </div>

                        <p className="text-center text-xs text-cyan-400 font-mono uppercase tracking-widest mt-8">
                            Your data stays private. Always.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
