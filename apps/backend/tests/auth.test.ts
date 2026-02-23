import request from 'supertest';
import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// Mock Prisma using unstable_mockModule for ESM support
// Must be called BEFORE importing modules that use it
jest.unstable_mockModule('../src/utils/prisma.js', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    },
}));

// Mock bcrypt and jwt
jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        hash: jest.fn(),
        compare: jest.fn(),
    },
}));
jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        sign: jest.fn(),
        verify: jest.fn(),
    },
}));

// Dynamic imports variables
let app: any;
let prisma: any;
let bcrypt: any;
let jwt: any;

describe('Auth Endpoints', () => {
    beforeAll(async () => {
        // Import modules AFTER mocking
        prisma = (await import('../src/utils/prisma.js')).default;
        bcrypt = (await import('bcryptjs')).default;
        jwt = (await import('jsonwebtoken')).default;
        app = (await import('../src/app.js')).default;
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/signup', () => {
        it('should create a new user and return token', async () => {
            // Mock user check (doesn't exist)
            (prisma.user.findUnique as any).mockResolvedValue(null);
            // Mock password hash
            (bcrypt.hash as any).mockResolvedValue('hashed_password');
            // Mock user creation
            (prisma.user.create as any).mockResolvedValue({
                id: 1,
                email: 'test@example.com',
                role: 'user',
            });
            // Mock token generation
            (jwt.sign as any).mockReturnValue('mock_token');

            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('token', 'mock_token');
            expect(prisma.user.create).toHaveBeenCalled();
        });

        it('should return 400 if user already exists', async () => {
            // Mock user check (exists)
            (prisma.user.findUnique as any).mockResolvedValue({ id: 1, email: 'test@example.com' });

            const response = await request(app)
                .post('/api/auth/signup')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                });

            expect(response.status).toBe(400);
            expect(response.body.error).toMatch(/already exists/i);
            expect(prisma.user.create).not.toHaveBeenCalled();
        });
    });
});
