import { OpenRouterService } from "./openrouterService.js";

/**
 * Generates an AI-grounded answer using the given context.
 * Ensures Gemini (via OpenRouter) only uses provided context — no hallucination.
 * @param question The user's question.
 * @param context The relevant email chunks.
 * @param model Optional model ID.
 */
export const generateAnswerFromContext = async (question: string, context: string, model?: string): Promise<string> => {
  try {
    const prompt = `
You are an intelligent email assistant designed to help users find information in their emails.
Use ONLY the information provided in the context below to answer the question.
If you cannot find an answer, respond exactly with: "I couldn't find relevant information in your emails."

IMPORTANT FORMATTING RULES:
1. Structure your response with clear sections using these headers:
   📌 **Summary** - A brief 2-4 sentence answer
   📧 **Source Email(s)** - Which email(s) contained this information (include sender and subject)
   📋 **Key Details** - Important specifics like dates, amounts, names, etc.
   ⚡ **Action Items** - Any tasks or follow-ups mentioned (or "None" if not applicable)

2. Use bullet points (•) for lists
3. Bold important keywords and values using **text**
4. Keep the response concise but comprehensive
5. If multiple emails are relevant, summarize each briefly

Context (Email Data):
${context}

User Question: ${question}

Provide a well-formatted, professional response:
`;

    return await OpenRouterService.generateContent(prompt, model);
  } catch (error) {
    logger.error('Error in generateAnswerFromContext:', error);
    throw new Error('Failed to generate answer from AI service.');
  }
};

// Import types for grounded generation
import { QueryIntent } from './queryClassifierService.js';
import { AggregationResult } from './retrievalService.js';
import logger from '../utils/logger.js';

/**
 * Generate a strictly grounded answer with enhanced prompting for accuracy.
 * This function enforces:
 * - No hallucination: answers MUST come from provided context
 * - Abstention: prefer "not found" over incorrect answers
 * - Numbers/dates from metadata, not inference
 * - Aggregation results are used directly when available
 */
export interface GroundedAnswerParams {
  question: string;
  context: string;
  intent: QueryIntent;
  aggregation?: AggregationResult;
  model?: string;
}

export const generateGroundedAnswer = async (params: GroundedAnswerParams): Promise<string> => {
  const { question, context, intent, aggregation, model } = params;

  try {
    // Handle aggregation queries with pre-computed results
    if (intent === 'aggregation' && aggregation) {
      return formatAggregationAnswer(question, aggregation);
    }

    // Build intent-specific prompt
    const prompt = buildGroundedPrompt(question, context, intent);
    return await OpenRouterService.generateContent(prompt, model);
  } catch (error) {
    logger.error('Error in generateGroundedAnswer:', error);
    throw new Error('Failed to generate grounded answer from AI service.');
  }
};

/**
 * Format aggregation results directly (no LLM needed)
 */
const formatAggregationAnswer = (question: string, aggregation: AggregationResult): string => {
  if (aggregation.type === 'count') {
    return `📊 **Summary**\nBased on your indexed emails, I found **${aggregation.value}** emails matching your query.`;
  }

  if (aggregation.type === 'sum' && aggregation.items) {
    const total = aggregation.value || 0;
    const itemList = aggregation.items
      .map(item => `• **${item.vendor || 'Unknown'}**: $${item.amount.toFixed(2)} (${item.date})`)
      .join('\n');

    return `📊 **Summary**
Total: **$${total.toFixed(2)}** across ${aggregation.items.length} invoice(s)

📋 **Breakdown**
${itemList}`;
  }

  return `📊 **Summary**\nNo aggregation data available for this query.`;
};

/**
 * Build intent-specific grounded prompt
 */
const buildGroundedPrompt = (question: string, context: string, intent: QueryIntent): string => {
  const baseRules = `
CRITICAL GROUNDING RULES - YOU MUST FOLLOW THESE EXACTLY:
1. ONLY use information that appears EXPLICITLY in the context below
2. If you cannot find a direct answer in the context, respond: "I couldn't find that information in your indexed emails."
3. ALL dates, numbers, and amounts MUST be copied exactly from the email content
4. NEVER infer, estimate, or calculate values that aren't explicitly stated
5. ALWAYS cite which email(s) contain the information (sender + subject)
6. If the question asks about something not in the context, admit you don't have that information
`;

  const intentPrompts: Record<QueryIntent, string> = {
    structured: `You are an email database assistant. The user asked a STRUCTURED query - they want specific emails or metadata.
${baseRules}

FORMATTING:
- List the relevant emails found
- Include sender, subject, and date for each
- If they asked for "latest N emails", show exactly N (or fewer if that's all you found)

Context:
${context}

Question: ${question}

Answer:`,

    semantic: `You are an email search assistant. The user asked a SEMANTIC query - they want content-based information.
${baseRules}

FORMATTING:
📌 **Summary** - Brief 2-4 sentence answer drawn ONLY from the emails
📧 **Source Email(s)** - Sender and subject of source emails  
📋 **Key Details** - Specific facts, dates, amounts from the emails

Context:
${context}

Question: ${question}

Answer:`,

    hybrid: `You are an email search assistant. The user asked a HYBRID query - they want content from specific types of emails.
${baseRules}

FORMATTING:
📌 **Summary** - Brief answer drawn ONLY from the emails
📧 **Source Email(s)** - Sender and subject of source emails
📋 **Key Details** - Specific facts, dates, amounts from the emails

Context:
${context}

Question: ${question}

Answer:`,

    aggregation: `You are an email analytics assistant. The user asked an AGGREGATION query.
${baseRules}

Provide a summary of what you found in the context. Use exact counts and amounts from the emails.

Context:
${context}

Question: ${question}

Answer:`,
  };

  return intentPrompts[intent] || intentPrompts.semantic;
};

