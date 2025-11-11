/**
 * API Router
 *
 * Defines all API endpoints for the Zottery backend.
 */

import express, { Router, Request, Response } from 'express';
import { TicketService } from '../services/tickets';
import { DrawService } from '../services/draws';
import { ClaimService } from '../services/claims';
import { ZcashService } from '../services/zcash';
import {
  PurchaseTicketRequest,
  PurchaseTicketResponse,
  GetTicketRequest,
  GetTicketResponse,
  GetDrawRequest,
  GetDrawResponse,
  CheckNumbersRequest,
  CheckNumbersResponse,
  SubmitClaimRequest,
  SubmitClaimResponse,
  GetClaimStatusRequest,
  GetClaimStatusResponse,
} from '@zottery/shared';

interface Services {
  ticketService: TicketService;
  drawService: DrawService;
  claimService: ClaimService;
  zcashService: ZcashService;
}

export function createApiRouter(services: Services): Router {
  const router = Router();
  const { ticketService, drawService, claimService, zcashService } = services;

  // ============================================================================
  // Draw Endpoints
  // ============================================================================

  /**
   * GET /api/draw/current
   * Get current active draw
   */
  router.get('/draw/current', async (req: Request, res: Response) => {
    try {
      const draw = drawService.getCurrentDraw();

      if (!draw) {
        return res.json({
          success: false,
          error: 'No active draw',
        } as GetDrawResponse);
      }

      res.json({
        success: true,
        draw: {
          drawId: draw.drawId,
          status: draw.status,
          salesCloseDate: draw.salesCloseDate.toISOString(),
          drawDate: draw.drawDate.toISOString(),
          ticketsSold: draw.ticketsSold,
          prizePool: draw.prizePool,
          winningNumbers: draw.status === 'drawn' || draw.status === 'completed' ? draw.winningNumbers : undefined,
          prizesDistributed: draw.status === 'drawn' || draw.status === 'completed' ? draw.prizesDistributed : undefined,
        },
      } as GetDrawResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as GetDrawResponse);
    }
  });

  /**
   * GET /api/draw/:drawId
   * Get specific draw by ID
   */
  router.get('/draw/:drawId', async (req: Request, res: Response) => {
    try {
      const drawId = parseInt(req.params.drawId);

      if (isNaN(drawId)) {
        return res.json({
          success: false,
          error: 'Invalid draw ID',
        } as GetDrawResponse);
      }

      const draw = drawService.getDraw(drawId);

      if (!draw) {
        return res.json({
          success: false,
          error: 'Draw not found',
        } as GetDrawResponse);
      }

      res.json({
        success: true,
        draw: {
          drawId: draw.drawId,
          status: draw.status,
          salesCloseDate: draw.salesCloseDate.toISOString(),
          drawDate: draw.drawDate.toISOString(),
          ticketsSold: draw.ticketsSold,
          prizePool: draw.prizePool,
          winningNumbers: draw.status === 'drawn' || draw.status === 'completed' ? draw.winningNumbers : undefined,
          prizesDistributed: draw.status === 'drawn' || draw.status === 'completed' ? draw.prizesDistributed : undefined,
        },
      } as GetDrawResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as GetDrawResponse);
    }
  });

  /**
   * GET /api/draws
   * Get all draws (paginated)
   */
  router.get('/draws', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const draws = drawService.getAllDraws(limit, offset);

      res.json({
        success: true,
        draws: draws.map(draw => ({
          drawId: draw.drawId,
          status: draw.status,
          salesCloseDate: draw.salesCloseDate.toISOString(),
          drawDate: draw.drawDate.toISOString(),
          ticketsSold: draw.ticketsSold,
          prizePool: draw.prizePool,
          winningNumbers: draw.status === 'drawn' || draw.status === 'completed' ? draw.winningNumbers : undefined,
          prizesDistributed: draw.status === 'drawn' || draw.status === 'completed' ? draw.prizesDistributed : undefined,
        })),
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // Ticket Endpoints
  // ============================================================================

  /**
   * GET /api/lottery/address
   * Get the lottery address for ticket purchases
   */
  router.get('/lottery/address', (req: Request, res: Response) => {
    res.json({
      success: true,
      address: zcashService.getLotteryAddress(),
    });
  });

  /**
   * GET /api/ticket/:ticketHash
   * Get ticket information
   */
  router.get('/ticket/:ticketHash', (req: Request, res: Response) => {
    try {
      const { ticketHash } = req.params;

      const ticket = ticketService.getTicket(ticketHash);

      if (!ticket) {
        return res.json({
          success: false,
          error: 'Ticket not found',
        } as GetTicketResponse);
      }

      res.json({
        success: true,
        ticket: {
          ticketHash: ticket.ticketHash,
          numbers: ticket.numbers,
          drawId: ticket.drawId,
          purchaseTxId: ticket.purchaseTxId,
          createdAt: ticket.createdAt.toISOString(),
        },
      } as GetTicketResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as GetTicketResponse);
    }
  });

  /**
   * POST /api/ticket/purchase
   * Purchase a ticket (after payment is made)
   *
   * Note: In production, this endpoint might not be needed as tickets
   * are automatically created when payments are detected on-chain.
   * This is useful for development/testing.
   */
  router.post('/ticket/purchase', async (req: Request, res: Response) => {
    try {
      const request = req.body as PurchaseTicketRequest;

      // Verify transaction exists and is valid
      const tx = await zcashService.getTransaction(request.txId);
      if (!tx) {
        return res.json({
          success: false,
          error: 'Transaction not found',
        } as PurchaseTicketResponse);
      }

      // Create ticket
      const { ticket, claimKey } = await ticketService.purchaseTicket(
        request.txId,
        request.fromAddress,
        tx.amount,
        request.numbers
      );

      res.json({
        success: true,
        ticket: {
          ticketHash: ticket.ticketHash,
          numbers: ticket.numbers,
          salt: ticket.salt,
          claimKey,
          drawId: ticket.drawId,
        },
      } as PurchaseTicketResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as PurchaseTicketResponse);
    }
  });

  /**
   * POST /api/numbers/check
   * Check if numbers are winners
   */
  router.post('/numbers/check', (req: Request, res: Response) => {
    try {
      const request = req.body as CheckNumbersRequest;

      const { matches, prizeAmount } = drawService.checkNumbers(request.numbers, request.drawId);

      res.json({
        success: true,
        matches,
        isWinner: matches >= 3,
        prizeAmount: matches >= 3 ? prizeAmount : 0,
      } as CheckNumbersResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as CheckNumbersResponse);
    }
  });

  // ============================================================================
  // Claim Endpoints
  // ============================================================================

  /**
   * POST /api/claim/submit
   * Submit a prize claim with ZK proof
   */
  router.post('/claim/submit', async (req: Request, res: Response) => {
    try {
      const request = req.body as SubmitClaimRequest;

      const claimId = await claimService.submitClaim(
        request.drawId,
        request.prizeMatches,
        request.nullifier,
        request.zkProof,
        request.recipientAddress
      );

      res.json({
        success: true,
        claimId,
        estimatedPayoutTime: 'Within 1 hour',
      } as SubmitClaimResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as SubmitClaimResponse);
    }
  });

  /**
   * GET /api/claim/:claimId
   * Get claim status
   */
  router.get('/claim/:claimId', (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;

      const claim = claimService.getClaim(claimId);

      if (!claim) {
        return res.json({
          success: false,
          error: 'Claim not found',
        } as GetClaimStatusResponse);
      }

      res.json({
        success: true,
        claim: {
          claimId: claim.claimId,
          status: claim.status,
          prizeAmount: claim.prizeAmount,
          payoutTxId: claim.payoutTxId,
          claimedAt: claim.claimedAt.toISOString(),
          paidOutAt: claim.paidOutAt?.toISOString(),
        },
      } as GetClaimStatusResponse);
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      } as GetClaimStatusResponse);
    }
  });

  /**
   * GET /api/claim/nullifier/:nullifier
   * Check if nullifier has been used
   */
  router.get('/claim/nullifier/:nullifier', (req: Request, res: Response) => {
    try {
      const { nullifier } = req.params;

      const claim = claimService.getClaimByNullifier(nullifier);

      if (!claim) {
        return res.json({
          success: true,
          used: false,
        });
      }

      res.json({
        success: true,
        used: true,
        claim: {
          claimId: claim.claimId,
          status: claim.status,
          prizeAmount: claim.prizeAmount,
          claimedAt: claim.claimedAt.toISOString(),
        },
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

  // ============================================================================
  // Development/Testing Endpoints
  // ============================================================================

  /**
   * POST /api/dev/verify-ticket
   * Verify ticket can claim (without ZKP) - for development
   */
  router.post('/api/dev/verify-ticket', (req: Request, res: Response) => {
    try {
      const { ticketNumbers, salt, claimKey, drawId } = req.body;

      const result = claimService.verifyTicketCanClaim(
        ticketNumbers,
        salt,
        claimKey,
        drawId
      );

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/dev/execute-draw
   * Manually execute a draw - for development
   */
  router.post('/api/dev/execute-draw', async (req: Request, res: Response) => {
    try {
      const { drawId } = req.body;

      const draw = await drawService.executeDraw(drawId);

      res.json({
        success: true,
        draw: {
          drawId: draw.drawId,
          winningNumbers: draw.winningNumbers,
          prizesDistributed: draw.prizesDistributed,
        },
      });
    } catch (error: any) {
      res.json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
}
