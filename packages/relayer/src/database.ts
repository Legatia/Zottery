import { Pool } from 'pg';
import { Logger } from './logger';

export interface PayoutRecord {
  nullifier: string;
  draw_id: number;
  amount: string;
  z_address_hash: string;
  recipient_z_address: string;
  zcash_tx_hash: string;
  timestamp: number;
}

export interface FailedPayoutRecord {
  nullifier: string;
  draw_id: number;
  amount: string;
  error: string;
  timestamp: number;
}

export interface DepositRecord {
  txid: string;
  amount: number;
  recipient: string;
  timestamp: number;
}

export class Database {
  private pool: Pool | null = null;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('Database');
  }

  async connect() {
    this.logger.info('Connecting to database...');

    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'zottery_relayer',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    // Test connection
    await this.pool.query('SELECT NOW()');
    this.logger.info('✅ Database connected');
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.logger.info('Database disconnected');
    }
  }

  async initialize() {
    if (!this.pool) throw new Error('Database not connected');

    this.logger.info('Initializing database schema...');

    // Create tables
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        nullifier TEXT UNIQUE NOT NULL,
        draw_id INTEGER NOT NULL,
        amount TEXT NOT NULL,
        z_address_hash TEXT NOT NULL,
        recipient_z_address TEXT NOT NULL,
        zcash_tx_hash TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS failed_payouts (
        id SERIAL PRIMARY KEY,
        nullifier TEXT NOT NULL,
        draw_id INTEGER NOT NULL,
        amount TEXT NOT NULL,
        error TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS submitted_z_addresses (
        id SERIAL PRIMARY KEY,
        nullifier TEXT UNIQUE NOT NULL,
        z_address TEXT NOT NULL,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id SERIAL PRIMARY KEY,
        txid TEXT UNIQUE NOT NULL,
        amount NUMERIC NOT NULL,
        recipient TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS relayer_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize last_processed_block if not exists
    await this.pool.query(`
      INSERT INTO relayer_state (key, value)
      VALUES ('last_processed_block', '0')
      ON CONFLICT (key) DO NOTHING;
    `);

    this.logger.info('✅ Database schema initialized');
  }

  async getLastProcessedBlock(): Promise<number> {
    if (!this.pool) throw new Error('Database not connected');

    const result = await this.pool.query(
      "SELECT value FROM relayer_state WHERE key = 'last_processed_block'"
    );

    return parseInt(result.rows[0]?.value || '0');
  }

  async setLastProcessedBlock(block: number): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    await this.pool.query(
      `UPDATE relayer_state SET value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE key = 'last_processed_block'`,
      [block.toString()]
    );
  }

  async isPayoutProcessed(nullifier: string): Promise<boolean> {
    if (!this.pool) throw new Error('Database not connected');

    const result = await this.pool.query(
      'SELECT 1 FROM payouts WHERE nullifier = $1',
      [nullifier]
    );

    return result.rows.length > 0;
  }

  async recordPayout(payout: PayoutRecord): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    await this.pool.query(
      `INSERT INTO payouts
       (nullifier, draw_id, amount, z_address_hash, recipient_z_address, zcash_tx_hash, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        payout.nullifier,
        payout.draw_id,
        payout.amount,
        payout.z_address_hash,
        payout.recipient_z_address,
        payout.zcash_tx_hash,
        payout.timestamp,
      ]
    );

    this.logger.info(`✅ Recorded payout for nullifier ${payout.nullifier}`);
  }

  async recordFailedPayout(payout: FailedPayoutRecord): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    await this.pool.query(
      `INSERT INTO failed_payouts
       (nullifier, draw_id, amount, error, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [payout.nullifier, payout.draw_id, payout.amount, payout.error, payout.timestamp]
    );

    this.logger.warn(`⚠️  Recorded failed payout for nullifier ${payout.nullifier}`);
  }

  async getSubmittedZAddress(nullifier: string): Promise<string | null> {
    if (!this.pool) throw new Error('Database not connected');

    const result = await this.pool.query(
      'SELECT z_address FROM submitted_z_addresses WHERE nullifier = $1',
      [nullifier]
    );

    return result.rows[0]?.z_address || null;
  }

  async submitZAddress(nullifier: string, z_address: string): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    await this.pool.query(
      `INSERT INTO submitted_z_addresses (nullifier, z_address)
       VALUES ($1, $2)
       ON CONFLICT (nullifier) DO UPDATE SET z_address = $2`,
      [nullifier, z_address]
    );

    this.logger.info(`✅ Submitted z-address for nullifier ${nullifier}`);
  }

  async isDepositProcessed(txid: string): Promise<boolean> {
    if (!this.pool) throw new Error('Database not connected');

    const result = await this.pool.query(
      'SELECT 1 FROM deposits WHERE txid = $1',
      [txid]
    );

    return result.rows.length > 0;
  }

  async recordDeposit(deposit: DepositRecord): Promise<void> {
    if (!this.pool) throw new Error('Database not connected');

    await this.pool.query(
      `INSERT INTO deposits (txid, amount, recipient, timestamp)
       VALUES ($1, $2, $3, $4)`,
      [deposit.txid, deposit.amount, deposit.recipient, deposit.timestamp]
    );

    this.logger.info(`✅ Recorded deposit ${deposit.txid}`);
  }

  async getAllPayouts(): Promise<PayoutRecord[]> {
    if (!this.pool) throw new Error('Database not connected');

    const result = await this.pool.query(
      'SELECT * FROM payouts ORDER BY timestamp DESC'
    );

    return result.rows;
  }

  async getFailedPayouts(): Promise<FailedPayoutRecord[]> {
    if (!this.pool) throw new Error('Database not connected');

    const result = await this.pool.query(
      'SELECT * FROM failed_payouts ORDER BY timestamp DESC'
    );

    return result.rows;
  }
}
