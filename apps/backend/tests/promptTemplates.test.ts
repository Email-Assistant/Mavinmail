import { describe, it, expect } from '@jest/globals';
import {
    summarizeEmailPrompt,
    autocompletePrompt,
    enhanceTextPrompt,
    draftReplyPrompt
} from '../src/services/promptTemplates.js';

describe('Prompt Templates', () => {
    describe('summarizeEmailPrompt', () => {
        it('should include the input text in the prompt', () => {
            const input = 'Subject: Hello\nBody: World';
            const prompt = summarizeEmailPrompt(input);
            expect(prompt).toContain(input);
            expect(prompt).toContain('Return ONLY valid JSON');
        });
    });

    describe('autocompletePrompt', () => {
        it('should format the prompt correctly', () => {
            const input = 'Hello wo';
            const prompt = autocompletePrompt(input);
            expect(prompt).toContain(input);
            expect(prompt).toContain('single-sentence completion');
        });
    });

    describe('enhanceTextPrompt', () => {
        it('should use default instruction when type is not provided', () => {
            const input = 'Bad text';
            const prompt = enhanceTextPrompt(input);
            expect(prompt).toContain('Improve the writing');
            expect(prompt).toContain(input);
        });

        it('should use specific instruction for "formal" type', () => {
            const input = 'Bad text';
            const prompt = enhanceTextPrompt(input, 'formal');
            expect(prompt).toContain('more formal and professional');
        });
    });

    describe('draftReplyPrompt', () => {
        it('should use default instruction when user prompt is missing', () => {
            const email = 'From: Boss\nDo this now.';
            const prompt = draftReplyPrompt(email);
            expect(prompt).toContain('Draft a suitable reply');
            expect(prompt).toContain(email);
        });

        it('should include user instructions when provided', () => {
            const email = 'From: Friend\nHi.';
            const userInstruction = 'Say no politely';
            const prompt = draftReplyPrompt(email, userInstruction);
            expect(prompt).toContain(userInstruction);
        });
    });
});
