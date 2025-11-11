/**
 * Database Module
 *
 * Handles SQLite database operations for tickets, draws, and claims.
 */

import BetterSqlite3 from 'better-sqlite3';
import { Ticket, Draw, Claim, DrawStatus, ClaimStatus } from '@zottery/shared';
import path from 'path';
import fs from 'fs';

export class Database {
  private db: BetterSqlite3.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(this.dbPath);

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.createTables();

    console.log(`Database initialized at: ${this.dbPath}`);
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Draws table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS draws (
        draw_id INTEGER PRIMARY KEY AUTOINCREMENT,
        winning_numbers TEXT NOT NULL,
        draw_date TEXT NOT NULL,
        sales_close_date TEXT NOT NULL,
        tickets_sold INTEGER DEFAULT 0,
        prize_pool REAL DEFAULT 0,
        vrf_proof TEXT,
        status TEXT NOT NULL,
        prizes_distributed TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tickets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        ticket_hash TEXT PRIMARY KEY,
        numbers TEXT NOT NULL,
        salt TEXT NOT NULL,
        draw_id INTEGER NOT NULL,
        purchase_amount REAL NOT NULL,
        purchase_tx_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (draw_id) REFERENCES draws(draw_id)
      )
    `);

    // Create index on draw_id for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickets_draw_id ON tickets(draw_id)
    `);

    // Create index on purchase_tx_id for duplicate detection
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tickets_purchase_tx_id ON tickets(purchase_tx_id)
    `);

    // Claims table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS claims (
        claim_id TEXT PRIMARY KEY,
        nullifier TEXT UNIQUE NOT NULL,
        draw_id INTEGER NOT NULL,
        prize_matches INTEGER NOT NULL,
        prize_amount REAL NOT NULL,
        zk_proof TEXT NOT NULL,
        recipient_address TEXT NOT NULL,
        payout_tx_id TEXT,
        status TEXT NOT NULL,
        claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_out_at TEXT,
        FOREIGN KEY (draw_id) REFERENCES draws(draw_id)
      )
    `);

    // Create index on nullifier for fast duplicate check
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_claims_nullifier ON claims(nullifier)
    `);

    // Create index on draw_id for faster lookups
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_claims_draw_id ON claims(draw_id)
    `);

    // Pending transactions table (for monitoring incoming payments)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pending_transactions (
        tx_id TEXT PRIMARY KEY,
        from_address TEXT NOT NULL,
        amount REAL NOT NULL,
        confirmations INTEGER DEFAULT 0,
        detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT FALSE
      )
    `);
  }

  /**
   * Get database instance
   */
  getDb(): BetterSqlite3.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ============================================================================
  // Draw Operations
  // ============================================================================

  /**
   * Create a new draw
   */
  createDraw(draw: Omit<Draw, 'drawId'>): number {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO draws (
        winning_numbers, draw_date, sales_close_date, tickets_sold,
        prize_pool, vrf_proof, status, prizes_distributed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      JSON.stringify(draw.winningNumbers),
      draw.drawDate.toISOString(),
      draw.salesCloseDate.toISOString(),
      draw.ticketsSold,
      draw.prizePool,
      draw.vrfProof || null,
      draw.status,
      JSON.stringify(draw.prizesDistributed)
    );

    return result.lastInsertRowid as number;
  }

  /**
   * Get draw by ID
   */
  getDrawById(drawId: number): Draw | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM draws WHERE draw_id = ?');
    const row = stmt.get(drawId) as any;

    return row ? this.rowToDraw(row) : null;
  }

  /**
   * Get current active draw
   */
  getCurrentDraw(): Draw | null {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM draws
      WHERE status IN ('open', 'closed')
      ORDER BY draw_id DESC
      LIMIT 1
    `);
    const row = stmt.get() as any;

    return row ? this.rowToDraw(row) : null;
  }

  /**
   * Update draw
   */
  updateDraw(drawId: number, updates: Partial<Draw>): void {
    const db = this.getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.winningNumbers !== undefined) {
      fields.push('winning_numbers = ?');
      values.push(JSON.stringify(updates.winningNumbers));
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.ticketsSold !== undefined) {
      fields.push('tickets_sold = ?');
      values.push(updates.ticketsSold);
    }
    if (updates.prizePool !== undefined) {
      fields.push('prize_pool = ?');
      values.push(updates.prizePool);
    }
    if (updates.vrfProof !== undefined) {
      fields.push('vrf_proof = ?');
      values.push(updates.vrfProof);
    }
    if (updates.prizesDistributed !== undefined) {
      fields.push('prizes_distributed = ?');
      values.push(JSON.stringify(updates.prizesDistributed));
    }

    if (fields.length === 0) return;

    values.push(drawId);
    const stmt = db.prepare(`UPDATE draws SET ${fields.join(', ')} WHERE draw_id = ?`);
    stmt.run(...values);
  }

  /**
   * Get all draws with pagination
   */
  getAllDraws(limit: number = 10, offset: number = 0): Draw[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM draws
      ORDER BY draw_id DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as any[];

    return rows.map(row => this.rowToDraw(row));
  }

  // ============================================================================
  // Ticket Operations
  // ============================================================================

  /**
   * Create a new ticket
   */
  createTicket(ticket: Ticket): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO tickets (
        ticket_hash, numbers, salt, draw_id, purchase_amount, purchase_tx_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      ticket.ticketHash,
      JSON.stringify(ticket.numbers),
      ticket.salt,
      ticket.drawId,
      ticket.purchaseAmount,
      ticket.purchaseTxId,
      ticket.createdAt.toISOString()
    );
  }

  /**
   * Get ticket by hash
   */
  getTicketByHash(ticketHash: string): Ticket | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM tickets WHERE ticket_hash = ?');
    const row = stmt.get(ticketHash) as any;

    return row ? this.rowToTicket(row) : null;
  }

  /**
   * Get ticket by transaction ID
   */
  getTicketByTxId(txId: string): Ticket | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM tickets WHERE purchase_tx_id = ?');
    const row = stmt.get(txId) as any;

    return row ? this.rowToTicket(row) : null;
  }

  /**
   * Get all tickets for a draw
   */
  getTicketsByDraw(drawId: number): Ticket[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM tickets WHERE draw_id = ?');
    const rows = stmt.all(drawId) as any[];

    return rows.map(row => this.rowToTicket(row));
  }

  /**
   * Count tickets for a draw
   */
  countTicketsByDraw(drawId: number): number {
    const db = this.getDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE draw_id = ?');
    const row = stmt.get(drawId) as any;

    return row.count;
  }

  // ============================================================================
  // Claim Operations
  // ============================================================================

  /**
   * Create a new claim
   */
  createClaim(claim: Claim): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT INTO claims (
        claim_id, nullifier, draw_id, prize_matches, prize_amount,
        zk_proof, recipient_address, payout_tx_id, status, claimed_at, paid_out_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      claim.claimId,
      claim.nullifier,
      claim.drawId,
      claim.prizeMatches,
      claim.prizeAmount,
      JSON.stringify(claim.zkProof),
      claim.recipientAddress,
      claim.payoutTxId || null,
      claim.status,
      claim.claimedAt.toISOString(),
      claim.paidOutAt?.toISOString() || null
    );
  }

  /**
   * Get claim by ID
   */
  getClaimById(claimId: string): Claim | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM claims WHERE claim_id = ?');
    const row = stmt.get(claimId) as any;

    return row ? this.rowToClaim(row) : null;
  }

  /**
   * Get claim by nullifier
   */
  getClaimByNullifier(nullifier: string): Claim | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM claims WHERE nullifier = ?');
    const row = stmt.get(nullifier) as any;

    return row ? this.rowToClaim(row) : null;
  }

  /**
   * Check if nullifier exists
   */
  nullifierExists(nullifier: string): boolean {
    const db = this.getDb();
    const stmt = db.prepare('SELECT 1 FROM claims WHERE nullifier = ? LIMIT 1');
    const row = stmt.get(nullifier);

    return row !== undefined;
  }

  /**
   * Get all claims for a draw
   */
  getClaimsByDraw(drawId: number): Claim[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM claims WHERE draw_id = ?');
    const rows = stmt.all(drawId) as any[];

    return rows.map(row => this.rowToClaim(row));
  }

  /**
   * Get pending claims
   */
  getPendingClaims(limit: number = 10): Claim[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM claims
      WHERE status = 'verified'
      ORDER BY claimed_at ASC
      LIMIT ?
    `);
    const rows = stmt.all(limit) as any[];

    return rows.map(row => this.rowToClaim(row));
  }

  /**
   * Update claim
   */
  updateClaim(claimId: string, updates: Partial<Claim>): void {
    const db = this.getDb();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.payoutTxId !== undefined) {
      fields.push('payout_tx_id = ?');
      values.push(updates.payoutTxId);
    }
    if (updates.paidOutAt !== undefined) {
      fields.push('paid_out_at = ?');
      values.push(updates.paidOutAt.toISOString());
    }

    if (fields.length === 0) return;

    values.push(claimId);
    const stmt = db.prepare(`UPDATE claims SET ${fields.join(', ')} WHERE claim_id = ?`);
    stmt.run(...values);
  }

  // ============================================================================
  // Pending Transaction Operations
  // ============================================================================

  /**
   * Add pending transaction
   */
  addPendingTransaction(txId: string, fromAddress: string, amount: number, confirmations: number): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO pending_transactions (tx_id, from_address, amount, confirmations)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(txId, fromAddress, amount, confirmations);
  }

  /**
   * Update pending transaction
   */
  updatePendingTransaction(txId: string, confirmations: number, processed: boolean): void {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE pending_transactions
      SET confirmations = ?, processed = ?
      WHERE tx_id = ?
    `);
    stmt.run(confirmations, processed ? 1 : 0, txId);
  }

  /**
   * Get unprocessed transactions
   */
  getUnprocessedTransactions(): Array<{ tx_id: string; from_address: string; amount: number; confirmations: number }> {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT tx_id, from_address, amount, confirmations
      FROM pending_transactions
      WHERE processed = FALSE
      ORDER BY detected_at ASC
    `);
    return stmt.all() as any[];
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private rowToDraw(row: any): Draw {
    return {
      drawId: row.draw_id,
      winningNumbers: JSON.parse(row.winning_numbers),
      drawDate: new Date(row.draw_date),
      salesCloseDate: new Date(row.sales_close_date),
      ticketsSold: row.tickets_sold,
      prizePool: row.prize_pool,
      vrfProof: row.vrf_proof,
      status: row.status as DrawStatus,
      prizesDistributed: JSON.parse(row.prizes_distributed),
    };
  }

  private rowToTicket(row: any): Ticket {
    return {
      ticketHash: row.ticket_hash,
      numbers: JSON.parse(row.numbers),
      salt: row.salt,
      drawId: row.draw_id,
      purchaseAmount: row.purchase_amount,
      purchaseTxId: row.purchase_tx_id,
      createdAt: new Date(row.created_at),
    };
  }

  private rowToClaim(row: any): Claim {
    return {
      claimId: row.claim_id,
      nullifier: row.nullifier,
      drawId: row.draw_id,
      prizeMatches: row.prize_matches,
      prizeAmount: row.prize_amount,
      zkProof: JSON.parse(row.zk_proof),
      recipientAddress: row.recipient_address,
      payoutTxId: row.payout_tx_id,
      status: row.status as ClaimStatus,
      claimedAt: new Date(row.claimed_at),
      paidOutAt: row.paid_out_at ? new Date(row.paid_out_at) : undefined,
    };
  }
}
