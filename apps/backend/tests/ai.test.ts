import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ─── Mocks (Hoisted before any imports) ──────────────────────────────

// Mock OpenRouterService
const mockGenerateJSON = jest.fn().mockImplementation(() => Promise.resolve({ summary: 'AI summary' }));
const mockGenerateContent = jest.fn().mockImplementation(() => Promise.resolve('AI generated text'));
const mockGenerateContentStream = jest.fn();

jest.unstable_mockModule('../src/services/openrouterService.js', () => ({
    OpenRouterService: {
        generateJSON: mockGenerateJSON,
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
    },
}));

// Mock modelHelper
jest.unstable_mockModule('../src/utils/modelHelper.js', () => ({
    resolveUserModel: jest.fn().mockImplementation(() => Promise.resolve('openai/gpt-4o-mini')),
    getUserIdFromRequest: jest.fn().mockReturnValue(1),
}));

// Mock analyticsService
jest.unstable_mockModule('../src/services/analyticsService.js', () => ({
    logUsage: jest.fn(),
}));

// Mock queryClassifierService
const mockClassifyQuery = jest.fn().mockImplementation(() =>
    Promise.resolve({ intent: 'general', confidence: 0.9, entities: {} })
);
jest.unstable_mockModule('../src/services/queryClassifierService.js', () => ({
    classifyQuery: mockClassifyQuery,
}));

// Mock retrievalService
const mockExecuteRetrieval = jest.fn().mockImplementation(() =>
    Promise.resolve({ success: true, emails: [], aggregation: {}, latencyMs: 10 })
);
jest.unstable_mockModule('../src/services/retrievalService.js', () => ({
    executeRetrieval: mockExecuteRetrieval,
}));

// Mock geminiService
const mockGenerateGroundedAnswer = jest.fn().mockImplementation(() =>
    Promise.resolve('Grounded answer from context')
);
jest.unstable_mockModule('../src/services/geminiService.js', () => ({
    generateGroundedAnswer: mockGenerateGroundedAnswer,
    generateAnswerFromContext: jest.fn(),
}));

// Mock pineconeService (needed transitively)
jest.unstable_mockModule('../src/services/pineconeService.js', () => ({
    queryRelevantEmailChunks: jest.fn(),
    upsertEmailChunks: jest.fn(),
    queryWithFilters: jest.fn(),
    getUniqueEmailsFromChunks: jest.fn(),
    fetchAllChunksForEmails: jest.fn(),
}));

// Mock emailService (needed transitively)
jest.unstable_mockModule('../src/services/emailService.js', () => ({
    getEmailById: jest.fn(),
    getLatestEmails: jest.fn(),
    getLatestMessageIds: jest.fn(),
}));

// Mock logger
jest.unstable_mockModule('../src/utils/logger.js', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

// ─── Dynamic Imports ─────────────────────────────────────────────────
let summarizeEmail: any;
let getAutocomplete: any;
let enhanceText: any;
let draftReply: any;
let askQuestionAboutEmails: any;

// ─── Helper: Create mock Express req/res ─────────────────────────────
const createMockReq = (body: any = {}, headers: any = {}, user: any = { id: 1 }) => ({
    body,
    headers,
    user,
});

const createMockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.flushHeaders = jest.fn();
    res.write = jest.fn();
    res.end = jest.fn();
    return res;
};

// ─── Test Suite ──────────────────────────────────────────────────────
describe('AI Controller (Unit Tests)', () => {
    beforeAll(async () => {
        const controller = await import('../src/controllers/aiController.js');
        summarizeEmail = controller.summarizeEmail;
        getAutocomplete = controller.getAutocomplete;
        enhanceText = controller.enhanceText;
        draftReply = controller.draftReply;
        askQuestionAboutEmails = controller.askQuestionAboutEmails;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset default implementations
        mockGenerateJSON.mockImplementation(() => Promise.resolve({ summary: 'AI summary' }));
        mockGenerateContent.mockImplementation(() => Promise.resolve('AI generated text'));
    });

    // ─── Summarize ───────────────────────────────────────────────────
    describe('summarizeEmail', () => {
        it('should return 400 if text is missing', async () => {
            const req = createMockReq({});
            const res = createMockRes();

            await summarizeEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Email text is required.' });
        });

        it('should return a summary from OpenRouter', async () => {
            const req = createMockReq({ text: 'Hello, this is a long email...' });
            const res = createMockRes();

            await summarizeEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ summary: { summary: 'AI summary' } });
            expect(mockGenerateJSON).toHaveBeenCalled();
        });

        it('should return 500 on AI service failure', async () => {
            mockGenerateJSON.mockImplementation(() => Promise.reject(new Error('API down')));
            const req = createMockReq({ text: 'Some email text' });
            const res = createMockRes();

            await summarizeEmail(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to summarize the email.' });
        });
    });

    // ─── Autocomplete ────────────────────────────────────────────────
    describe('getAutocomplete', () => {
        it('should return 400 for short text', async () => {
            const req = createMockReq({ text: 'Hi' });
            const res = createMockRes();

            await getAutocomplete(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return autocomplete suggestion', async () => {
            mockGenerateContent.mockImplementation(() => Promise.resolve('...complete this sentence'));
            const req = createMockReq({ text: 'Hello, I am writing to inform you about' });
            const res = createMockRes();

            await getAutocomplete(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ suggestion: '...complete this sentence' });
        });
    });

    // ─── Enhance Text ────────────────────────────────────────────────
    describe('enhanceText', () => {
        it('should return 400 if text is missing', async () => {
            const req = createMockReq({});
            const res = createMockRes();

            await enhanceText(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return enhanced text', async () => {
            mockGenerateContent.mockImplementation(() => Promise.resolve('Polished professional text'));
            const req = createMockReq({ text: 'make this sound better', type: 'professional' });
            const res = createMockRes();

            await enhanceText(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ enhancedText: 'Polished professional text' });
        });
    });

    // ─── Draft Reply ─────────────────────────────────────────────────
    describe('draftReply', () => {
        it('should return 400 if emailContent is missing', async () => {
            const req = createMockReq({});
            const res = createMockRes();

            await draftReply(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return a draft reply', async () => {
            mockGenerateContent.mockImplementation(() => Promise.resolve('Dear colleague, thank you...'));
            const req = createMockReq({
                emailContent: 'Can we schedule a meeting?',
                userPrompt: 'Accept politely',
            });
            const res = createMockRes();

            await draftReply(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({ reply: 'Dear colleague, thank you...' });
        });

        it('should return 500 on error', async () => {
            mockGenerateContent.mockImplementation(() => Promise.reject(new Error('Timeout')));
            const req = createMockReq({ emailContent: 'Some email' });
            const res = createMockRes();

            await draftReply(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // ─── Ask Question (RAG) ──────────────────────────────────────────
    describe('askQuestionAboutEmails', () => {
        it('should return 401 if user is not authenticated', async () => {
            const req = createMockReq({ question: 'What?' }, {}, null);
            // askQuestionAboutEmails checks req.user
            (req as any).user = undefined;
            const res = createMockRes();

            await askQuestionAboutEmails(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 400 if question is missing', async () => {
            const req = createMockReq({});
            const res = createMockRes();

            await askQuestionAboutEmails(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should answer general question (RAG disabled)', async () => {
            mockGenerateContent.mockImplementation(() => Promise.resolve('General AI answer'));
            const req = createMockReq({ question: 'What is machine learning?', useRag: false });
            const res = createMockRes();

            await askQuestionAboutEmails(req, res);

            expect(res.json).toHaveBeenCalledWith({ answer: 'General AI answer' });
            expect(mockGenerateContent).toHaveBeenCalled();
        });

        it('should return "no emails found" when RAG returns empty', async () => {
            mockExecuteRetrieval.mockImplementation(() =>
                Promise.resolve({ success: true, emails: [], aggregation: {} })
            );
            const req = createMockReq({ question: 'Show invoices', useRag: true });
            const res = createMockRes();

            await askQuestionAboutEmails(req, res);

            const jsonCall = res.json.mock.calls[0][0];
            expect(jsonCall.answer).toContain("couldn't find");
        });

        it('should return grounded answer when RAG finds emails', async () => {
            mockExecuteRetrieval.mockImplementation(() =>
                Promise.resolve({
                    success: true,
                    emails: [
                        { from: 'billing@stripe.com', subject: 'Invoice #123', timestamp: '2025-01-01', content: 'Your payment of $50' },
                    ],
                    aggregation: {},
                    latencyMs: 15,
                })
            );
            mockGenerateGroundedAnswer.mockImplementation(() => Promise.resolve('You paid $50 to Stripe'));

            const req = createMockReq({ question: 'How much did I pay Stripe?', useRag: true });
            const res = createMockRes();

            await askQuestionAboutEmails(req, res);

            const jsonCall = res.json.mock.calls[0][0];
            expect(jsonCall.answer).toBe('You paid $50 to Stripe');
            expect(jsonCall.metadata.emailsRetrieved).toBe(1);
        });
    });
});
