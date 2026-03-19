import { OpenRouterService } from "./openrouterService.js";
import { resolveUserModel } from "../utils/modelHelper.js";
import logger from '../utils/logger.js';

/**
 * Interface for structured email input
 */
interface EmailInput {
  id: string;
  category: string;
  content: string;
}

interface DigestItem {
  id: string;
  category: string;
  email_title: string;
  sender: string;
  summary: string;
  action_items: string[];
  important_details: string[];
  intent: string;
  sentiment: string;
}

interface DigestSection {
  title: string;
  items: DigestItem[];
}

interface DigestResult {
  title: string;
  sections: DigestSection[];
}

// Process emails in smaller batches to avoid output truncation on free models
const BATCH_SIZE = 3;

/**
 * Takes an array of email objects and generates a cohesive "Daily Digest".
 * Processes in batches to avoid output length limits on free models.
 * @param emailData Array of email objects with id, category, and content.
 * @param model Optional model ID to use for generation.
 * @returns The generated digest as a JSON string.
 */
export const summarizeEmailBatch = async (emailData: EmailInput[], model?: string): Promise<string> => {
  if (!emailData || emailData.length === 0) {
    throw new Error("No emails provided for summarization.");
  }

  logger.info(`[AI Service] Processing ${emailData.length} emails in batches of ${BATCH_SIZE}...`);

  // Split into batches
  const batches: EmailInput[][] = [];
  for (let i = 0; i < emailData.length; i += BATCH_SIZE) {
    batches.push(emailData.slice(i, i + BATCH_SIZE));
  }

  logger.info(`[AI Service] Created ${batches.length} batches`);

  // Process each batch
  const allItems: DigestItem[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`[AI Service] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} emails)...`);

    try {
      const batchItems = await processBatch(batch, model);
      allItems.push(...batchItems);
      logger.info(`[AI Service] Batch ${batchIndex + 1} complete: got ${batchItems.length} summaries`);
    } catch (error) {
      logger.error(`[AI Service] Batch ${batchIndex + 1} failed:`, error);
      // Add placeholder items for failed emails
      for (const email of batch) {
        allItems.push({
          id: email.id,
          category: email.category,
          email_title: "Processing failed",
          sender: "Unknown",
          summary: "Unable to summarize this email. Please try again later.",
          action_items: [],
          important_details: [],
          intent: "Other",
          sentiment: "Neutral"
        });
      }
    }
  }

  // Group by category for final output
  const categoryMap = new Map<string, DigestItem[]>();
  for (const item of allItems) {
    const category = item.category || "Other";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(item);
  }

  // Build final digest
  const sections: DigestSection[] = [];
  for (const [category, items] of categoryMap) {
    sections.push({ title: category, items });
  }

  const digest: DigestResult = {
    title: "Daily Digest",
    sections
  };

  logger.info(`[AI Service] Final digest: ${allItems.length} items in ${sections.length} sections`);

  if (allItems.length !== emailData.length) {
    logger.warn(`[AI Service WARNING] Count mismatch: expected ${emailData.length}, got ${allItems.length}`);
  }

  return JSON.stringify(digest);
};

/**
 * Process a single batch of emails (up to BATCH_SIZE)
 * Includes validation to ensure all emails are summarized
 */
async function processBatch(emails: EmailInput[], model?: string): Promise<DigestItem[]> {
  const emailIds = emails.map(e => e.id);

  const formattedInput = emails.map(e =>
    `EMAIL_ID: ${e.id}\nCATEGORY: ${e.category}\n${e.content}`
  ).join('\n---\n');

  const prompt = `Summarize these ${emails.length} emails. Return ONLY a JSON array.

${formattedInput}

Return EXACTLY ${emails.length} items in this JSON array format:
[
  {
    "id": "exact EMAIL_ID from above",
    "category": "exact CATEGORY from above",
    "email_title": "short title",
    "sender": "sender name",
    "summary": "1-2 sentence summary",
    "action_items": [],
    "important_details": [],
    "intent": "Request|Informational|Urgent|Meeting|Other",
    "sentiment": "Positive|Neutral|Negative|Urgent"
  }
]

CRITICAL RULES:
- You MUST return EXACTLY ${emails.length} items
- The IDs MUST be: ${emailIds.join(', ')}
- Return ONLY the JSON array, no other text`;

  // Resolve model if not provided
  const resolvedModel = model || await resolveUserModel();
  const rawContent = await OpenRouterService.generateContent(prompt, resolvedModel);

  // Extract JSON array
  const arrayMatch = rawContent.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    logger.error("[AI Service] No JSON array found in response:", rawContent.substring(0, 500));
    throw new Error("Invalid response format");
  }

  try {
    const items = JSON.parse(arrayMatch[0]) as DigestItem[];

    // Verify all emails were returned
    const returnedIds = new Set(items.map(item => item.id));
    const missingIds = emailIds.filter(id => !returnedIds.has(id));

    if (missingIds.length > 0) {
      logger.warn(`[AI Service] Missing ${missingIds.length} emails: ${missingIds.join(', ')}`);

      // Add placeholder items for missing emails
      for (const missingId of missingIds) {
        const missingEmail = emails.find(e => e.id === missingId);
        if (missingEmail) {
          // Try to extract subject and sender from content
          const subjectMatch = missingEmail.content.match(/Subject:\s*(.+)/i);
          const fromMatch = missingEmail.content.match(/From:\s*(?:"?([^"<]+)"?\s*)?<?([^>]+@[^>]+)>?/i);

          items.push({
            id: missingId,
            category: missingEmail.category,
            email_title: subjectMatch ? subjectMatch[1].trim().substring(0, 50) : "Email",
            sender: fromMatch ? (fromMatch[1]?.trim() || fromMatch[2]) : "Unknown",
            summary: "Summary not available.",
            action_items: [],
            important_details: [],
            intent: "Other",
            sentiment: "Neutral"
          });
        }
      }
    }

    return items;
  } catch (e) {
    logger.error("[AI Service] Failed to parse JSON:", arrayMatch[0].substring(0, 500));
    throw new Error("Failed to parse response");
  }
}