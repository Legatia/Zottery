/**
 * Zottery Backend Server
 *
 * Main entry point for the anonymous lottery backend.
 */

import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Database } from './database';
import { ZcashService } from './services/zcash';
import { TicketService } from './services/tickets';
import { DrawService } from './services/draws';
import { ClaimService } from './services/claims';
import { createApiRouter } from './api';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  console.log('🎫 Starting Zottery Backend...');

  // Initialize database
  const db = new Database(process.env.DATABASE_PATH || './data/zottery.db');
  await db.initialize();
  console.log('✅ Database initialized');

  // Initialize services
  const zcashService = new ZcashService({
    rpcUrl: process.env.ZCASH_RPC_URL || 'http://localhost:8232',
    rpcUser: process.env.ZCASH_RPC_USER || 'zcash',
    rpcPassword: process.env.ZCASH_RPC_PASSWORD || 'password',
    lotteryAddress: process.env.LOTTERY_TRANSPARENT_ADDRESS || '',
  });
  console.log('✅ Zcash service initialized');

  const ticketService = new TicketService(db, zcashService);
  const drawService = new DrawService(db);
  const claimService = new ClaimService(db, zcashService, drawService, ticketService);

  // Initialize claim service (loads ZKP verification key)
  await claimService.initialize();
  console.log('✅ Business services initialized');

  // Create Express app
  const app: Express = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', createApiRouter({
    ticketService,
    drawService,
    claimService,
    zcashService,
  }));

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
  });

  // Start server
  app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📡 API endpoint: http://${HOST}:${PORT}/api`);
  });

  // Start background jobs
  startBackgroundJobs(ticketService, drawService, claimService);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await db.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await db.close();
    process.exit(0);
  });
}

/**
 * Start background jobs for monitoring and automation
 */
function startBackgroundJobs(
  ticketService: TicketService,
  drawService: DrawService,
  claimService: ClaimService
) {
  // Monitor Zcash blockchain for ticket purchases
  setInterval(async () => {
    try {
      await ticketService.processIncomingTransactions();
    } catch (error) {
      console.error('Error processing transactions:', error);
    }
  }, 30000); // Every 30 seconds

  // Check if draws need to be executed
  setInterval(async () => {
    try {
      await drawService.checkAndExecutePendingDraws();
    } catch (error) {
      console.error('Error checking pending draws:', error);
    }
  }, 60000); // Every minute

  // Process pending claims
  setInterval(async () => {
    try {
      await claimService.processPendingClaims();
    } catch (error) {
      console.error('Error processing claims:', error);
    }
  }, 45000); // Every 45 seconds

  console.log('✅ Background jobs started');
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
