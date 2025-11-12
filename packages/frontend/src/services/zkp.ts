/**
 * Frontend ZKP Service
 *
 * Handles client-side zero-knowledge proof generation for lottery claims.
 */

import { groth16 } from 'snarkjs';
import type { ZKProof } from '@zottery/shared';

export interface ProofInputs {
  // Public inputs
  nullifier: string;
  winningNumbers: number[];
  minMatches: number;
  ticketTreeRoot: string;
  drawId: number;

  // Private inputs (secrets)
  ticketNumbers: number[];
  salt: string;
  claimKey: string;
  merkleProof: string[];
  merklePathIndices: number[];
}

export class ZKPService {
  private wasmPath: string;
  private zkeyPath: string;
  private isAvailable: boolean = false;

  constructor() {
    // Circuit files should be in public directory
    this.wasmPath = '/circuits/claimVerifier.wasm';
    this.zkeyPath = '/circuits/claimVerifier_final.zkey';
  }

  /**
   * Check if ZKP system is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Try to fetch the WASM file to check if circuits are deployed
      const response = await fetch(this.wasmPath, { method: 'HEAD' });
      this.isAvailable = response.ok;
      return this.isAvailable;
    } catch (error) {
      console.warn('ZKP circuits not available:', error);
      this.isAvailable = false;
      return false;
    }
  }

  /**
   * Generate a zero-knowledge proof for a lottery claim
   *
   * This runs entirely in the browser using WebAssembly.
   * The private inputs never leave the user's device.
   *
   * @param inputs - All inputs for the circuit
   * @returns ZK proof and public signals
   */
  async generateClaimProof(inputs: ProofInputs): Promise<ZKProof> {
    // Check availability first
    if (!this.isAvailable) {
      const available = await this.checkAvailability();
      if (!available) {
        throw new Error('ZKP circuits not available. Please compile circuits first.');
      }
    }

    try {
      console.log('🔐 Generating zero-knowledge proof...');
      console.log('⚠️  This may take 10-30 seconds...');

      // Format inputs for the circuit
      const circuitInputs = {
        // Public inputs
        nullifier: inputs.nullifier,
        winningNumbers: inputs.winningNumbers.map(n => n.toString()),
        minMatches: inputs.minMatches.toString(),
        ticketTreeRoot: inputs.ticketTreeRoot,
        drawId: inputs.drawId.toString(),

        // Private inputs
        ticketNumbers: inputs.ticketNumbers.map(n => n.toString()),
        salt: inputs.salt,
        claimKey: inputs.claimKey,
        merkleProof: inputs.merkleProof,
        merklePathIndices: inputs.merklePathIndices.map(i => i.toString()),
      };

      // Generate proof using snarkjs
      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        this.wasmPath,
        this.zkeyPath
      );

      console.log('✅ Zero-knowledge proof generated successfully!');

      // Format proof for backend
      const zkProof: ZKProof = {
        proof: {
          pi_a: proof.pi_a.slice(0, 2),
          pi_b: proof.pi_b.map((arr: any[]) => arr.slice(0, 2)),
          pi_c: proof.pi_c.slice(0, 2),
          protocol: proof.protocol || 'groth16',
          curve: proof.curve || 'bn128',
        },
        publicSignals,
      };

      return zkProof;
    } catch (error: any) {
      console.error('Error generating ZK proof:', error);
      throw new Error(`Failed to generate proof: ${error.message}`);
    }
  }

  /**
   * Generate a mock proof for testing (when circuits not compiled)
   *
   * ⚠️  This is NOT cryptographically secure!
   * Only use for development/testing.
   */
  generateMockProof(inputs: ProofInputs): ZKProof {
    console.warn('⚠️  Generating MOCK proof (not cryptographically secure)');

    // Create a mock proof with correct structure
    const mockProof: ZKProof = {
      proof: {
        pi_a: [
          '0x' + Math.random().toString(16).substring(2),
          '0x' + Math.random().toString(16).substring(2),
        ],
        pi_b: [
          [
            '0x' + Math.random().toString(16).substring(2),
            '0x' + Math.random().toString(16).substring(2),
          ],
          [
            '0x' + Math.random().toString(16).substring(2),
            '0x' + Math.random().toString(16).substring(2),
          ],
        ],
        pi_c: [
          '0x' + Math.random().toString(16).substring(2),
          '0x' + Math.random().toString(16).substring(2),
        ],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: [
        inputs.nullifier,
        ...inputs.winningNumbers.map(n => n.toString()),
        inputs.minMatches.toString(),
        inputs.ticketTreeRoot,
        inputs.drawId.toString(),
      ],
    };

    return mockProof;
  }

  /**
   * Compute nullifier from claim key
   *
   * This uses a simple hash. In production with full circuits,
   * this would use Poseidon hash to match the circuit.
   */
  computeNullifier(claimKey: string): string {
    // Simple hash for now
    // In production, should use poseidon hash from circomlibjs
    const encoder = new TextEncoder();
    const data = encoder.encode(claimKey);

    return crypto.subtle.digest('SHA-256', data).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }).then(hash => hash);
  }

  /**
   * Compute nullifier synchronously (fallback)
   */
  computeNullifierSync(claimKey: string): string {
    // Simple deterministic hash
    let hash = 0;
    for (let i = 0; i < claimKey.length; i++) {
      const char = claimKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Get ZKP system status
   */
  getStatus(): {
    available: boolean;
    mode: 'full' | 'mock';
    wasmPath: string;
    zkeyPath: string;
  } {
    return {
      available: this.isAvailable,
      mode: this.isAvailable ? 'full' : 'mock',
      wasmPath: this.wasmPath,
      zkeyPath: this.zkeyPath,
    };
  }
}

// Export singleton instance
export const zkpService = new ZKPService();
