/**
 * API Client
 *
 * Handles all communication with the backend API.
 */

import axios, { AxiosInstance } from 'axios';
import type {
  GetDrawResponse,
  GetTicketResponse,
  CheckNumbersRequest,
  CheckNumbersResponse,
  SubmitClaimRequest,
  SubmitClaimResponse,
  GetClaimStatusResponse,
} from '@zottery/shared';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================================================
  // Draw API
  // ============================================================================

  async getCurrentDraw(): Promise<GetDrawResponse> {
    const response = await this.client.get('/draw/current');
    return response.data;
  }

  async getDraw(drawId: number): Promise<GetDrawResponse> {
    const response = await this.client.get(`/draw/${drawId}`);
    return response.data;
  }

  async getAllDraws(limit: number = 10, offset: number = 0): Promise<any> {
    const response = await this.client.get(`/draws?limit=${limit}&offset=${offset}`);
    return response.data;
  }

  // ============================================================================
  // Ticket API
  // ============================================================================

  async getLotteryAddress(): Promise<{ success: boolean; address: string }> {
    const response = await this.client.get('/lottery/address');
    return response.data;
  }

  async getTicket(ticketHash: string): Promise<GetTicketResponse> {
    const response = await this.client.get(`/ticket/${ticketHash}`);
    return response.data;
  }

  async checkNumbers(request: CheckNumbersRequest): Promise<CheckNumbersResponse> {
    const response = await this.client.post('/numbers/check', request);
    return response.data;
  }

  // ============================================================================
  // Claim API
  // ============================================================================

  async submitClaim(request: SubmitClaimRequest): Promise<SubmitClaimResponse> {
    const response = await this.client.post('/claim/submit', request);
    return response.data;
  }

  async getClaimStatus(claimId: string): Promise<GetClaimStatusResponse> {
    const response = await this.client.get(`/claim/${claimId}`);
    return response.data;
  }

  async checkNullifier(nullifier: string): Promise<any> {
    const response = await this.client.get(`/claim/nullifier/${nullifier}`);
    return response.data;
  }
}

export const api = new ApiClient();
