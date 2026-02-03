import { Request, Response } from 'express'; // Import the base Express types
import { AuthenticatedRequest } from '../middleware/authMiddleware.js'; // Keep importing our custom type
import prisma from '../utils/prisma.js';
import { getLatestMessageIds, getEmailById } from '../services/emailService.js';
import { upsertEmailChunks } from '../services/pineconeService.js';

// The function signature now uses the base Express `Request` type to satisfy the router.
export const syncEmails = async (req: Request, res: Response) => {
  // --- THIS IS THE FIX ---
  // We cast the generic 'req' to our specific 'AuthenticatedRequest' type.
  // This tells TypeScript: "Trust me, I know the 'authenticateToken' middleware
  // has already run and added the 'user' property to this request object."
  const authenticatedReq = req as AuthenticatedRequest;
  // -----------------------

  // Now, we use 'authenticatedReq' for the rest of the function to get type safety.
  if (!authenticatedReq.user?.userId) {
    return res.status(401).json({ message: 'Unauthorized: User ID missing from token.' });
  }

  const userId = authenticatedReq.user.userId; // This is a number, as expected.

  try {
    const connectedAccount = await prisma.connectedAccount.findFirst({
      where: { userId: Number(userId), provider: 'google' }
    });

    if (!connectedAccount?.refreshToken) {
      return res.status(401).json({ message: 'Google account refresh token not found.' });
    }

    // 🛑 REFACTOR: Sequential processing to prevent Heap OOM
    // 1. Get IDs first (lightweight)
    const messageIds = await getLatestMessageIds(Number(userId), 5);

    if (messageIds.length === 0) {
      return res.json({ message: 'No new emails found to sync.' });
    }

    const userNamespace = String(userId);
    let successCount = 0;

    // 2. Process one by one (Fetch -> Embed -> Save -> GC)
    for (const msgId of messageIds) {
      try {
        // Fetch single email with safety checks (size limit etc.)
        const email = await getEmailById(Number(userId), msgId);

        if (!email) {
          console.warn(`[Sync] Skipped email ${msgId} (returned null/too large)`);
          continue;
        }

        // Upsert vectors
        await upsertEmailChunks(
          email.cleanedContent,
          email.id,
          userNamespace,
          {
            // Core identifiers
            messageId: email.messageId,
            threadId: email.threadId,

            // Basic metadata
            subject: email.subject,
            from: email.from,
            to: email.to,
            timestamp: email.timestamp,

            // Extended metadata
            fromDomain: email.fromDomain,
            date: email.date,
            month: email.month,
            emailType: email.emailType,
            vendor: email.vendor,
            isInvoice: email.isInvoice,
            isUnread: email.isUnread,
            currency: email.currency,
            amount: email.amount,
          }
        );
        successCount++;

        // Explicitly clear references to help GC
        // (In JS loop scope, 'email' will be overwritten, but this mental model helps)
      } catch (innerError) {
        console.error(`[Sync] Error processing email ${msgId}:`, innerError);
      }
    }

    res.json({ message: `Successfully synced and indexed ${successCount} emails.` });

  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ message: "Failed to sync emails." });
  }
};