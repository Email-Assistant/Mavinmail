// Set NODE_ENV to test to avoid connecting to real services
process.env.NODE_ENV = 'test';
process.env.PORT = '5002';
process.env.JWT_SECRET = 'test-secret-at-least-16-chars-long';
process.env.ENCRYPTION_SECRET = '12345678901234567890123456789012';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

// Mock console methods to keep test output clean
global.console = {
    ...console,
    // log: jest.fn(), // Uncomment to suppress logs
    // error: jest.fn(),
};
