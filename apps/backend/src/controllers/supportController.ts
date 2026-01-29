import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import * as supportService from '../services/supportService.js';

// ============================================================================
// USER SUPPORT TICKET ENDPOINTS
// ============================================================================

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
export const createTicket = async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    try {
        const userId = authenticatedReq.user!.userId;
        const { title, description, source, priority } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                error: 'Title and description are required'
            });
        }

        // Validate source if provided
        const validSources = ['dashboard', 'extension'];
        if (source && !validSources.includes(source)) {
            return res.status(400).json({
                error: 'Invalid source',
                validSources
            });
        }

        // Validate priority if provided
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                error: 'Invalid priority',
                validPriorities
            });
        }

        const ticket = await supportService.createTicket({
            userId,
            title,
            description,
            source,
            priority,
        });

        res.status(201).json({
            message: 'Support ticket created successfully',
            ticket,
        });
    } catch (error: any) {
        console.error('Create ticket error:', error);
        res.status(500).json({ error: error.message || 'Failed to create ticket' });
    }
};

/**
 * GET /api/support/tickets
 * Get user's own tickets
 */
export const getUserTickets = async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    try {
        const userId = authenticatedReq.user!.userId;
        const { page, limit, status } = req.query;

        const result = await supportService.getUserTickets(userId, {
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
        });

        res.json(result);
    } catch (error: any) {
        console.error('Get user tickets error:', error);
        res.status(500).json({ error: error.message || 'Failed to get tickets' });
    }
};

/**
 * GET /api/support/tickets/:id
 * Get a specific ticket (user can only see their own)
 */
export const getTicketById = async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    try {
        const userId = authenticatedReq.user!.userId;
        const ticketId = parseInt(req.params.id);

        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const ticket = await supportService.getTicketById(ticketId);

        // Ensure user can only see their own tickets
        if (ticket.user.id !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(ticket);
    } catch (error: any) {
        console.error('Get ticket error:', error);
        if (error.message === 'Ticket not found') {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.status(500).json({ error: error.message || 'Failed to get ticket' });
    }
};

// ============================================================================
// ADMIN SUPPORT TICKET ENDPOINTS
// ============================================================================

/**
 * GET /api/admin/support-tickets
 * Get all support tickets (admin only)
 */
export const getAllTickets = async (req: Request, res: Response) => {
    try {
        const { page, limit, status, priority, source, search } = req.query;

        const result = await supportService.getAllTickets({
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            status: status as string,
            priority: priority as string,
            source: source as string,
            search: search as string,
        });

        res.json(result);
    } catch (error: any) {
        console.error('Get all tickets error:', error);
        res.status(500).json({ error: error.message || 'Failed to get tickets' });
    }
};

/**
 * GET /api/admin/support-tickets/:id
 * Get a specific ticket (admin only)
 */
export const getAdminTicketById = async (req: Request, res: Response) => {
    try {
        const ticketId = parseInt(req.params.id);

        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const ticket = await supportService.getTicketById(ticketId);
        res.json(ticket);
    } catch (error: any) {
        console.error('Get admin ticket error:', error);
        if (error.message === 'Ticket not found') {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.status(500).json({ error: error.message || 'Failed to get ticket' });
    }
};

/**
 * PUT /api/admin/support-tickets/:id
 * Update a support ticket (admin only)
 */
export const updateTicket = async (req: Request, res: Response) => {
    const authenticatedReq = req as AuthenticatedRequest;
    try {
        const adminId = authenticatedReq.user!.userId;
        const ticketId = parseInt(req.params.id);
        const { status, priority, adminNotes } = req.body;

        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        // Validate status if provided
        const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                validStatuses
            });
        }

        // Validate priority if provided
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        if (priority && !validPriorities.includes(priority)) {
            return res.status(400).json({
                error: 'Invalid priority',
                validPriorities
            });
        }

        const ticket = await supportService.updateTicket(ticketId, adminId, {
            status,
            priority,
            adminNotes,
        });

        res.json({
            message: 'Ticket updated successfully',
            ticket,
        });
    } catch (error: any) {
        console.error('Update ticket error:', error);
        if (error.message === 'Ticket not found') {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.status(500).json({ error: error.message || 'Failed to update ticket' });
    }
};

/**
 * GET /api/admin/support-tickets/stats
 * Get support ticket statistics (admin only)
 */
export const getTicketStats = async (req: Request, res: Response) => {
    try {
        const stats = await supportService.getTicketStats();
        res.json(stats);
    } catch (error: any) {
        console.error('Get ticket stats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get ticket stats' });
    }
};
