import { Provider, Contract, RpcProvider } from 'starknet';
import { ZcashRPC } from './zcash';
import { Logger } from './logger';
import { Database } from './database';

export interface RelayerConfig {
  starknetRpcUrl: string;
  claimVerifierAddress: string;
  zcashRpcUrl: string;
  zcashRpcUser: string;
  zcashRpcPassword: string;
  vaultZAddress: string;
}

export interface PayoutAuthorizedEvent {
  nullifier: string;
  draw_id: number;
  amount: string;
  z_address_hash: string;
  timestamp: number;
}

export class CrossChainRelayer {
  private provider: Provider;
  private claimVerifierContract: Contract;
  private zcashRPC: ZcashRPC;
  private logger: Logger;
  private db: Database;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private config: RelayerConfig;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.logger = new Logger('Relayer');

    // Initialize Starknet provider
    this.provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });

    // Initialize Zcash RPC
    this.zcashRPC = new ZcashRPC({
      url: config.zcashRpcUrl,
      username: config.zcashRpcUser,
      password: config.zcashRpcPassword,
    });

    // Initialize database
    this.db = new Database();

    // TODO: Load contract ABI and initialize contract
    // For now, we'll use a placeholder
    this.claimVerifierContract = new Contract(
      [], // ABI will be loaded
      config.claimVerifierAddress,
      this.provider
    );
  }

  async start() {
    this.logger.info('🎬 Starting relayer service...');
    this.isRunning = true;

    // Initialize database
    await this.db.connect();
    await this.db.initialize();

    // Start polling for events
    this.pollForEvents();

    this.logger.info('✅ Relayer service started successfully');
  }

  async stop() {
    this.logger.info('⏹️  Stopping relayer service...');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    await this.db.disconnect();
    this.logger.info('✅ Relayer service stopped');
  }

  private pollForEvents() {
    // Poll every 15 seconds
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkForPayoutEvents();
      } catch (error) {
        this.logger.error('Error polling for events:', error);
      }
    }, 15000);

    // Run immediately on start
    this.checkForPayoutEvents();
  }

  private async checkForPayoutEvents() {
    try {
      // Get last processed block
      const lastBlock = await this.db.getLastProcessedBlock();
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock <= lastBlock) {
        return; // No new blocks
      }

      this.logger.info(`📦 Checking blocks ${lastBlock + 1} to ${currentBlock}`);

      // Fetch events from claim verifier contract
      // TODO: Use proper event filtering when starknet.js supports it
      // For now, we'll use a simplified approach

      const events = await this.fetchPayoutAuthorizedEvents(
        lastBlock + 1,
        currentBlock
      );

      for (const event of events) {
        await this.processPayoutEvent(event);
      }

      // Update last processed block
      await this.db.setLastProcessedBlock(currentBlock);

    } catch (error) {
      this.logger.error('Error checking for payout events:', error);
    }
  }

  private async fetchPayoutAuthorizedEvents(
    fromBlock: number,
    toBlock: number
  ): Promise<PayoutAuthorizedEvent[]> {
    // TODO: Implement proper event fetching
    // This is a placeholder that returns empty array
    // In production, use starknet.js event filtering

    /*
    Example event structure from ClaimVerifier:
    event PayoutAuthorized {
      nullifier: felt252,
      draw_id: u64,
      amount: u256,
      z_address_hash: felt252,
      timestamp: u64,
    }
    */

    return [];
  }

  private async processPayoutEvent(event: PayoutAuthorizedEvent) {
    const { nullifier, draw_id, amount, z_address_hash, timestamp } = event;

    this.logger.info(`💰 Processing payout for nullifier: ${nullifier}`);

    // Check if already processed
    const isProcessed = await this.db.isPayoutProcessed(nullifier);
    if (isProcessed) {
      this.logger.warn(`⚠️  Nullifier ${nullifier} already processed, skipping`);
      return;
    }

    try {
      // Step 1: Verify the proof independently (optional but recommended)
      // const isValid = await this.verifyProof(event);
      // if (!isValid) {
      //   this.logger.error(`Invalid proof for nullifier ${nullifier}`);
      //   return;
      // }

      // Step 2: Get recipient z-address
      // In production, this would be retrieved from an encrypted channel
      // where the winner submits their z-address encrypted with relayer's public key
      const recipientZAddress = await this.getRecipientZAddress(
        nullifier,
        z_address_hash
      );

      if (!recipientZAddress) {
        this.logger.error(
          `❌ Could not retrieve z-address for nullifier ${nullifier}`
        );
        return;
      }

      // Step 3: Verify z-address hash matches
      const isHashValid = await this.verifyZAddressHash(
        recipientZAddress,
        z_address_hash
      );

      if (!isHashValid) {
        this.logger.error(
          `❌ Z-address hash mismatch for nullifier ${nullifier}`
        );
        return;
      }

      // Step 4: Send Zcash shielded transaction
      const zcashTxHash = await this.sendZcashPayout(
        recipientZAddress,
        amount
      );

      this.logger.info(
        `✅ Zcash payout sent! TX: ${zcashTxHash}`
      );

      // Step 5: Record payout on Starknet
      await this.recordPayoutOnStarknet(nullifier, zcashTxHash);

      // Step 6: Save to database
      await this.db.recordPayout({
        nullifier,
        draw_id,
        amount,
        z_address_hash,
        recipient_z_address: recipientZAddress,
        zcash_tx_hash: zcashTxHash,
        timestamp: Date.now(),
      });

      this.logger.info(
        `🎉 Payout completed for nullifier ${nullifier}`
      );

    } catch (error) {
      this.logger.error(
        `❌ Error processing payout for nullifier ${nullifier}:`,
        error
      );

      // Save failed payout for manual review
      await this.db.recordFailedPayout({
        nullifier,
        draw_id,
        amount,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });
    }
  }

  private async getRecipientZAddress(
    nullifier: string,
    z_address_hash: string
  ): Promise<string | null> {
    // TODO: Implement secure z-address retrieval
    // Options:
    // 1. Winner submits encrypted z-address to relayer's public endpoint
    // 2. Use off-chain messaging (e.g., IPFS, encrypted)
    // 3. Direct P2P communication with winner

    // For MVP, check database for submitted z-addresses
    const submittedAddress = await this.db.getSubmittedZAddress(nullifier);
    return submittedAddress;
  }

  private async verifyZAddressHash(
    z_address: string,
    expected_hash: string
  ): Promise<boolean> {
    // TODO: Compute poseidon hash of z_address and compare
    // For now, return true (INSECURE - for testing only)
    return true;
  }

  private async sendZcashPayout(
    recipient: string,
    amount: string
  ): Promise<string> {
    this.logger.info(
      `💸 Sending ${amount} to ${recipient.substring(0, 10)}...`
    );

    // Convert amount from contract format (u256) to Zcash format
    const amountInZcash = BigInt(amount) / BigInt(1_000_000); // Assuming 6 decimals

    // Send shielded transaction
    const txHash = await this.zcashRPC.sendShieldedTransaction(
      this.config.vaultZAddress,
      recipient,
      Number(amountInZcash) / 1_000_000, // Convert to ZEC
      '' // Empty memo for privacy
    );

    return txHash;
  }

  private async recordPayoutOnStarknet(
    nullifier: string,
    zcashTxHash: string
  ): Promise<void> {
    // TODO: Call ClaimVerifier.record_payout()
    // This requires the relayer to have a Starknet account with authorization

    this.logger.info(
      `📝 Recording payout on Starknet: ${nullifier} -> ${zcashTxHash}`
    );

    // Placeholder for now
    // In production:
    // await this.claimVerifierContract.record_payout(nullifier, zcashTxHash);
  }
}
