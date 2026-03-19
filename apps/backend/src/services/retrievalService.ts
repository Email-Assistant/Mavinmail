/**
 * Retrieval Service
 * 
 * Unified retrieval layer that routes queries to the appropriate strategy:
 * - Structured: metadata filtering + sorting (no embeddings)
 * - Semantic: vector search with optional pre-filtering
 * - Hybrid: metadata filter → vector search → rerank
 * - Aggregation: metadata filter + computation
 */

import { embedQuery } from './cohereService.js';
import { queryRelevantEmailChunks, queryWithFilters, getUniqueEmailsFromChunks, fetchAllChunksForEmails, PineconeFilter, PineconeEmailMetadata } from './pineconeService.js';
import { QueryClassification, QueryIntent } from './queryClassifierService.js';
import { getEmailById } from './emailService.js';
import { rerankResults } from './cohereService.js';
import { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import logger from '../utils/logger.js';

// Result types
export interface RetrievalResult {
    success: boolean;
    intent: QueryIntent;
    emailIds: string[];
    emails: RetrievedEmail[];
    aggregation?: AggregationResult;
    confidence: number;
    latencyMs: number;
}

export interface RetrievedEmail {
    emailId: string;
    subject: string;
    from: string;
    fromDomain: string;
    timestamp: string;
    content: string;
    score?: number;
    metadata: Partial<PineconeEmailMetadata>;
}

export interface AggregationResult {
    type: 'count' | 'sum' | 'list';
    value: number | null;
    items?: { emailId: string; amount: number; vendor: string; date: string }[];
}

/**
 * Structured retrieval - metadata only, no embeddings
 * Used for: "latest 5 emails", "emails from john", "invoices this month"
 */
const structuredRetrieval = async (
    userId: string,
    query: string,
    classification: QueryClassification
): Promise<{ chunks: ScoredPineconeRecord<PineconeEmailMetadata>[]; emailMap: Map<string, PineconeEmailMetadata & { score: number }> }> => {
    logger.info('[Retrieval] Structured query with filters:', classification.filters);

    const hasFilters = Object.keys(classification.filters).length > 0;

    // 🛑 FALLBACK: If classifier said "structured" but found no filters, force SEMANTIC search.
    if (!hasFilters) {
        logger.warn('[Retrieval] ⚠️ Structured intent but NO filters found. Falling back to semantic retrieval.');
        // Call semantic retrieval directly here
        return semanticRetrieval(userId, query, classification);
    }

    const chunks = await queryWithFilters(userId, classification.filters, {
        topK: classification.entities.count || 20,
        sortByTimestamp: classification.sortOrder || 'desc',
    });

    const emailMap = getUniqueEmailsFromChunks(chunks);
    return { chunks, emailMap };
};

/**
 * Semantic retrieval - vector search with optional pre-filtering + RERANKING
 * Used for: "what did AWS say about pricing", content-based questions
 */
const semanticRetrieval = async (
    userId: string,
    query: string,
    classification: QueryClassification
): Promise<{ chunks: ScoredPineconeRecord<PineconeEmailMetadata>[]; emailMap: Map<string, PineconeEmailMetadata & { score: number }> }> => {
    logger.info('[Retrieval] Semantic query');

    const hasFilters = Object.keys(classification.filters).length > 0;

    let chunks: ScoredPineconeRecord<PineconeEmailMetadata>[];

    if (hasFilters) {
        // Pre-filter then vector search
        logger.info('[Retrieval] With pre-filters:', classification.filters);
        const queryVector = await embedQuery(query);
        chunks = await queryWithFilters(userId, classification.filters, {
            vector: queryVector,
            topK: 20,
        });
    } else {
        // Pure vector search
        chunks = await queryRelevantEmailChunks(query, userId);
    }

    // 🚀 RERANKING STEP - Improve precision by reordering results
    if (chunks.length > 3) {
        logger.info(`[Retrieval] Reranking ${chunks.length} chunks...`);
        try {
            // Use chunkText + subject + from for better reranking relevance
            const documents = chunks.map(c => ({
                id: c.id || '',
                text: String(c.metadata?.chunkText || '') + ' | Subject: ' + String(c.metadata?.subject || '') + ' | From: ' + String(c.metadata?.from || ''),
            }));

            const reranked = await rerankResults(query, documents, 10);

            // Reorder chunks based on reranking
            const rerankedChunks: ScoredPineconeRecord<PineconeEmailMetadata>[] = [];
            for (const r of reranked) {
                const original = chunks.find(c => c.id === r.document.id);
                if (original) {
                    rerankedChunks.push({
                        ...original,
                        score: r.relevanceScore, // Use rerank score
                    });
                }
            }
            chunks = rerankedChunks.length > 0 ? rerankedChunks : chunks;
            logger.info(`[Retrieval] Reranked to ${chunks.length} chunks`);
        } catch (rerankError) {
            logger.warn('[Retrieval] Reranking failed, using original order:', rerankError);
        }
    }

    const emailMap = getUniqueEmailsFromChunks(chunks);
    return { chunks, emailMap };
};

/**
 * Hybrid retrieval - combines metadata filter with vector search and reranking
 * Used for: "any emails from Google about billing"
 */
const hybridRetrieval = async (
    userId: string,
    query: string,
    classification: QueryClassification
): Promise<{ chunks: ScoredPineconeRecord<PineconeEmailMetadata>[]; emailMap: Map<string, PineconeEmailMetadata & { score: number }> }> => {
    logger.info('[Retrieval] Hybrid query');

    // Step 1: Get filtered results with vector search
    const queryVector = await embedQuery(query);
    const chunks = await queryWithFilters(userId, classification.filters, {
        vector: queryVector,
        topK: 20,
    });

    const emailMap = getUniqueEmailsFromChunks(chunks);
    return { chunks, emailMap };
};

/**
 * Aggregation retrieval - for count/sum queries
 * Used for: "how many emails from AWS", "total invoice amount this month"
 */
const aggregationRetrieval = async (
    userId: string,
    classification: QueryClassification
): Promise<{ emailMap: Map<string, PineconeEmailMetadata & { score: number }>; aggregation: AggregationResult }> => {
    logger.info('[Retrieval] Aggregation query');

    const chunks = await queryWithFilters(userId, classification.filters, {
        topK: 100,  // Get more for aggregation
        sortByTimestamp: 'desc',
    });

    const emailMap = getUniqueEmailsFromChunks(chunks);

    // Calculate aggregation
    let aggregation: AggregationResult;

    if (classification.entities.isInvoice) {
        // Sum invoice amounts
        let total = 0;
        const items: { emailId: string; amount: number; vendor: string; date: string }[] = [];

        for (const [emailId, meta] of emailMap) {
            if (meta.isInvoice && meta.amount) {
                total += meta.amount;
                items.push({
                    emailId,
                    amount: meta.amount,
                    vendor: meta.vendor,
                    date: meta.date,
                });
            }
        }

        aggregation = {
            type: 'sum',
            value: total,
            items,
        };
    } else {
        // Count emails
        aggregation = {
            type: 'count',
            value: emailMap.size,
        };
    }

    return { emailMap, aggregation };
};

/**
 * Main retrieval function - routes to appropriate strategy
 */
export const executeRetrieval = async (
    userId: string,
    query: string,
    classification: QueryClassification
): Promise<RetrievalResult> => {
    const startTime = Date.now();
    logger.info(`[Retrieval] Executing ${classification.intent} retrieval for user ${userId}`);

    try {
        let emailMap: Map<string, PineconeEmailMetadata & { score: number }>;
        let chunks: ScoredPineconeRecord<PineconeEmailMetadata>[] = [];
        let aggregation: AggregationResult | undefined;

        // Route to appropriate retrieval strategy
        switch (classification.intent) {
            case 'structured':
                // Pass query for potential fallback
                ({ chunks, emailMap } = await structuredRetrieval(userId, query, classification));
                break;

            case 'semantic':
                ({ chunks, emailMap } = await semanticRetrieval(userId, query, classification));
                break;

            case 'hybrid':
                ({ chunks, emailMap } = await hybridRetrieval(userId, query, classification));
                break;

            case 'aggregation':
                ({ emailMap, aggregation } = await aggregationRetrieval(userId, classification));
                break;

            default:
                // Fallback to semantic
                ({ chunks, emailMap } = await semanticRetrieval(userId, query, classification));
        }

        // Apply count limit if specified
        let emailIds = Array.from(emailMap.keys());
        if (classification.entities.count && emailIds.length > classification.entities.count) {
            emailIds = emailIds.slice(0, classification.entities.count);
        }

        // 🚀 FETCH ALL CHUNKS FOR MATCHED EMAILS - Get complete email content!
        // Instead of using only matched chunks, fetch ALL chunks for these emails
        const topEmailIds = emailIds.slice(0, 5);  // Limit to 5 for context

        logger.info(`[Retrieval] Fetching complete content for ${topEmailIds.length} emails`);
        const allChunksMap = await fetchAllChunksForEmails(userId, topEmailIds);

        // Build result using complete email content from all chunks
        const emails: RetrievedEmail[] = [];
        for (const emailId of topEmailIds) {
            const meta = emailMap.get(emailId);
            if (!meta) continue;

            // Get ALL chunks for this email (sorted by chunkIndex)
            const allChunkTexts = allChunksMap.get(emailId) || [];
            const content = allChunkTexts.length > 0
                ? allChunkTexts.join(' ')  // Join all chunks for complete content
                : `Subject: ${meta.subject || 'No subject'}\nFrom: ${meta.from || 'Unknown'}\nDate: ${meta.date || 'Unknown'}`;

            emails.push({
                emailId,
                subject: String(meta.subject || ''),
                from: String(meta.from || ''),
                fromDomain: String(meta.fromDomain || ''),
                timestamp: String(meta.emailTimestamp || ''),
                content: content.substring(0, 8000),  // Allow more content for better summaries
                score: meta.score,
                metadata: meta,
            });
        }

        const latencyMs = Date.now() - startTime;
        logger.info(`[Retrieval] Found ${emails.length} emails in ${latencyMs}ms`);

        return {
            success: true,
            intent: classification.intent,
            emailIds,
            emails,
            aggregation,
            confidence: classification.confidence,
            latencyMs,
        };

    } catch (error) {
        logger.error('[Retrieval] Error:', error);
        return {
            success: false,
            intent: classification.intent,
            emailIds: [],
            emails: [],
            confidence: 0,
            latencyMs: Date.now() - startTime,
        };
    }
};

export const retrievalService = {
    executeRetrieval,
    structuredRetrieval,
    semanticRetrieval,
    hybridRetrieval,
    aggregationRetrieval,
};
