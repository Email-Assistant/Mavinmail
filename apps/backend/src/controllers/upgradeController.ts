import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';

// Hardcoded promo codes (simulated payment for final year project)
const PROMO_CODES = {
    PRO: 'MAVIN-PRO-2026',
    TOPUP: 'MAVIN-TOPUP-2026',
} as const;

/**
 * POST /api/upgrade/pro
 * Body: { code: string }
 * Verifies promo code, sets plan=PRO, adds 10,000 credits.
 */
export const upgradeToPro = async (req: Request, res: Response) => {
    const userId = (req.user as any)?.userId;
    if (!userId) throw new AppError('User not authenticated', 401);

    const { code } = req.body;

    if (!code || code.trim() !== PROMO_CODES.PRO) {
        return res.status(400).json({
            error: 'Invalid promo code. Please enter a valid upgrade code.',
        });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                plan: 'PRO',
                credits: { increment: 10000 },
            },
            select: { id: true, email: true, plan: true, credits: true },
        });

        logger.info(`User ${userId} upgraded to PRO via promo code. Credits: ${updatedUser.credits}`);
        res.status(200).json({
            message: 'Successfully upgraded to PRO plan! 10,000 credits added.',
            credits: updatedUser.credits,
            plan: updatedUser.plan,
        });
    } catch (error) {
        logger.error('Error upgrading to PRO:', error);
        throw new AppError('Failed to process upgrade', 500);
    }
};

/**
 * POST /api/upgrade/top-up
 * Body: { code: string }
 * Verifies promo code, adds 1,000 credits.
 */
export const topUpCredits = async (req: Request, res: Response) => {
    const userId = (req.user as any)?.userId;
    if (!userId) throw new AppError('User not authenticated', 401);

    const { code } = req.body;

    if (!code || code.trim() !== PROMO_CODES.TOPUP) {
        return res.status(400).json({
            error: 'Invalid top-up code. Please enter a valid top-up code.',
        });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                credits: { increment: 1000 },
            },
            select: { id: true, email: true, plan: true, credits: true },
        });

        logger.info(`User ${userId} topped up credits via promo code. Credits: ${updatedUser.credits}`);
        res.status(200).json({
            message: 'Successfully topped up 1,000 credits!',
            credits: updatedUser.credits,
            plan: updatedUser.plan,
        });
    } catch (error) {
        logger.error('Error topping up credits:', error);
        throw new AppError('Failed to process top-up', 500);
    }
};
