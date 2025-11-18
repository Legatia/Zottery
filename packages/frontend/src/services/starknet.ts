import { connect, disconnect } from 'get-starknet-core';
import { Contract, Provider, Account, RpcProvider } from 'starknet';

export interface StarknetWallet {
  address: string;
  account: Account;
  provider: Provider;
}

export class StarknetService {
  private wallet: StarknetWallet | null = null;
  private provider: RpcProvider;

  // Contract addresses (to be set after deployment)
  private vaultAddress: string;
  private lotteryManagerAddress: string;
  private claimVerifierAddress: string;

  constructor() {
    // Initialize provider (Sepolia testnet by default)
    const rpcUrl = import.meta.env.VITE_STARKNET_RPC_URL ||
      'https://starknet-sepolia.public.blastapi.io';

    this.provider = new RpcProvider({ nodeUrl: rpcUrl });

    // Load contract addresses from environment
    this.vaultAddress = import.meta.env.VITE_VAULT_ADDRESS || '';
    this.lotteryManagerAddress = import.meta.env.VITE_LOTTERY_MANAGER_ADDRESS || '';
    this.claimVerifierAddress = import.meta.env.VITE_CLAIM_VERIFIER_ADDRESS || '';
  }

  async connectWallet(): Promise<StarknetWallet> {
    try {
      // Use get-starknet to connect to available wallets (ArgentX, Braavos, etc.)
      const starknet = await connect({
        modalMode: 'alwaysAsk',
        modalTheme: 'dark',
      });

      if (!starknet || !starknet.isConnected) {
        throw new Error('Failed to connect wallet');
      }

      await starknet.enable();

      if (!starknet.account) {
        throw new Error('No account found');
      }

      this.wallet = {
        address: starknet.selectedAddress || '',
        account: starknet.account,
        provider: starknet.provider,
      };

      console.log('✅ Wallet connected:', this.wallet.address);
      return this.wallet;

    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  async disconnectWallet(): Promise<void> {
    await disconnect();
    this.wallet = null;
    console.log('👋 Wallet disconnected');
  }

  getWallet(): StarknetWallet | null {
    return this.wallet;
  }

  isConnected(): boolean {
    return this.wallet !== null;
  }

  // ============ VAULT OPERATIONS ============

  async deposit(amount: bigint): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected');
    if (!this.vaultAddress) throw new Error('Vault address not configured');

    // TODO: Load vault ABI
    const vaultContract = new Contract(
      [], // ABI
      this.vaultAddress,
      this.wallet.account
    );

    // Call deposit function
    const tx = await vaultContract.deposit(amount);
    await this.wallet.provider.waitForTransaction(tx.transaction_hash);

    console.log('✅ Deposit successful:', tx.transaction_hash);
    return tx.transaction_hash;
  }

  async withdraw(shares: bigint): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected');
    if (!this.vaultAddress) throw new Error('Vault address not configured');

    const vaultContract = new Contract(
      [], // ABI
      this.vaultAddress,
      this.wallet.account
    );

    const tx = await vaultContract.withdraw(shares);
    await this.wallet.provider.waitForTransaction(tx.transaction_hash);

    console.log('✅ Withdrawal successful:', tx.transaction_hash);
    return tx.transaction_hash;
  }

  async getUserShares(): Promise<bigint> {
    if (!this.wallet) throw new Error('Wallet not connected');
    if (!this.vaultAddress) throw new Error('Vault address not configured');

    const vaultContract = new Contract(
      [], // ABI
      this.vaultAddress,
      this.provider
    );

    const shares = await vaultContract.user_shares(this.wallet.address);
    return BigInt(shares.toString());
  }

  async getTotalAssets(): Promise<bigint> {
    if (!this.vaultAddress) throw new Error('Vault address not configured');

    const vaultContract = new Contract(
      [], // ABI
      this.vaultAddress,
      this.provider
    );

    const assets = await vaultContract.total_assets();
    return BigInt(assets.toString());
  }

  async getCurrentLeverage(): Promise<number> {
    if (!this.vaultAddress) throw new Error('Vault address not configured');

    const vaultContract = new Contract(
      [], // ABI
      this.vaultAddress,
      this.provider
    );

    const leverage = await vaultContract.get_leverage();
    return Number(leverage);
  }

  // ============ LOTTERY OPERATIONS ============

  async registerTicket(commitment: string): Promise<{ ticketId: bigint; txHash: string }> {
    if (!this.wallet) throw new Error('Wallet not connected');
    if (!this.lotteryManagerAddress) throw new Error('Lottery manager address not configured');

    const lotteryContract = new Contract(
      [], // ABI
      this.lotteryManagerAddress,
      this.wallet.account
    );

    const tx = await lotteryContract.register_ticket(commitment);
    await this.wallet.provider.waitForTransaction(tx.transaction_hash);

    // Parse ticket ID from events (simplified)
    // In production, parse events properly
    const ticketId = BigInt(1); // Placeholder

    console.log('✅ Ticket registered:', tx.transaction_hash);
    return { ticketId, txHash: tx.transaction_hash };
  }

  async getCurrentDrawId(): Promise<number> {
    if (!this.lotteryManagerAddress) throw new Error('Lottery manager address not configured');

    const lotteryContract = new Contract(
      [], // ABI
      this.lotteryManagerAddress,
      this.provider
    );

    const drawId = await lotteryContract.get_current_draw_id();
    return Number(drawId);
  }

  async getWinningCommitment(drawId: number): Promise<string> {
    if (!this.lotteryManagerAddress) throw new Error('Lottery manager address not configured');

    const lotteryContract = new Contract(
      [], // ABI
      this.lotteryManagerAddress,
      this.provider
    );

    const commitment = await lotteryContract.get_winning_commitment(drawId);
    return commitment.toString();
  }

  async getPrizePool(drawId: number): Promise<bigint> {
    if (!this.lotteryManagerAddress) throw new Error('Lottery manager address not configured');

    const lotteryContract = new Contract(
      [], // ABI
      this.lotteryManagerAddress,
      this.provider
    );

    const prizePool = await lotteryContract.get_prize_pool(drawId);
    return BigInt(prizePool.toString());
  }

  async isDrawExecuted(drawId: number): Promise<boolean> {
    if (!this.lotteryManagerAddress) throw new Error('Lottery manager address not configured');

    const lotteryContract = new Contract(
      [], // ABI
      this.lotteryManagerAddress,
      this.provider
    );

    const isExecuted = await lotteryContract.is_draw_executed(drawId);
    return Boolean(isExecuted);
  }

  // ============ CLAIM OPERATIONS ============

  async claimPrize(
    drawId: number,
    nullifier: string,
    zAddressHash: string,
    proof: string[]
  ): Promise<string> {
    if (!this.wallet) throw new Error('Wallet not connected');
    if (!this.claimVerifierAddress) throw new Error('Claim verifier address not configured');

    const claimContract = new Contract(
      [], // ABI
      this.claimVerifierAddress,
      this.wallet.account
    );

    const tx = await claimContract.claim_prize(
      drawId,
      nullifier,
      zAddressHash,
      proof
    );

    await this.wallet.provider.waitForTransaction(tx.transaction_hash);

    console.log('✅ Claim submitted:', tx.transaction_hash);
    return tx.transaction_hash;
  }

  async isNullifierUsed(nullifier: string): Promise<boolean> {
    if (!this.claimVerifierAddress) throw new Error('Claim verifier address not configured');

    const claimContract = new Contract(
      [], // ABI
      this.claimVerifierAddress,
      this.provider
    );

    const isUsed = await claimContract.is_nullifier_used(nullifier);
    return Boolean(isUsed);
  }

  // ============ HELPER FUNCTIONS ============

  async getBlockNumber(): Promise<number> {
    const block = await this.provider.getBlockNumber();
    return block;
  }

  formatAddress(address: string): string {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}

// Singleton instance
export const starknetService = new StarknetService();
