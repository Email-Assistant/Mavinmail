import { z } from 'zod';

/**
 * Environment variable validation schema.
 * Validates all required env vars at startup — the server will fail fast
 * with a clear error message if any required variable is missing or invalid.
 *
 * This prevents cryptic runtime crashes like "Cannot read property of undefined"
 * deep inside a request handler.
 */
const envSchema = z.object({
    // ─── Server ────────────────────────────────────────
    PORT: z.string().default('5001'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // ─── Database ──────────────────────────────────────
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // ─── Authentication ────────────────────────────────
    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    ENCRYPTION_SECRET: z.string().min(16, 'ENCRYPTION_SECRET must be at least 16 characters'),

    // ─── Google OAuth ──────────────────────────────────
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
    GOOGLE_CALLBACK_URL: z.string().min(1, 'GOOGLE_CALLBACK_URL is required'),
    GOOGLE_REDIRECT_URI: z.string().optional(),

    // ─── AI Services ───────────────────────────────────
    OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
    COHERE_API_KEY: z.string().min(1, 'COHERE_API_KEY is required'),
    PINECONE_API_KEY: z.string().min(1, 'PINECONE_API_KEY is required'),

    // ─── Optional ──────────────────────────────────────
    DEFAULT_AI_MODEL: z.string().optional(),
    FALLBACK_AI_MODEL: z.string().optional(),
    DASHBOARD_URL: z.string().optional(),
    REDIS_URL: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        const flattened = result.error.flatten();
        for (const [key, errors] of Object.entries(flattened.fieldErrors)) {
            console.error(`  ${key}: ${(errors as string[]).join(', ')}`);
        }
        process.exit(1);
    }

    return result.data;
}

/**
 * Validated environment variables.
 * Import this instead of using `process.env` directly for type safety.
 * 
 * Usage:
 * ```ts
 * import { env } from '../config/env.js';
 * const port = env.PORT; // string, guaranteed to exist
 * ```
 */
export const env = validateEnv();
