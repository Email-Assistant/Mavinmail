/**
 * Query Classifier Service
 * 
 * Classifies user queries to determine the optimal retrieval strategy:
 * - structured: metadata filtering only (latest emails, by sender, etc.)
 * - semantic: vector search (content-based questions)
 * - hybrid: metadata filter → vector search (filtered content search)
 * - aggregation: metadata + computation (invoice totals, counts)
 */

import { OpenRouterService } from './openrouterService.js';
import { EmailType } from './metadataExtractorService.js';
import { PineconeFilter } from './pineconeService.js';
import logger from '../utils/logger.js';

// Query intent types
export type QueryIntent = 'structured' | 'semantic' | 'hybrid' | 'aggregation';

// Classification result
export interface QueryClassification {
    intent: QueryIntent;
    entities: {
        vendor: string | null;
        sender: string | null;
        dateRange: {
            start: string;    // YYYY-MM-DD
            end: string;      // YYYY-MM-DD
        } | null;
        month: string | null;       // YYYY-MM
        count: number | null;
        emailType: EmailType | null;
        isInvoice: boolean | null;
        keywords: string[];
    };
    filters: PineconeFilter;
    requiresSort: boolean;
    sortField: 'timestamp' | null;
    sortOrder: 'asc' | 'desc' | null;
    confidence: number;           // 0-1 confidence score
}

// Known vendor keywords for extraction
const VENDOR_KEYWORDS: Record<string, string[]> = {
    aws: ['aws', 'amazon web services', 'amazon', 'amazonaws'],
    stripe: ['stripe'],
    google: ['google', 'gcp', 'google cloud'],
    microsoft: ['microsoft', 'azure', 'office 365', 'ms'],
    github: ['github'],
    slack: ['slack'],
    zoom: ['zoom'],
    vercel: ['vercel'],
    heroku: ['heroku'],
    digitalocean: ['digital ocean', 'digitalocean'],
};

// Date patterns for extraction
const DATE_PATTERNS = {
    thisMonth: /this month|current month/i,
    lastMonth: /last month|previous month/i,
    thisWeek: /this week|current week/i,
    lastWeek: /last week|previous week/i,
    today: /today|now/i,
    yesterday: /yesterday/i,
    recent: /recent|latest|newest|last \d+/i,
};

// Count extraction pattern
const COUNT_PATTERN = /\b(?:latest|last|recent|top|first)\s*(\d+)\b/i;

/**
 * Extracts count from query (e.g., "latest 5 emails" → 5)
 */
const extractCount = (query: string): number | null => {
    const match = query.match(COUNT_PATTERN);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
};

/**
 * Extracts vendor from query
 */
const extractVendor = (query: string): string | null => {
    const lowerQuery = query.toLowerCase();
    for (const [vendor, keywords] of Object.entries(VENDOR_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lowerQuery.includes(keyword)) {
                return vendor;
            }
        }
    }
    return null;
};

/**
 * Calculates date range from query
 */
const extractDateRange = (query: string): { start: string; end: string } | null => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (DATE_PATTERNS.thisMonth.test(query)) {
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        return { start, end: today };
    }

    if (DATE_PATTERNS.lastMonth.test(query)) {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
            start: lastMonth.toISOString().split('T')[0],
            end: lastDayOfLastMonth.toISOString().split('T')[0]
        };
    }

    if (DATE_PATTERNS.thisWeek.test(query)) {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        return { start: startOfWeek.toISOString().split('T')[0], end: today };
    }

    if (DATE_PATTERNS.today.test(query)) {
        return { start: today, end: today };
    }

    if (DATE_PATTERNS.yesterday.test(query)) {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        return { start: yesterdayStr, end: yesterdayStr };
    }

    return null;
};

/**
 * Extracts month from date range
 */
const extractMonth = (query: string): string | null => {
    const dateRange = extractDateRange(query);
    if (dateRange && DATE_PATTERNS.thisMonth.test(query)) {
        return dateRange.start.substring(0, 7);
    }
    if (dateRange && DATE_PATTERNS.lastMonth.test(query)) {
        return dateRange.start.substring(0, 7);
    }
    return null;
};

/**
 * Rule-based classification for common patterns
 * Returns null if LLM should be used
 */
const classifyByRules = (query: string): QueryClassification | null => {
    const lowerQuery = query.toLowerCase();
    const count = extractCount(query);
    const vendor = extractVendor(query);
    const dateRange = extractDateRange(query);
    const month = extractMonth(query);

    // 🚀 NEW PATTERN: "summarize/what is the email from [unknown sender]" 
    // Route to semantic search when sender is mentioned but not in vendor list
    const senderMatch = lowerQuery.match(/\b(?:summarize|what|show|get).*(?:email|message).*\bfrom\s+(\w+)/i);
    if (senderMatch && !vendor) {
        // Unknown sender mentioned - use semantic search to find by content
        logger.info(`[QueryClassifier] Unknown sender "${senderMatch[1]}" - routing to semantic`);
        return {
            intent: 'semantic',  // Not structured - let vector search find it
            entities: {
                vendor: null,
                sender: senderMatch[1],
                dateRange,
                month,
                count: count || 1,
                emailType: null,
                isInvoice: null,
                keywords: [senderMatch[1]],  // Include sender name in keywords
            },
            filters: {},  // No filters - pure semantic search
            requiresSort: true,
            sortField: 'timestamp',
            sortOrder: 'desc',
            confidence: 0.85,
        };
    }

    // Pattern: "latest N emails" / "recent emails" / "my last N emails"
    if (
        /\b(latest|recent|last|newest)\b.*\b(email|message)s?\b/i.test(query) ||
        /\b(email|message)s?\b.*\b(latest|recent|last|newest)\b/i.test(query)
    ) {
        return {
            intent: 'structured',
            entities: {
                vendor: null,
                sender: null,
                dateRange: null,
                month: null,
                count: count || 5,
                emailType: null,
                isInvoice: null,
                keywords: [],
            },
            filters: {},
            requiresSort: true,
            sortField: 'timestamp',
            sortOrder: 'desc',
            confidence: 0.95,
        };
    }

    // Pattern: "invoice from [vendor] this month" / "AWS invoice"
    if (
        /\binvoice\b/i.test(query) &&
        (vendor || DATE_PATTERNS.thisMonth.test(query) || DATE_PATTERNS.lastMonth.test(query))
    ) {
        const filters: PineconeFilter = {
            isInvoice: true,
        };
        if (vendor) filters.vendor = vendor;
        if (month) filters.month = month;
        if (dateRange) {
            filters.dateGte = dateRange.start;
            filters.dateLte = dateRange.end;
        }

        return {
            intent: 'structured',
            entities: {
                vendor,
                sender: null,
                dateRange,
                month,
                count: count || 1,
                emailType: 'invoice',
                isInvoice: true,
                keywords: ['invoice'],
            },
            filters,
            requiresSort: true,
            sortField: 'timestamp',
            sortOrder: 'desc',
            confidence: 0.9,
        };
    }

    // Pattern: "what did [vendor/sender] say about [topic]"
    if (/\bwhat\s+(did|does|has)\b.*\b(say|said|mention|write|wrote)\b.*\babout\b/i.test(query)) {
        const filters: PineconeFilter = {};
        if (vendor) filters.vendor = vendor;

        return {
            intent: vendor ? 'hybrid' : 'semantic',
            entities: {
                vendor,
                sender: null,
                dateRange,
                month,
                count: null,
                emailType: null,
                isInvoice: null,
                keywords: [],
            },
            filters,
            requiresSort: false,
            sortField: null,
            sortOrder: null,
            confidence: 0.8,
        };
    }

    // Pattern: "emails from [domain/sender]"
    const fromMatch = query.match(/\b(?:emails?|messages?)\s+from\s+(\S+)/i);
    if (fromMatch) {
        const sender = fromMatch[1].toLowerCase();
        const filters: PineconeFilter = {
            fromDomain: sender.includes('@') ? sender.split('@')[1] : sender,
        };

        return {
            intent: 'structured',
            entities: {
                vendor: extractVendor(sender),
                sender,
                dateRange,
                month,
                count: count || 10,
                emailType: null,
                isInvoice: null,
                keywords: [],
            },
            filters,
            requiresSort: true,
            sortField: 'timestamp',
            sortOrder: 'desc',
            confidence: 0.85,
        };
    }

    // Pattern: "count of emails" / "how many emails"
    if (/\b(count|how many|number of)\b.*\b(emails?|messages?)\b/i.test(query)) {
        const filters: PineconeFilter = {};
        if (vendor) filters.vendor = vendor;
        if (dateRange) {
            filters.dateGte = dateRange.start;
            filters.dateLte = dateRange.end;
        }

        return {
            intent: 'aggregation',
            entities: {
                vendor,
                sender: null,
                dateRange,
                month,
                count: null,
                emailType: null,
                isInvoice: null,
                keywords: [],
            },
            filters,
            requiresSort: false,
            sortField: null,
            sortOrder: null,
            confidence: 0.85,
        };
    }

    return null;
};

/**
 * LLM-based classification for complex queries
 */
const classifyWithLLM = async (query: string): Promise<QueryClassification> => {
    const prompt = `Classify this email search query and extract relevant entities.

Query: "${query}"

Return a JSON object with:
{
  "intent": "structured" | "semantic" | "hybrid" | "aggregation",
  "entities": {
    "vendor": "aws|stripe|google|microsoft|github|slack|zoom|vercel|heroku|digitalocean" or null,
    "sender": "email or name" or null,
    "dateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } or null,
    "month": "YYYY-MM" or null,
    "count": number or null,
    "emailType": "invoice|receipt|support|personal|notification|marketing" or null,
    "isInvoice": true|false or null,
    "keywords": ["relevant", "search", "terms"]
  }
}

Intent meanings:
- structured: queries about recency, counts, specific senders (use metadata filters)
- semantic: queries about content/topics (use vector search)
- hybrid: queries needing both filters and content search
- aggregation: queries needing calculations (totals, counts)

Today's date is: ${new Date().toISOString().split('T')[0]}`;

    try {
        const result = await OpenRouterService.generateJSON(prompt);

        // Build filters from extracted entities
        const filters: PineconeFilter = {};
        if (result.entities?.vendor) filters.vendor = result.entities.vendor;
        if (result.entities?.isInvoice) filters.isInvoice = result.entities.isInvoice;
        if (result.entities?.month) filters.month = result.entities.month;
        if (result.entities?.dateRange) {
            filters.dateGte = result.entities.dateRange.start;
            filters.dateLte = result.entities.dateRange.end;
        }

        const needsSort = result.intent === 'structured' || result.intent === 'aggregation';

        return {
            intent: result.intent || 'semantic',
            entities: {
                vendor: result.entities?.vendor || null,
                sender: result.entities?.sender || null,
                dateRange: result.entities?.dateRange || null,
                month: result.entities?.month || null,
                count: result.entities?.count || null,
                emailType: result.entities?.emailType || null,
                isInvoice: result.entities?.isInvoice || null,
                keywords: result.entities?.keywords || [],
            },
            filters,
            requiresSort: needsSort,
            sortField: needsSort ? 'timestamp' : null,
            sortOrder: needsSort ? 'desc' : null,
            confidence: 0.7,  // LLM classification has lower confidence
        };
    } catch (error) {
        logger.error('[QueryClassifier] LLM classification failed:', error);
        // Fallback to semantic search
        return {
            intent: 'semantic',
            entities: {
                vendor: null,
                sender: null,
                dateRange: null,
                month: null,
                count: null,
                emailType: null,
                isInvoice: null,
                keywords: query.split(/\s+/).filter(w => w.length > 3),
            },
            filters: {},
            requiresSort: false,
            sortField: null,
            sortOrder: null,
            confidence: 0.5,
        };
    }
};

/**
 * Main classification function
 * Tries rule-based first, falls back to LLM for complex queries
 */
export const classifyQuery = async (query: string): Promise<QueryClassification> => {
    logger.info(`[QueryClassifier] Classifying: "${query}"`);

    // Try rule-based classification first (faster, more reliable)
    const ruleResult = classifyByRules(query);
    if (ruleResult) {
        logger.info(`[QueryClassifier] Rule-based: ${ruleResult.intent} (confidence: ${ruleResult.confidence})`);
        return ruleResult;
    }

    // Fall back to LLM for complex queries
    logger.info('[QueryClassifier] Using LLM for complex query');
    const llmResult = await classifyWithLLM(query);
    logger.info(`[QueryClassifier] LLM result: ${llmResult.intent} (confidence: ${llmResult.confidence})`);

    return llmResult;
};

export const queryClassifierService = {
    classifyQuery,
    extractCount,
    extractVendor,
    extractDateRange,
};
