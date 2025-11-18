import { config } from 'dotenv';
import { CrossChainRelayer } from './relayer';
import { Logger } from './logger';

config();

const logger = new Logger('Main');

async function main() {
  logger.info('🚀 Starting Zottery Cross-Chain Relayer...');

  // Validate environment variables
  const requiredEnvVars = [
    'STARKNET_RPC_URL',
    'CLAIM_VERIFIER_ADDRESS',
    'ZCASH_RPC_URL',
    'ZCASH_RPC_USER',
    'ZCASH_RPC_PASSWORD',
    'VAULT_Z_ADDRESS',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Initialize relayer
  const relayer = new CrossChainRelayer({
    starknetRpcUrl: process.env.STARKNET_RPC_URL!,
    claimVerifierAddress: process.env.CLAIM_VERIFIER_ADDRESS!,
    zcashRpcUrl: process.env.ZCASH_RPC_URL!,
    zcashRpcUser: process.env.ZCASH_RPC_USER!,
    zcashRpcPassword: process.env.ZCASH_RPC_PASSWORD!,
    vaultZAddress: process.env.VAULT_Z_ADDRESS!,
  });

  // Start listening for events
  await relayer.start();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('🛑 Shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('🛑 Shutting down gracefully...');
    await relayer.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error('💥 Fatal error:', error);
  process.exit(1);
});
