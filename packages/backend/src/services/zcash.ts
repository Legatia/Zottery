/**
 * Zcash Service
 *
 * Handles all interactions with the Zcash blockchain via RPC.
 */

import axios, { AxiosInstance } from 'axios';
import { ZcashTransaction } from '@zottery/shared';

export interface ZcashServiceConfig {
  rpcUrl: string;
  rpcUser: string;
  rpcPassword: string;
  lotteryAddress: string;  // Transparent address for receiving ticket payments
}

export class ZcashService {
  private rpcClient: AxiosInstance;
  private config: ZcashServiceConfig;
  private requestId: number = 1;

  constructor(config: ZcashServiceConfig) {
    this.config = config;
    this.rpcClient = axios.create({
      baseURL: config.rpcUrl,
      auth: {
        username: config.rpcUser,
        password: config.rpcPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make RPC call to Zcash node
   */
  private async rpcCall<T = any>(method: string, params: any[] = []): Promise<T> {
    try {
      const response = await this.rpcClient.post('', {
        jsonrpc: '2.0',
        id: this.requestId++,
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(`RPC Error: ${response.data.error.message}`);
      }

      return response.data.result;
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(`RPC Error: ${error.response.data.error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get blockchain info
   */
  async getBlockchainInfo(): Promise<any> {
    return this.rpcCall('getblockchaininfo');
  }

  /**
   * Get balance of an address
   */
  async getAddressBalance(address: string): Promise<number> {
    try {
      const result = await this.rpcCall('z_getbalance', [address]);
      return parseFloat(result);
    } catch (error) {
      console.error(`Error getting balance for ${address}:`, error);
      return 0;
    }
  }

  /**
   * Get received transactions for lottery address
   */
  async getReceivedTransactions(minConfirmations: number = 0): Promise<ZcashTransaction[]> {
    try {
      // List transactions received by the lottery address
      const result = await this.rpcCall('listreceivedbyaddress', [
        minConfirmations,
        false, // includeEmpty
        false, // includeWatchonly
      ]);

      // Filter for lottery address
      const lotteryTxs = result.filter((item: any) =>
        item.address === this.config.lotteryAddress && item.amount > 0
      );

      // Get detailed info for each transaction
      const transactions: ZcashTransaction[] = [];
      for (const item of lotteryTxs) {
        const txIds = item.txids || [];
        for (const txid of txIds) {
          const tx = await this.getTransaction(txid);
          if (tx) {
            transactions.push(tx);
          }
        }
      }

      return transactions;
    } catch (error) {
      console.error('Error getting received transactions:', error);
      return [];
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(txid: string): Promise<ZcashTransaction | null> {
    try {
      const result = await this.rpcCall('gettransaction', [txid]);

      // Find vout that pays to lottery address
      let amount = 0;
      let toAddress = this.config.lotteryAddress;

      if (result.details && Array.isArray(result.details)) {
        const receivedDetail = result.details.find(
          (d: any) => d.category === 'receive' && d.address === this.config.lotteryAddress
        );
        if (receivedDetail) {
          amount = Math.abs(receivedDetail.amount);
        }
      }

      return {
        txid: result.txid,
        confirmations: result.confirmations || 0,
        amount,
        toAddress,
        blockHeight: result.blockheight,
        timestamp: result.time,
      };
    } catch (error) {
      console.error(`Error getting transaction ${txid}:`, error);
      return null;
    }
  }

  /**
   * Send ZEC to a shielded address (for prize payouts)
   */
  async sendToShieldedAddress(
    toAddress: string,
    amount: number,
    memo?: string
  ): Promise<string> {
    try {
      // Build transaction
      const operations = [
        {
          address: toAddress,
          amount: amount,
          memo: memo ? Buffer.from(memo).toString('hex') : undefined,
        },
      ];

      // Send transaction
      const opid = await this.rpcCall('z_sendmany', [
        this.config.lotteryAddress, // from address
        operations,
        1, // minconf
        0.0001, // fee
      ]);

      // Wait for operation to complete
      const result = await this.waitForOperation(opid);

      if (result.status === 'failed') {
        throw new Error(`Transaction failed: ${result.error?.message || 'Unknown error'}`);
      }

      return result.txid;
    } catch (error: any) {
      console.error('Error sending to shielded address:', error);
      throw new Error(`Failed to send ZEC: ${error.message}`);
    }
  }

  /**
   * Wait for async operation to complete
   */
  private async waitForOperation(opid: string, maxAttempts: number = 60): Promise<any> {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await this.rpcCall('z_getoperationstatus', [[opid]]);

      if (status && status.length > 0) {
        const op = status[0];

        if (op.status === 'success') {
          return op.result;
        }

        if (op.status === 'failed') {
          return op;
        }
      }

      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Operation timeout');
  }

  /**
   * Generate a new shielded address
   */
  async generateShieldedAddress(): Promise<string> {
    try {
      const address = await this.rpcCall('z_getnewaddress', ['sapling']);
      return address;
    } catch (error: any) {
      console.error('Error generating shielded address:', error);
      throw new Error(`Failed to generate shielded address: ${error.message}`);
    }
  }

  /**
   * Generate a new transparent address
   */
  async generateTransparentAddress(): Promise<string> {
    try {
      const address = await this.rpcCall('getnewaddress');
      return address;
    } catch (error: any) {
      console.error('Error generating transparent address:', error);
      throw new Error(`Failed to generate transparent address: ${error.message}`);
    }
  }

  /**
   * Validate an address
   */
  async validateAddress(address: string): Promise<{ isValid: boolean; isShielded: boolean }> {
    try {
      // Try z_validateaddress first (for shielded)
      const zResult = await this.rpcCall('z_validateaddress', [address]);
      if (zResult.isvalid) {
        return {
          isValid: true,
          isShielded: zResult.type === 'sapling' || zResult.type === 'sprout',
        };
      }

      // Try validateaddress (for transparent)
      const tResult = await this.rpcCall('validateaddress', [address]);
      return {
        isValid: tResult.isvalid,
        isShielded: false,
      };
    } catch (error) {
      console.error('Error validating address:', error);
      return { isValid: false, isShielded: false };
    }
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    try {
      const info = await this.getBlockchainInfo();
      return info.blocks;
    } catch (error) {
      console.error('Error getting block height:', error);
      return 0;
    }
  }

  /**
   * Check if node is synced
   */
  async isSynced(): Promise<boolean> {
    try {
      const info = await this.getBlockchainInfo();
      return info.verificationprogress >= 0.9999;
    } catch (error) {
      console.error('Error checking sync status:', error);
      return false;
    }
  }

  /**
   * Get lottery address
   */
  getLotteryAddress(): string {
    return this.config.lotteryAddress;
  }
}
