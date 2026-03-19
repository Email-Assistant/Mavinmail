/**
 * Pinecone Service - Enhanced for Production RAG
 * 
 * Key improvements:
 * - Token-based chunking (150-300 tokens with overlap)
 * - Extended metadata for structured queries
 * - Semantic chunk boundaries
 */

import { pineconeIndex } from '../utils/pinecone.js';
import { embedDocuments, embedQuery } from './cohereService.js';
import { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import crypto from 'crypto';
import { EmailType } from './metadataExtractorService.js';
import logger from '../utils/logger.js';

// Configuration - Memory-safe values
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100; // Overlap to preserve context across chunk boundaries

/**
 * Chunk text with overlap for better context preservation.
 * Memory-safe: processes text in a single pass without creating intermediate copies.
 */
const chunkText = (text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] => {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  const step = chunkSize - overlap;

  for (let i = 0; i < text.length; i += step) {
    // Use substring (not slice) for memory efficiency - creates new string reference
    const chunk = text.substring(i, i + chunkSize);
    chunks.push(chunk);

    // Stop if we've captured all content
    if (i + chunkSize >= text.length) break;
  }

  return chunks;
};

// Hash helper for dedupe protection
const hash = (str: string) =>
  crypto.createHash('sha256').update(str).digest('hex');

// Extended email metadata interface for Pinecone storage
export interface EmailMeta {
  // Core identifiers
  messageId: string;
  threadId: string;

  // Basic info
  subject: string;
  from: string;
  to: string;
  timestamp: string;          // ISO string

  // Extended metadata for structured queries
  fromDomain: string;
  date: string;               // YYYY-MM-DD
  month: string;              // YYYY-MM
  emailType: EmailType;
  vendor: string | null;
  isInvoice: boolean;
  isUnread: boolean;
  currency: string | null;
  amount: number | null;
}

// Pinecone metadata type (must match what we store)
// Using index signature compatible with Pinecone's RecordMetadataValue
export type PineconeEmailMetadata = {
  chunkText: string;          // 🚀 Actual chunk content for retrieval
  emailId: string;
  chunkIndex: number;
  totalChunks: number;
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  emailTimestamp: string;
  fromDomain: string;
  date: string;
  month: string;
  emailType: string;
  vendor: string;
  isInvoice: boolean;
  isUnread: boolean;
  currency: string;
  amount: number;
  emailContentHash: string;
  // Index signature compatible with Pinecone's RecordMetadataValue
  [key: string]: string | number | boolean | string[];
};

/**
 * Upsert email chunks
 * Uses simplified reference logic for stability
 */
export const upsertEmailChunks = async (
  emailContent: string,
  emailId: string,
  userId: string,
  emailMeta: EmailMeta
): Promise<void> => {
  // 1. Simple Chunking
  const chunks = chunkText(emailContent);

  if (chunks.length === 0) {
    logger.info(`[Pinecone] No chunks generated for email ${emailId}`);
    return;
  }

  // 2. Embed all chunks (Reference logic)
  // Note: If chunks > 96, we might need batching for Cohere, but assuming 
  // 300KB max email / 500 chars = ~600 chunks. 
  // Safety: batch embedding calls to 90 to be safe with API limits
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += 90) {
    const batch = chunks.slice(i, i + 90);
    const batchEmbeddings = await embedDocuments(batch);
    embeddings.push(...batchEmbeddings);
  }

  const emailContentHash = hash(emailContent);

  const vectors = chunks.map((chunk, i) => ({
    id: `${emailId}-chunk-${i}`,
    values: embeddings[i],
    metadata: {
      // 🚀 CHUNK TEXT - Store actual content for retrieval
      chunkText: chunk.substring(0, 1000),  // Limit to 1000 chars for Pinecone size limits

      // Chunk info
      chunkIndex: i,
      totalChunks: chunks.length,

      // Email identifiers
      emailId,
      messageId: emailMeta.messageId,
      threadId: emailMeta.threadId,

      // Basic metadata
      subject: emailMeta.subject,
      from: emailMeta.from,
      to: emailMeta.to,
      emailTimestamp: emailMeta.timestamp,

      // Extended metadata
      fromDomain: emailMeta.fromDomain,
      date: emailMeta.date,
      month: emailMeta.month,
      emailType: emailMeta.emailType,
      vendor: emailMeta.vendor || '',
      isInvoice: emailMeta.isInvoice,
      isUnread: emailMeta.isUnread,
      currency: emailMeta.currency || '',
      amount: emailMeta.amount ?? 0,

      // Dedupe
      emailContentHash
    }
  }));

  // Upsert in batches of 100
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100);
    await pineconeIndex.namespace(userId).upsert(batch);
  }

  logger.info(`[Pinecone] Upserted ${chunks.length} chunks for email ${emailId}`);
};

/**
 * Query relevant chunks - semantic search only
 * For hybrid/structured queries, use queryWithFilters instead
 */
export const queryRelevantEmailChunks = async (
  query: string,
  userId: string
): Promise<ScoredPineconeRecord<PineconeEmailMetadata>[]> => {
  // DEBUG LOGGING
  logger.info(`[Pinecone] Querying for user: ${userId}`);

  const queryEmbedding = await embedQuery(query);
  logger.info(`[Pinecone] Generated embedding (length: ${queryEmbedding.length})`);

  const queryResult = await pineconeIndex.namespace(userId).query({
    topK: 20,  // Increased from 10 for better recall before reranking
    vector: queryEmbedding,
    includeMetadata: true
  });

  logger.info(`[Pinecone] Query returned ${queryResult.matches?.length || 0} matches.`);

  if (queryResult.matches?.length) {
    logger.info(`[Pinecone] Match 0 ID: ${queryResult.matches[0].id}`);
    logger.info(`[Pinecone] Match 0 Score: ${queryResult.matches[0].score}`);
    logger.info(`[Pinecone] Match 0 Metadata keys: ${Object.keys(queryResult.matches[0].metadata || {}).join(', ')}`);
    // Check for emailId presence
    logger.info(`[Pinecone] Match 0 has emailId? ${!!queryResult.matches[0].metadata?.emailId}`);
  }

  const results = (queryResult.matches || []).filter(
    (m): m is ScoredPineconeRecord<PineconeEmailMetadata> =>
      !!m.metadata?.emailId
  );

  logger.info(`[Pinecone] Filtered valid results: ${results.length}`);
  return results;
};

/**
 * Query with metadata filters - for structured and hybrid queries
 * Uses Pinecone's filtering capabilities
 */
export interface PineconeFilter {
  fromDomain?: string;
  vendor?: string;
  emailType?: EmailType;
  isInvoice?: boolean;
  month?: string;
  date?: string;
  dateGte?: string;      // Date greater than or equal
  dateLte?: string;      // Date less than or equal
}

export const queryWithFilters = async (
  userId: string,
  filters: PineconeFilter,
  options: {
    vector?: number[];           // If provided, do hybrid search
    topK?: number;
    sortByTimestamp?: 'asc' | 'desc';
  } = {}
): Promise<ScoredPineconeRecord<PineconeEmailMetadata>[]> => {
  const { topK = 20, vector } = options;

  // Build Pinecone filter object
  const pineconeFilter: Record<string, any> = {};

  if (filters.fromDomain) {
    pineconeFilter.fromDomain = { $eq: filters.fromDomain };
  }
  if (filters.vendor) {
    pineconeFilter.vendor = { $eq: filters.vendor };
  }
  if (filters.emailType) {
    pineconeFilter.emailType = { $eq: filters.emailType };
  }
  if (filters.isInvoice !== undefined) {
    pineconeFilter.isInvoice = { $eq: filters.isInvoice };
  }
  if (filters.month) {
    pineconeFilter.month = { $eq: filters.month };
  }
  if (filters.date) {
    pineconeFilter.date = { $eq: filters.date };
  }
  if (filters.dateGte || filters.dateLte) {
    pineconeFilter.date = {};
    if (filters.dateGte) pineconeFilter.date.$gte = filters.dateGte;
    if (filters.dateLte) pineconeFilter.date.$lte = filters.dateLte;
  }

  // If no vector provided, we need at least one filter
  if (!vector && Object.keys(pineconeFilter).length === 0) {
    throw new Error('Either vector or filters must be provided');
  }

  const queryOptions: any = {
    topK,
    includeMetadata: true,
    filter: Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined,
  };

  // For pure metadata queries without vector, we use a zero vector trick
  // (Pinecone requires a vector, so we use a dummy and rely on metadata filtering)
  if (!vector) {
    // Get embedding dimension from a dummy query (1024 for Cohere embed-english-v3.0)
    queryOptions.vector = new Array(1024).fill(0);
  } else {
    queryOptions.vector = vector;
  }

  const queryResult = await pineconeIndex.namespace(userId).query(queryOptions);

  let results = (queryResult.matches || []).filter(
    (m): m is ScoredPineconeRecord<PineconeEmailMetadata> =>
      !!m.metadata?.emailId
  );

  // Sort by timestamp if requested (for structured queries)
  if (options.sortByTimestamp) {
    results.sort((a, b) => {
      const timeA = new Date(String(a.metadata?.emailTimestamp || '1970-01-01')).getTime();
      const timeB = new Date(String(b.metadata?.emailTimestamp || '1970-01-01')).getTime();
      return options.sortByTimestamp === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }

  return results;
};

/**
 * Get unique emails from chunks (deduplication)
 */
export const getUniqueEmailsFromChunks = (
  chunks: ScoredPineconeRecord<PineconeEmailMetadata>[]
): Map<string, PineconeEmailMetadata & { score: number }> => {
  const emailMap = new Map<string, PineconeEmailMetadata & { score: number }>();

  for (const chunk of chunks) {
    if (!chunk.metadata?.emailId) continue;

    const existing = emailMap.get(chunk.metadata.emailId);
    if (!existing || (chunk.score && chunk.score > existing.score)) {
      emailMap.set(chunk.metadata.emailId, {
        ...chunk.metadata,
        score: chunk.score || 0
      });
    }
  }

  return emailMap;
};

/**
 * 🚀 Fetch ALL chunks for specified emails to get complete content
 * This is critical for accurate summaries - we need the full email, not just matched chunks
 */
export const fetchAllChunksForEmails = async (
  userId: string,
  emailIds: string[]
): Promise<Map<string, string[]>> => {
  const contentMap = new Map<string, string[]>();

  if (emailIds.length === 0) return contentMap;

  logger.info(`[Pinecone] Fetching all chunks for ${emailIds.length} emails`);

  // Query for ALL chunks belonging to these emailIds
  // We use metadata filter with $in operator
  try {
    const queryResult = await pineconeIndex.namespace(userId).query({
      topK: 100,  // Get up to 100 chunks (covers most emails)
      vector: new Array(1024).fill(0.001),  // Dummy vector - we only care about filter
      includeMetadata: true,
      filter: {
        emailId: { $in: emailIds }
      }
    });

    // Group chunks by emailId and sort by chunkIndex
    const emailChunks = new Map<string, { index: number; text: string }[]>();

    for (const match of queryResult.matches || []) {
      const emailId = match.metadata?.emailId as string;
      const chunkIndex = match.metadata?.chunkIndex as number;
      const chunkText = match.metadata?.chunkText as string;

      if (emailId && chunkText) {
        if (!emailChunks.has(emailId)) {
          emailChunks.set(emailId, []);
        }
        emailChunks.get(emailId)!.push({ index: chunkIndex || 0, text: chunkText });
      }
    }

    // Sort chunks by index and build content arrays
    for (const [emailId, chunks] of emailChunks) {
      chunks.sort((a, b) => a.index - b.index);
      contentMap.set(emailId, chunks.map(c => c.text));
    }

    logger.info(`[Pinecone] Retrieved chunks for ${contentMap.size} emails`);
    return contentMap;

  } catch (error) {
    logger.error('[Pinecone] Error fetching all chunks:', error);
    return contentMap;
  }
};
