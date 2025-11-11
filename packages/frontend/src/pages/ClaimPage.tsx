import { useState } from 'react';
import { api } from '../services/api';
import './ClaimPage.css';

export default function ClaimPage() {
  const [drawId, setDrawId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [claimId, setClaimId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // In production, this would generate a real ZK proof
      // For now, we show the flow
      const mockProof = {
        proof: {
          pi_a: ['0', '0'],
          pi_b: [['0', '0'], ['0', '0']],
          pi_c: ['0', '0'],
          protocol: 'groth16',
          curve: 'bn128',
        },
        publicSignals: ['0', '1', '2', '3', '4', '5', '3', '0', drawId],
      };

      const response = await api.submitClaim({
        drawId: parseInt(drawId),
        prizeMatches: 3,  // This would be calculated from actual numbers
        nullifier: '0x' + Math.random().toString(16).substring(2), // Mock nullifier
        zkProof: mockProof,
        recipientAddress,
      });

      if (response.success && response.claimId) {
        setSuccess(`Claim submitted successfully! Claim ID: ${response.claimId}`);
        setClaimId(response.claimId);
      } else {
        setError(response.error || 'Failed to submit claim');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="claim-page">
      <div className="page-header">
        <h1>Claim Your Prize</h1>
        <p>Submit an anonymous claim using zero-knowledge proofs</p>
      </div>

      <div className="alert alert-info">
        <h3>🔬 Development Version</h3>
        <p>
          This is a simplified version of the claiming interface. In production, the ZK proof
          generation would happen client-side using your ticket numbers, salt, and claim key.
        </p>
        <p>
          The proof would prove you own a winning ticket without revealing which ticket it is!
        </p>
      </div>

      <div className="claim-content">
        <div className="claim-form-section">
          <h2>Submit Claim</h2>
          <form onSubmit={handleSubmitClaim} className="claim-form">
            <div className="form-group">
              <label htmlFor="drawId">Draw ID</label>
              <input
                type="number"
                id="drawId"
                value={drawId}
                onChange={(e) => setDrawId(e.target.value)}
                placeholder="Enter draw ID"
                required
              />
              <small>The draw number you want to claim from</small>
            </div>

            <div className="form-group">
              <label htmlFor="recipientAddress">Shielded Address (z-address)</label>
              <input
                type="text"
                id="recipientAddress"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="zs1..."
                required
              />
              <small>Your Zcash shielded address to receive the prize</small>
            </div>

            <button
              type="submit"
              className="primary"
              disabled={loading}
            >
              {loading ? 'Generating Proof & Submitting...' : 'Submit Claim'}
            </button>
          </form>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              {success}
            </div>
          )}
        </div>

        <div className="claim-info-section">
          <h2>How Claiming Works</h2>

          <div className="info-card">
            <h3>Step 1: Generate Proof</h3>
            <p>
              Your browser generates a zero-knowledge proof using your ticket information
              (numbers, salt, claim key). This happens entirely on your device.
            </p>
          </div>

          <div className="info-card">
            <h3>Step 2: Submit Claim</h3>
            <p>
              The proof, along with a unique nullifier, is sent to the server. The nullifier
              prevents double-claiming without revealing your identity.
            </p>
          </div>

          <div className="info-card">
            <h3>Step 3: Verification</h3>
            <p>
              The server verifies your proof mathematically. If valid, it confirms you own
              a winning ticket without knowing which one.
            </p>
          </div>

          <div className="info-card">
            <h3>Step 4: Payout</h3>
            <p>
              Your prize is sent to your shielded address. The transaction is private -
              no one can see who received it or how much.
            </p>
          </div>
        </div>
      </div>

      <div className="production-notes">
        <h2>In Production</h2>
        <p>
          The full production version would include:
        </p>
        <ul>
          <li>Client-side ZK proof generation using your saved ticket data</li>
          <li>Automatic winning number checking</li>
          <li>Prize amount calculation</li>
          <li>Nullifier generation from your claim key</li>
          <li>Complete anonymity through zero-knowledge cryptography</li>
        </ul>
      </div>

      <div className="security-info">
        <h2>Security & Privacy</h2>
        <div className="security-grid">
          <div className="security-item">
            <div className="security-icon">🔐</div>
            <h3>Zero-Knowledge Proofs</h3>
            <p>
              Prove you're a winner without revealing your ticket or identity
            </p>
          </div>

          <div className="security-item">
            <div className="security-icon">🎭</div>
            <h3>Shielded Transactions</h3>
            <p>
              Prizes sent to z-addresses are completely private on the blockchain
            </p>
          </div>

          <div className="security-item">
            <div className="security-icon">🛡️</div>
            <h3>Nullifier Protection</h3>
            <p>
              Unique nullifiers prevent double-claiming while preserving anonymity
            </p>
          </div>

          <div className="security-item">
            <div className="security-icon">💻</div>
            <h3>Client-Side Processing</h3>
            <p>
              Your ticket data never leaves your device during proof generation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
