// aiController.ts – used in F5 feature

import { Request, Response } from 'express';
import { OpenRouterService } from '../services/openrouterService.js';
import { queryRelevantEmailChunks } from '../services/pineconeService.js';
import { getEmailById, EmailData } from '../services/emailService.js';
import { generateAnswerFromContext, generateGroundedAnswer } from '../services/geminiService.js';
import { classifyQuery } from '../services/queryClassifierService.js';
import { executeRetrieval } from '../services/retrievalService.js';
import { PrismaClient } from '@prisma/client';
import { logUsage } from '../services/analyticsService.js';
import { resolveUserModel, getUserIdFromRequest } from '../utils/modelHelper.js';

const prisma = new PrismaClient();

export const summarizeEmail = async (req: Request, res: Response) => {
  const { text } = req.body;
  // @ts-ignore
  const userId = getUserIdFromRequest(req);

  if (!text) {
    return res.status(400).json({ error: 'Email text is required.' });
  }

  try {
    // Resolve model using centralized helper (checks user pref -> DB default -> env)
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    console.log('✅ [DEBUG] summarizeEmail - Final Model Used:', model);

    const prompt = `
You are an intelligent email summarization assistant. Your goal is to extract key information and return it in a structured JSON format.

Input Email:
---
${text}
---

Instructions:
1. Analyze the email content.
2. Extract the following fields:
   - "email_title": A short, clear title for the email.
   - "sender": The name or email address of the sender (inferred from context if not explicitly stated, otherwise "Unknown").
   - "summary": A concise 2-3 sentence summary of the main point.
   - "action_items": A list of specific actionable tasks or requests (strings). If none, use an empty list.
   - "important_details": A list of key facts, dates, or deadlines (strings).
   - "intent": One of "Request", "Informational", "Urgent", "Meeting", "Follow-up", "Other".
   - "sentiment": One of "Positive", "Neutral", "Negative", "Urgent".

3. Return ONLY valid JSON matching this structure.
{
  "email_title": "...",
  "sender": "...",
  "summary": "...",
  "action_items": ["...", "..."],
  "important_details": ["...", "..."],
  "intent": "...",
  "sentiment": "..."
}
`;

    const summaryData = await OpenRouterService.generateJSON(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'summarize', metadata: { model } });
    }

    res.status(200).json({ summary: summaryData });

  } catch (error) {
    console.error('Error summarizing email with AI Service:', error);
    // Log failed attempt
    if (userId) {
      logUsage({ userId: Number(userId), action: 'summarize', success: false });
    }
    res.status(500).json({ error: 'Failed to summarize the email.' });
  }
};


//-------------------------------------------------------------------------

// ai autocomplete 

export const getAutocomplete = async (req: Request, res: Response) => {
  const { text } = req.body;
  // @ts-ignore
  const userId = getUserIdFromRequest(req);

  console.log('✅ 3. aiController: Received request to autocomplete text:', text);

  if (!text || text.length < 10) { // Add a length check on the backend for safety
    return res.status(400).json({ error: 'Text input is too short for autocomplete.' });
  }

  try {
    // Resolve model using centralized helper
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    const prompt = `You are an AI assistant helping a user write. Your task is to provide a short, single-sentence completion for the text they have started. Do not repeat the user's text in your response. Only provide the new, autocompleted part. Be concise.\n\nUser's text:\n---\n${text}\n---`;

    const suggestion = await OpenRouterService.generateContent(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'autocomplete', metadata: { model } });
    }

    res.status(200).json({ suggestion });
    console.log('✅ 4. aiController: AI API returned raw suggestion:', suggestion);

  } catch (error) {
    console.error('Error getting autocomplete from AI Service:', error);
    res.status(500).json({ error: 'Failed to generate autocomplete suggestion.' });
  }
};


//rag

export const askQuestionAboutEmails = async (req: any, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const { question, useRag } = req.body; // Expect useRag boolean
  const userId = getUserIdFromRequest(req);

  // Resolve model using centralized helper
  const headerOverride = req.headers['x-model-id'] as string | undefined;
  const model = await resolveUserModel(userId, headerOverride);

  console.log('✅ [DEBUG] askQuestion Request:', { question, useRag, model });

  if (!question) return res.status(400).json({ message: 'Question is required.' });

  try {
    // ------------------------------------------------------------------
    // MODE 1: GENERAL CHAT (RAG DISABLED)
    // ------------------------------------------------------------------
    if (!useRag) {
      console.log('ℹ️ RAG Disabled. Using General Chat Mode.');
      const prompt = `
You are a helpful AI assistant.
Answer the following question to the best of your ability.

Question: ${question}
`;
      const answer = await OpenRouterService.generateContent(prompt, model);

      // Log usage for analytics (General Chat)
      if (userId) {
        logUsage({ userId: Number(userId), action: 'rag_query', metadata: { query: question, model, useRag: false } });
      }

      return res.json({ answer });
    }

    // ------------------------------------------------------------------
    // MODE 2: RAG ENABLED (Search Inbox) - ENHANCED PIPELINE
    // ------------------------------------------------------------------
    console.log('🔍 RAG Enabled. Processing query with enhanced pipeline...');

    // 1️⃣ CLASSIFY QUERY - Determine intent and extract entities
    const classification = await classifyQuery(question);
    console.log(`📊 Query Classification: ${classification.intent} (confidence: ${classification.confidence})`);

    // 2️⃣ RETRIEVE - Use appropriate retrieval strategy
    const retrievalResult = await executeRetrieval(String(userId), question, classification);

    if (!retrievalResult.success || retrievalResult.emails.length === 0) {
      console.log('❌ No relevant emails found');
      return res.json({
        answer: "I couldn't find any relevant information in your indexed emails to answer that question. Try syncing more emails or rephrasing your question.",
        metadata: {
          intent: classification.intent,
          confidence: classification.confidence,
          emailsRetrieved: 0,
        }
      });
    }

    console.log(`✅ Retrieved ${retrievalResult.emails.length} relevant emails`);

    // 3️⃣ BUILD CONTEXT - Format emails for answer generation
    const context = retrievalResult.emails
      .map((email, idx) => `
[Email ${idx + 1}]
From: ${email.from}
Subject: ${email.subject}
Date: ${email.timestamp}
Content:
${email.content}
--------------------------------------------------
`)
      .join('\n');

    // Safety truncate
    const truncatedContext = context.slice(0, 15000);

    // 4️⃣ GENERATE GROUNDED ANSWER - With strict grounding
    const answer = await generateGroundedAnswer({
      question,
      context: truncatedContext,
      intent: classification.intent,
      aggregation: retrievalResult.aggregation,
      model,
    });

    // Log usage for analytics
    if (userId) {
      logUsage({
        userId: Number(userId),
        action: 'rag_query',
        metadata: {
          query: question,
          model,
          useRag: true,
          intent: classification.intent,
          confidence: classification.confidence,
          emailsRetrieved: retrievalResult.emails.length,
          latencyMs: retrievalResult.latencyMs,
        }
      });
    }

    res.json({
      answer,
      metadata: {
        intent: classification.intent,
        confidence: classification.confidence,
        emailsRetrieved: retrievalResult.emails.length,
        aggregation: retrievalResult.aggregation,
      }
    });

  } catch (error) {
    console.error('Ask question error:', error);
    res.status(500).json({ message: 'Failed to get an answer.' });
  }
};


export const enhanceText = async (req: Request, res: Response) => {
  const { text, type } = req.body;
  // @ts-ignore
  const userId = getUserIdFromRequest(req);

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  try {
    // Resolve model using centralized helper
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    let instruction = "Improve the writing of the following text.";
    if (type === 'formal') instruction = "Rewrite the following text to be more formal and professional.";
    else if (type === 'concise') instruction = "Rewrite the following text to be more concise and to the point.";
    else if (type === 'casual') instruction = "Rewrite the following text to be more casual and friendly.";
    else if (type === 'clarity') instruction = "Rewrite the following text to improve clarity and flow.";
    else if (type === 'more') instruction = "Expand on the following text, adding more detail and context.";

    const prompt = `${instruction}\n\nText:\n---\n${text}\n---\n\nReturn only the enhanced text, nothing else.`;

    const enhancedText = await OpenRouterService.generateContent(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'enhance', metadata: { type, model } });
    }

    res.status(200).json({ enhancedText });
  } catch (error) {
    console.error('Error enhancing text:', error);
    res.status(500).json({ error: 'Failed to enhance text.' });
  }
};

// draft reply
export const draftReply = async (req: Request, res: Response) => {
  const { emailContent, userPrompt } = req.body;
  // @ts-ignore
  const userId = getUserIdFromRequest(req);

  if (!emailContent) {
    return res.status(400).json({ error: 'Email content is required.' });
  }

  try {
    // Resolve model using centralized helper
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    const prompt = `
You are a professional email assistant.
Context (The email thread):
---
${emailContent}
---

User Instruction:
${userPrompt || "Draft a suitable reply based on the context."}

Draft a professional and polite reply to the above email.
`;

    const reply = await OpenRouterService.generateContent(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'draft', metadata: { model } });
    }

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Error in draftReply:', error);
    res.status(500).json({ error: 'Failed to generate draft reply.' });
  }
};

/**
 * 🚀 STREAMING: Ask a question with real-time streaming response
 * Uses Server-Sent Events (SSE) to stream the answer as it's generated
 */
export const askQuestionStream = async (req: Request, res: Response) => {
  const { question, useRag = true } = req.body;
  // @ts-ignore
  const userId = getUserIdFromRequest(req);

  // Resolve model
  const headerOverride = req.headers['x-model-id'] as string | undefined;
  const model = await resolveUserModel(userId, headerOverride);

  console.log('🌊 [STREAMING] askQuestionStream Request:', { question, useRag, model });

  if (!question) {
    return res.status(400).json({ message: 'Question is required.' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    let context = '';
    let classification = null;

    if (useRag) {
      // Classify and retrieve
      classification = await classifyQuery(question);
      res.write(`data: ${JSON.stringify({ type: 'status', message: `Searching emails (${classification.intent})...` })}\n\n`);

      const retrievalResult = await executeRetrieval(String(userId), question, classification);

      if (!retrievalResult.success || retrievalResult.emails.length === 0) {
        res.write(`data: ${JSON.stringify({ type: 'answer', content: "I couldn't find relevant emails. Try syncing more emails." })}\n\n`);
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      res.write(`data: ${JSON.stringify({ type: 'status', message: `Found ${retrievalResult.emails.length} emails, generating answer...` })}\n\n`);

      // Build context
      context = retrievalResult.emails
        .map((email, idx) => `[Email ${idx + 1}]\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.timestamp}\nContent:\n${email.content}\n--------------------------------------------------`)
        .join('\n');
      context = context.slice(0, 15000);
    }

    // Build prompt
    const prompt = useRag
      ? `You are an intelligent email assistant. Use ONLY the information in the context below.
If you cannot find an answer, say "I couldn't find that information."

Context:
${context}

Question: ${question}

Answer:`
      : `You are a helpful AI assistant. Answer the following question: ${question}`;

    // Stream the response
    await OpenRouterService.generateContentStream(
      prompt,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'answer', content: chunk })}\n\n`);
      },
      model
    );

    res.write('data: [DONE]\n\n');
    res.end();

    // Log usage
    if (userId) {
      logUsage({ userId: Number(userId), action: 'rag_query', metadata: { query: question, model, useRag, streaming: true } });
    }

  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate answer' })}\n\n`);
    res.end();
  }
};
