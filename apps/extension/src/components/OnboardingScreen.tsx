import { useState } from 'react';

interface OnboardingScreenProps {
    login: (credentials: { email: string; password: string }) => Promise<void>;
}

export default function OnboardingScreen({ login }: OnboardingScreenProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;

        setError('');
        setLoading(true);

        try {
            await login({ email, password });
            // App.tsx will handle the state change based on token presence
        } catch (err: any) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#0A0A0A] text-white overflow-hidden relative selection:bg-[#22d3ee] selection:text-black font-sans">

            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#22d3ee]/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#3b82f6]/5 blur-[120px] rounded-full pointer-events-none" />

            {/* Main Content Container */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-sm mx-auto">

                {/* Logo & Header */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="w-16 h-16 mb-6 rounded-2xl bg-gradient-to-tr from-[#171717] to-[#262626] border border-[#333] flex items-center justify-center shadow-2xl shadow-black/50 overflow-hidden">
                        <img src="/logo.png" alt="Mavin Logo" className="w-full h-full object-cover" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
                        Welcome to Mavin
                    </h1>
                    <p className="text-gray-400 text-sm leading-relaxed max-w-[260px]">
                        Your intelligent email assistant. <br /> Sign in to start your productive day.
                    </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">

                    <div className="space-y-4">
                        <div className="relative group">
                            <input
                                id="email"
                                type="email"
                                placeholder="Email address"
                                className="w-full px-4 py-3 bg-[#121212] border border-[#262626] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee] transition-all group-hover:border-[#333]"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="relative group">
                            <input
                                id="password"
                                type="password"
                                placeholder="Password"
                                className="w-full px-4 py-3 bg-[#121212] border border-[#262626] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#22d3ee] focus:ring-1 focus:ring-[#22d3ee] transition-all group-hover:border-[#333]"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-red-400 text-xs text-center font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all transform active:scale-[0.98]
              ${loading
                                ? 'bg-[#1a1a1a] text-gray-500 cursor-not-allowed border border-[#333]'
                                : 'bg-[#22d3ee] text-black hover:bg-[#1bbccf] hover:shadow-[0_0_20px_-5px_#22d3ee]'
                            }
            `}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* Footer Link */}
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-500">
                        Don't have an account?{' '}
                        <a
                            href="#"
                            className="text-gray-400 hover:text-[#22d3ee] transition-colors underline decoration-dotted decoration-gray-600 hover:decoration-[#22d3ee]"
                            onClick={(e) => {
                                e.preventDefault();
                                // Handle signup click or link to website
                                window.open('https://mavin.mail/signup', '_blank');
                            }}
                        >
                            Get started
                        </a>
                    </p>
                </div>
            </div>

            {/* Footer Branding */}
            <div className="absolute bottom-4 w-full text-center">
                <p className="text-[10px] text-gray-600 font-medium tracking-wider uppercase opacity-50">Powered by Mavin AI</p>
            </div>
        </div>
    );
}
