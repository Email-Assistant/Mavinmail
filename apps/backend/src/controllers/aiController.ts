// aiController.ts – used in F5 feature

import { Request, Response } from 'express';
import { OpenRouterService } from '../services/openrouterService.js';
import { queryRelevantEmailChunks } from '../services/pineconeService.js';
import { getEmailById, EmailData } from '../services/emailService.js';
import { generateAnswerFromContext, generateGroundedAnswer } from '../services/geminiService.js';
import { classifyQuery } from '../services/queryClassifierService.js';
import { executeRetrieval } from '../services/retrievalService.js';
import { logUsage } from '../services/analyticsService.js';
import { resolveUserModel, getUserIdFromRequest } from '../utils/modelHelper.js';
import { summarizeEmailPrompt, autocompletePrompt, enhanceTextPrompt, draftReplyPrompt } from '../services/promptTemplates.js';
import logger from '../utils/logger.js';

export const summarizeEmail = async (req: Request, res: Response) => {
  const { text } = req.body;
  const userId = getUserIdFromRequest(req);

  if (!text) {
    return res.status(400).json({ error: 'Email text is required.' });
  }

  try {
    // Resolve model using centralized helper (checks user pref -> DB default -> env)
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    logger.info('✅ [DEBUG] summarizeEmail - Final Model Used:', model);

    const prompt = summarizeEmailPrompt(text);

    const summaryData = await OpenRouterService.generateJSON(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'summarize', metadata: { model } });
    }

    res.status(200).json({ summary: summaryData });

  } catch (error) {
    logger.error('Error summarizing email with AI Service:', error);
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
  const userId = getUserIdFromRequest(req);

  logger.info('✅ 3. aiController: Received request to autocomplete text:', text);

  if (!text || text.length < 10) { // Add a length check on the backend for safety
    return res.status(400).json({ error: 'Text input is too short for autocomplete.' });
  }

  try {
    // Resolve model using centralized helper
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    const prompt = autocompletePrompt(text);

    const suggestion = await OpenRouterService.generateContent(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'autocomplete', metadata: { model } });
    }

    res.status(200).json({ suggestion });
    logger.info('✅ 4. aiController: AI API returned raw suggestion:', suggestion);

  } catch (error) {
    logger.error('Error getting autocomplete from AI Service:', error);
    res.status(500).json({ error: 'Failed to generate autocomplete suggestion.' });
  }
};


//rag

export const askQuestionAboutEmails = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const { question, useRag } = req.body; // Expect useRag boolean
  const userId = getUserIdFromRequest(req);

  // Resolve model using centralized helper
  const headerOverride = req.headers['x-model-id'] as string | undefined;
  const model = await resolveUserModel(userId, headerOverride);

  logger.info('✅ [DEBUG] askQuestion Request:', { question, useRag, model });

  if (!question) return res.status(400).json({ message: 'Question is required.' });

  try {
    // ------------------------------------------------------------------
    // MODE 1: GENERAL CHAT (RAG DISABLED)
    // ------------------------------------------------------------------
    if (!useRag) {
      logger.info('ℹ️ RAG Disabled. Using General Chat Mode.');
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
    logger.info('🔍 RAG Enabled. Processing query with enhanced pipeline...');

    // 1️⃣ CLASSIFY QUERY - Determine intent and extract entities
    const classification = await classifyQuery(question);
    logger.info(`📊 Query Classification: ${classification.intent} (confidence: ${classification.confidence})`);

    // 2️⃣ RETRIEVE - Use appropriate retrieval strategy
    const retrievalResult = await executeRetrieval(String(userId), question, classification);

    if (!retrievalResult.success || retrievalResult.emails.length === 0) {
      logger.info('❌ No relevant emails found');
      return res.json({
        answer: "I couldn't find any relevant information in your indexed emails to answer that question. Try syncing more emails or rephrasing your question.",
        metadata: {
          intent: classification.intent,
          confidence: classification.confidence,
          emailsRetrieved: 0,
        }
      });
    }

    logger.info(`✅ Retrieved ${retrievalResult.emails.length} relevant emails`);

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
    logger.error('Ask question error:', error);
    res.status(500).json({ message: 'Failed to get an answer.' });
  }
};


export const enhanceText = async (req: Request, res: Response) => {
  const { text, type } = req.body;
  const userId = getUserIdFromRequest(req);

  if (!text) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  try {
    // Resolve model using centralized helper
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    const prompt = enhanceTextPrompt(text, type);

    const enhancedText = await OpenRouterService.generateContent(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'enhance', metadata: { type, model } });
    }

    res.status(200).json({ enhancedText });
  } catch (error) {
    logger.error('Error enhancing text:', error);
    res.status(500).json({ error: 'Failed to enhance text.' });
  }
};

// draft reply
export const draftReply = async (req: Request, res: Response) => {
  const { emailContent, userPrompt } = req.body;
  const userId = getUserIdFromRequest(req);

  if (!emailContent) {
    return res.status(400).json({ error: 'Email content is required.' });
  }

  try {
    // Resolve model using centralized helper
    const headerOverride = req.headers['x-model-id'] as string | undefined;
    const model = await resolveUserModel(userId, headerOverride);

    const prompt = draftReplyPrompt(emailContent, userPrompt);

    const reply = await OpenRouterService.generateContent(prompt, model);

    // Log usage for analytics
    if (userId) {
      logUsage({ userId: Number(userId), action: 'draft', metadata: { model } });
    }

    res.status(200).json({ reply });
  } catch (error) {
    logger.error('Error in draftReply:', error);
    res.status(500).json({ error: 'Failed to generate draft reply.' });
  }
};

/**
 * 🚀 STREAMING: Ask a question with real-time streaming response
 * Uses Server-Sent Events (SSE) to stream the answer as it's generated
 */
export const askQuestionStream = async (req: Request, res: Response) => {
  const { question, useRag = true } = req.body;
  const userId = getUserIdFromRequest(req);

  // Resolve model
  const headerOverride = req.headers['x-model-id'] as string | undefined;
  const model = await resolveUserModel(userId, headerOverride);

  logger.info('🌊 [STREAMING] askQuestionStream Request:', { question, useRag, model });

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
    logger.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to generate answer' })}\n\n`);
    res.end();
  }
};
