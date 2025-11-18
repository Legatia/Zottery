import axios, { AxiosInstance } from 'axios';
import { Logger } from './logger';

export interface ZcashRPCConfig {
  url: string;
  username: string;
  password: string;
}

export interface ShieldedOutput {
  address: string;
  amount: number;
  memo?: string;
}

export class ZcashRPC {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(config: ZcashRPCConfig) {
    this.logger = new Logger('ZcashRPC');

    this.client = axios.create({
      baseURL: config.url,
      auth: {
        username: config.username,
        password: config.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async call(method: string, params: any[] = []): Promise<any> {
    try {
      const response = await this.client.post('', {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(
          `Zcash RPC error: ${JSON.stringify(response.data.error)}`
        );
      }

      return response.data.result;
    } catch (error) {
      this.logger.error(`RPC call failed: ${method}`, error);
      throw error;
    }
  }

  async getInfo(): Promise<any> {
    return this.call('getinfo');
  }

  async getBlockchainInfo(): Promise<any> {
    return this.call('getblockchaininfo');
  }

  async z_getbalance(address: string, minconf: number = 1): Promise<number> {
    return this.call('z_getbalance', [address, minconf]);
  }

  async z_listaddresses(): Promise<string[]> {
    return this.call('z_listaddresses');
  }

  async sendShieldedTransaction(
    fromAddress: string,
    toAddress: string,
    amount: number,
    memo: string = ''
  ): Promise<string> {
    this.logger.info(
      `Sending shielded transaction: ${amount} ZEC to ${toAddress.substring(
        0,
        10
      )}...`
    );

    // Construct shielded transaction
    const amounts: ShieldedOutput[] = [
      {
        address: toAddress,
        amount: amount,
        memo: memo,
      },
    ];

    // Use z_sendmany for shielded transactions
    const operationId = await this.call('z_sendmany', [
      fromAddress,
      amounts,
      1, // minconf
      0.0001, // fee
    ]);

    this.logger.info(`Operation ID: ${operationId}`);

    // Wait for operation to complete
    const txHash = await this.waitForOperation(operationId);

    this.logger.info(`Transaction sent: ${txHash}`);
    return txHash;
  }

  private async waitForOperation(
    operationId: string,
    maxRetries: number = 60
  ): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const status = await this.call('z_getoperationstatus', [[operationId]]);

      if (status.length === 0) {
        throw new Error('Operation not found');
      }

      const operation = status[0];

      if (operation.status === 'success') {
        return operation.result.txid;
      }

      if (operation.status === 'failed') {
        throw new Error(`Operation failed: ${operation.error.message}`);
      }

      // Wait 2 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error('Operation timeout');
  }

  async z_validateaddress(address: string): Promise<any> {
    return this.call('z_validateaddress', [address]);
  }

  async z_gettotalbalance(): Promise<any> {
    return this.call('z_gettotalbalance');
  }

  async z_listreceivedbyaddress(
    address: string,
    minconf: number = 1
  ): Promise<any[]> {
    return this.call('z_listreceivedbyaddress', [address, minconf]);
  }
}
