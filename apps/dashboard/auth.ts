import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { User } from "next-auth"

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.AUTH_SECRET,
    providers: [
        Credentials({
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                try {
                    if (!credentials?.email || !credentials?.password) {
                        return null;
                    }

                    // Call existing backend API
                    const res = await fetch("http://localhost:5001/api/auth/login", {
                        method: "POST",
                        body: JSON.stringify({
                            email: credentials.email,
                            password: credentials.password,
                        }),
                        headers: { "Content-Type": "application/json" },
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.error || "Login failed");
                    }

                    if (res.ok && data.user) {
                        // Return object that will be saved in the JWT
                        return {
                            id: data.user.id.toString(), // NextAuth expects string IDs
                            email: data.user.email,
                            name: data.user.name,
                            token: data.token, // We need to persist this token
                            ...data.user
                        } as User;
                    }

                    return null;
                } catch (error) {
                    console.error("Auth Error:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn) {
                // Redirect user to dashboard if they are already logged in and trying to access login/signup
                const isOnAuthPage = nextUrl.pathname === '/login' || nextUrl.pathname === '/signup' || nextUrl.pathname === '/';
                if (isOnAuthPage) {
                    return Response.redirect(new URL('/dashboard', nextUrl));
                }
            }
            return true;
        },
        async jwt({ token, user }: { token: any, user: any }) {
            if (user) {
                token.accessToken = user.token;
                token.userId = user.id;
            }
            return token;
        },
        async session({ session, token }: { session: any, token: any }) {
            if (token) {
                session.accessToken = token.accessToken;
                session.user.id = token.userId;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    session: {
        strategy: "jwt",
    },
})
