"use client"

import React from "react"

export function DitherBackground() {
    return (
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#111]">
            {/* Base Gradient */}
            <div
                className="absolute inset-0 opacity-40"
                style={{
                    background: `
            radial-gradient(circle at 15% 50%, rgba(76, 29, 149, 0.4), transparent 25%),
            radial-gradient(circle at 85% 30%, rgba(29, 78, 216, 0.4), transparent 25%)
          `
                }}
            />

            {/* Clean Background - Removed Dotted Pattern */}
            <div className="absolute inset-0" />

            {/* Noise Overlay for texture */}
            <div
                className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />
        </div>
    )
}
