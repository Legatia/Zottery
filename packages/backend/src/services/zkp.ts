/**
 * Zero-Knowledge Proof Service
 *
 * Handles ZK proof verification for lottery claims.
 */

import { groth16 } from 'snarkjs';
import fs from 'fs';
import path from 'path';
import { ZKProof } from '@zottery/shared';

export class ZKPService {
  private verificationKey: any;
  private vKeyPath: string;

  constructor(vKeyPath?: string) {
    this.vKeyPath = vKeyPath || path.join(__dirname, '../circuits/verification_key.json');
  }

  /**
   * Initialize the ZKP service
   * Loads the verification key from file
   */
  async initialize(): Promise<void> {
    try {
      if (fs.existsSync(this.vKeyPath)) {
        const vKeyData = fs.readFileSync(this.vKeyPath, 'utf8');
        this.verificationKey = JSON.parse(vKeyData);
        console.log('✅ ZKP verification key loaded');
      } else {
        console.warn('⚠️  Verification key not found. ZKP verification will use fallback mode.');
        console.warn('   To enable full ZKP, compile circuits and copy verification_key.json to:');
        console.warn(`   ${this.vKeyPath}`);
      }
    } catch (error) {
      console.error('Error loading verification key:', error);
      throw error;
    }
  }

  /**
   * Verify a ZK proof for a lottery claim
   *
   * @param zkProof - The zero-knowledge proof
   * @param publicSignals - Public inputs to the circuit
   * @returns true if proof is valid, false otherwise
   */
  async verifyClaimProof(
    zkProof: ZKProof,
    publicSignals: {
      nullifier: string;
      winningNumbers: number[];
      minMatches: number;
      ticketTreeRoot: string;
      drawId: number;
    }
  ): Promise<boolean> {
    // If no verification key, use fallback validation
    if (!this.verificationKey) {
      return this.fallbackVerification(zkProof, publicSignals);
    }

    try {
      // Format public signals for snarkjs
      // Order must match circuit definition:
      // [nullifier, winningNumbers[6], minMatches, ticketTreeRoot, drawId]
      const formattedPublicSignals = [
        publicSignals.nullifier,
        ...publicSignals.winningNumbers.map(n => n.toString()),
        publicSignals.minMatches.toString(),
        publicSignals.ticketTreeRoot,
        publicSignals.drawId.toString(),
      ];

      // Verify proof using snarkjs
      const isValid = await groth16.verify(
        this.verificationKey,
        formattedPublicSignals,
        zkProof.proof
      );

      return isValid;
    } catch (error) {
      console.error('Error verifying ZK proof:', error);
      return false;
    }
  }

  /**
   * Fallback verification when circuits are not compiled
   *
   * This performs basic validation but NOT cryptographic proof verification.
   * Only use for development/testing!
   */
  private fallbackVerification(
    zkProof: ZKProof,
    publicSignals: {
      nullifier: string;
      winningNumbers: number[];
      minMatches: number;
      ticketTreeRoot: string;
      drawId: number;
    }
  ): boolean {
    console.warn('⚠️  Using fallback ZKP verification (not cryptographically secure)');

    // Basic structure validation
    if (!zkProof.proof || !zkProof.publicSignals) {
      return false;
    }

    // Verify proof has correct structure
    if (!zkProof.proof.pi_a || !zkProof.proof.pi_b || !zkProof.proof.pi_c) {
      return false;
    }

    // Verify public signals match
    if (zkProof.publicSignals.length < 10) {
      return false;
    }

    // Check nullifier matches
    if (zkProof.publicSignals[0] !== publicSignals.nullifier) {
      return false;
    }

    // Check draw ID matches
    const drawIdIndex = zkProof.publicSignals.length - 1;
    if (zkProof.publicSignals[drawIdIndex] !== publicSignals.drawId.toString()) {
      return false;
    }

    // Fallback passes basic validation
    console.log('✓ Fallback validation passed');
    return true;
  }

  /**
   * Validate proof structure
   */
  validateProofStructure(zkProof: ZKProof): boolean {
    if (!zkProof || !zkProof.proof) {
      return false;
    }

    const { proof } = zkProof;

    // Groth16 proof structure
    if (!proof.pi_a || !Array.isArray(proof.pi_a) || proof.pi_a.length !== 3) {
      return false;
    }

    if (!proof.pi_b || !Array.isArray(proof.pi_b) || proof.pi_b.length !== 3) {
      return false;
    }

    if (!proof.pi_c || !Array.isArray(proof.pi_c) || proof.pi_c.length !== 3) {
      return false;
    }

    if (proof.protocol !== 'groth16') {
      return false;
    }

    if (!zkProof.publicSignals || !Array.isArray(zkProof.publicSignals)) {
      return false;
    }

    return true;
  }

  /**
   * Check if ZKP system is fully enabled
   */
  isFullyEnabled(): boolean {
    return this.verificationKey !== undefined;
  }

  /**
   * Get verification key status
   */
  getStatus(): {
    enabled: boolean;
    mode: 'full' | 'fallback' | 'disabled';
    vKeyPath: string;
  } {
    if (!this.verificationKey) {
      return {
        enabled: false,
        mode: 'fallback',
        vKeyPath: this.vKeyPath,
      };
    }

    return {
      enabled: true,
      mode: 'full',
      vKeyPath: this.vKeyPath,
    };
  }
}
