import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { z } from 'zod';
import logger from '../utils/logger.js';

// ============================================================================
// ZOD VALIDATION SCHEMAS - Type-safe request validation
// ============================================================================

const CreateModelSchema = z.object({
    modelId: z.string()
        .min(3, 'Model ID must be at least 3 characters')
        .regex(/^[a-z0-9\-\/\.]+(:free)?$/i, 'Invalid OpenRouter model ID format'),
    displayName: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    isActive: z.boolean().default(true),
});

const UpdateModelSchema = z.object({
    displayName: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
});

// Type exports for reuse
export type CreateModelInput = z.infer<typeof CreateModelSchema>;
export type UpdateModelInput = z.infer<typeof UpdateModelSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the default model ID from database or environment
 * Priority: 1. DB isDefault=true, 2. DEFAULT_AI_MODEL env, 3. FALLBACK_AI_MODEL env
 */
export const getDefaultModelId = async (): Promise<string> => {
    const defaultModel = await prisma.aIModel.findFirst({
        where: { isDefault: true, isActive: true },
        select: { modelId: true },
    });

    return (
        defaultModel?.modelId ||
        process.env.DEFAULT_AI_MODEL ||
        process.env.FALLBACK_AI_MODEL ||
        ''
    );
};

/**
 * Get all active model IDs for validation
 */
export const getActiveModelIds = async (): Promise<string[]> => {
    const models = await prisma.aIModel.findMany({
        where: { isActive: true },
        select: { modelId: true },
    });
    return models.map((m: { modelId: string }) => m.modelId);
};

// ============================================================================
// PUBLIC ENDPOINTS - For authenticated users
// ============================================================================

/**
 * GET /api/models
 * Returns all active models for user selection
 */
export const getActiveModels = async (_req: Request, res: Response) => {
    try {
        const models = await prisma.aIModel.findMany({
            where: { isActive: true },
            select: {
                id: true,
                modelId: true,
                displayName: true,
                description: true,
                isDefault: true,
            },
            orderBy: [
                { isDefault: 'desc' },
                { displayName: 'asc' },
            ],
        });

        res.status(200).json({ models });
    } catch (error) {
        logger.error('Error fetching models:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
};

// ============================================================================
// ADMIN ENDPOINTS - For admin model management
// ============================================================================

/**
 * GET /api/admin/models
 * Returns all models with full metadata for admin management
 */
export const getAllModelsAdmin = async (_req: Request, res: Response) => {
    try {
        const models = await prisma.aIModel.findMany({
            orderBy: [
                { isDefault: 'desc' },
                { isActive: 'desc' },
                { displayName: 'asc' },
            ],
        });

        res.status(200).json({ models });
    } catch (error) {
        logger.error('Error fetching models for admin:', error);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
};

/**
 * POST /api/admin/models
 * Create a new AI model
 */
export const createModel = async (req: Request, res: Response) => {
    try {
        const validation = CreateModelSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const { modelId, displayName, description, isActive } = validation.data;

        // Check if model already exists
        const existing = await prisma.aIModel.findUnique({
            where: { modelId },
        });

        if (existing) {
            return res.status(409).json({ error: 'Model with this ID already exists' });
        }

        const model = await prisma.aIModel.create({
            data: {
                modelId,
                displayName,
                description,
                isActive,
            },
        });

        logger.info(`✅ Admin created new model: ${modelId}`);
        res.status(201).json({ model });
    } catch (error) {
        logger.error('Error creating model:', error);
        res.status(500).json({ error: 'Failed to create model' });
    }
};

/**
 * PUT /api/admin/models/:id
 * Update an existing model
 */
export const updateModel = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid model ID' });
        }

        const validation = UpdateModelSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.error.flatten().fieldErrors,
            });
        }

        const model = await prisma.aIModel.update({
            where: { id },
            data: validation.data,
        });

        logger.info(`✅ Admin updated model: ${model.modelId}`);
        res.status(200).json({ model });
    } catch (error: any) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Model not found' });
        }
        logger.error('Error updating model:', error);
        res.status(500).json({ error: 'Failed to update model' });
    }
};

/**
 * DELETE /api/admin/models/:id
 * Delete a model (cannot delete default model)
 */
export const deleteModel = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid model ID' });
        }

        // Check if this is the default model
        const model = await prisma.aIModel.findUnique({
            where: { id },
        });

        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }

        if (model.isDefault) {
            return res.status(400).json({
                error: 'Cannot delete the default model. Set another model as default first.',
            });
        }

        await prisma.aIModel.delete({
            where: { id },
        });

        logger.info(`✅ Admin deleted model: ${model.modelId}`);
        res.status(200).json({ success: true, deletedId: id });
    } catch (error) {
        logger.error('Error deleting model:', error);
        res.status(500).json({ error: 'Failed to delete model' });
    }
};

/**
 * PUT /api/admin/models/:id/set-default
 * Set a model as the platform default
 */
export const setDefaultModel = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid model ID' });
        }

        // Verify model exists and is active
        const model = await prisma.aIModel.findUnique({
            where: { id },
        });

        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }

        if (!model.isActive) {
            return res.status(400).json({ error: 'Cannot set inactive model as default' });
        }

        // Transaction: unset all defaults, then set the new one
        await prisma.$transaction([
            prisma.aIModel.updateMany({
                where: { isDefault: true },
                data: { isDefault: false },
            }),
            prisma.aIModel.update({
                where: { id },
                data: { isDefault: true },
            }),
        ]);

        logger.info(`✅ Admin set default model: ${model.modelId}`);
        res.status(200).json({
            success: true,
            defaultModelId: model.modelId,
        });
    } catch (error) {
        logger.error('Error setting default model:', error);
        res.status(500).json({ error: 'Failed to set default model' });
    }
};
