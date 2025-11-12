import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { zkpService } from '../services/zkp';
import { countMatches } from '@zottery/shared';
import './ClaimPage.css';

interface TicketInfo {
  ticketNumbers: number[];
  salt: string;
  claimKey: string;
}

export default function ClaimPageEnhanced() {
  const [drawId, setDrawId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [ticketInfo, setTicketInfo] = useState<TicketInfo>({
    ticketNumbers: [],
    salt: '',
    claimKey: '',
  });
  const [claimId, setClaimId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [zkpStatus, setZkpStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [proofProgress, setProofProgress] = useState('');

  useEffect(() => {
    checkZKPAvailability();
  }, []);

  const checkZKPAvailability = async () => {
    const available = await zkpService.checkAvailability();
    setZkpStatus(available ? 'available' : 'unavailable');
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProofProgress('');

    try {
      // Validate inputs
      if (!ticketInfo.ticketNumbers || ticketInfo.ticketNumbers.length !== 6) {
        throw new Error('Please enter all 6 ticket numbers');
      }

      if (!ticketInfo.salt || !ticketInfo.claimKey) {
        throw new Error('Please enter your ticket salt and claim key');
      }

      // Get draw information
      setProofProgress('Fetching draw information...');
      const drawResponse = await api.getDraw(parseInt(drawId));

      if (!drawResponse.success || !drawResponse.draw) {
        throw new Error('Draw not found');
      }

      const draw = drawResponse.draw;

      if (!draw.winningNumbers || draw.winningNumbers.length === 0) {
        throw new Error('Draw has not been executed yet');
      }

      // Check if ticket has winning numbers
      const matches = countMatches(ticketInfo.ticketNumbers, draw.winningNumbers);

      if (matches < 3) {
        throw new Error(`Your ticket has only ${matches} matches. You need at least 3 to win.`);
      }

      setProofProgress(`Your ticket has ${matches} matches! Generating proof...`);

      // Generate nullifier
      const nullifier = zkpService.computeNullifierSync(ticketInfo.claimKey);

      // Check if nullifier already used
      const nullifierCheck = await api.checkNullifier(nullifier);
      if (nullifierCheck.used) {
        throw new Error('This ticket has already been claimed');
      }

      // Generate ZK proof
      let zkProof;

      if (zkpStatus === 'available') {
        setProofProgress('Generating zero-knowledge proof... (this may take 10-30 seconds)');

        // TODO: Get merkle proof from backend
        // For now, use mock merkle proof
        const mockMerkleProof = Array(20).fill('0');
        const mockMerklePathIndices = Array(20).fill(0);

        zkProof = await zkpService.generateClaimProof({
          nullifier,
          winningNumbers: draw.winningNumbers,
          minMatches: matches,
          ticketTreeRoot: '0', // TODO: Get from backend
          drawId: parseInt(drawId),
          ticketNumbers: ticketInfo.ticketNumbers,
          salt: ticketInfo.salt,
          claimKey: ticketInfo.claimKey,
          merkleProof: mockMerkleProof,
          merklePathIndices: mockMerklePathIndices,
        });
      } else {
        setProofProgress('Generating mock proof (circuits not compiled)...');

        zkProof = zkpService.generateMockProof({
          nullifier,
          winningNumbers: draw.winningNumbers,
          minMatches: matches,
          ticketTreeRoot: '0',
          drawId: parseInt(drawId),
          ticketNumbers: ticketInfo.ticketNumbers,
          salt: ticketInfo.salt,
          claimKey: ticketInfo.claimKey,
          merkleProof: [],
          merklePathIndices: [],
        });
      }

      setProofProgress('Submitting claim...');

      // Submit claim
      const response = await api.submitClaim({
        drawId: parseInt(drawId),
        prizeMatches: matches,
        nullifier,
        zkProof,
        recipientAddress,
      });

      if (response.success && response.claimId) {
        setSuccess(
          `Claim submitted successfully!\n\nClaim ID: ${response.claimId}\nMatches: ${matches}/6\nEstimated payout time: ${response.estimatedPayoutTime}`
        );
        setClaimId(response.claimId);
        setProofProgress('');
      } else {
        throw new Error(response.error || 'Failed to submit claim');
      }
    } catch (err: any) {
      setError(err.message);
      setProofProgress('');
    } finally {
      setLoading(false);
    }
  };

  const handleNumbersChange = (value: string) => {
    // Parse comma-separated numbers
    const numbers = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    setTicketInfo({ ...ticketInfo, ticketNumbers: numbers });
  };

  return (
    <div className="claim-page">
      <div className="page-header">
        <h1>Claim Your Prize</h1>
        <p>Submit an anonymous claim using zero-knowledge proofs</p>
      </div>

      {zkpStatus === 'checking' && (
        <div className="alert alert-info">
          Checking ZKP system availability...
        </div>
      )}

      {zkpStatus === 'unavailable' && (
        <div className="alert alert-warning">
          <h3>⚠️ ZKP Circuits Not Compiled</h3>
          <p>
            The zero-knowledge proof circuits have not been compiled yet.
            Claims will use mock proofs for development.
          </p>
          <p>
            To enable full ZKP: Navigate to <code>circuits/</code> directory and run <code>./compile.sh && ./setup.sh</code>
          </p>
        </div>
      )}

      {zkpStatus === 'available' && (
        <div className="alert alert-success">
          <h3>✅ Full ZKP System Active</h3>
          <p>
            Zero-knowledge proof circuits are compiled and ready.
            Your claims will be cryptographically verified!
          </p>
        </div>
      )}

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
              <label htmlFor="ticketNumbers">Your Ticket Numbers</label>
              <input
                type="text"
                id="ticketNumbers"
                onChange={(e) => handleNumbersChange(e.target.value)}
                placeholder="7, 14, 21, 28, 35, 42"
                required
              />
              <small>Enter 6 comma-separated numbers (1-49)</small>
            </div>

            <div className="form-group">
              <label htmlFor="salt">Ticket Salt</label>
              <input
                type="text"
                id="salt"
                value={ticketInfo.salt}
                onChange={(e) => setTicketInfo({ ...ticketInfo, salt: e.target.value })}
                placeholder="Your ticket salt"
                required
              />
              <small>The salt from your ticket purchase</small>
            </div>

            <div className="form-group">
              <label htmlFor="claimKey">Claim Key</label>
              <input
                type="password"
                id="claimKey"
                value={ticketInfo.claimKey}
                onChange={(e) => setTicketInfo({ ...ticketInfo, claimKey: e.target.value })}
                placeholder="Your secret claim key"
                required
              />
              <small>The claim key you received when purchasing the ticket</small>
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

            {proofProgress && (
              <div className="proof-progress">
                <div className="loading"></div>
                <span>{proofProgress}</span>
              </div>
            )}

            <button
              type="submit"
              className="primary"
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Submit Claim'}
            </button>
          </form>

          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <pre style={{ whiteSpace: 'pre-wrap' }}>{success}</pre>
            </div>
          )}
        </div>

        <div className="claim-info-section">
          <h2>How Claiming Works</h2>

          <div className="info-card">
            <h3>Step 1: Enter Ticket Info</h3>
            <p>
              Enter your ticket numbers, salt, and claim key. This information
              is stored only on your device and never sent to the server.
            </p>
          </div>

          <div className="info-card">
            <h3>Step 2: Generate Proof</h3>
            <p>
              Your browser generates a zero-knowledge proof using your ticket information.
              This proves you own a winning ticket without revealing which one.
            </p>
          </div>

          <div className="info-card">
            <h3>Step 3: Submit Claim</h3>
            <p>
              The proof, along with a unique nullifier, is sent to the server. The nullifier
              prevents double-claiming without revealing your identity.
            </p>
          </div>

          <div className="info-card">
            <h3>Step 4: Receive Prize</h3>
            <p>
              After verification, your prize is sent to your shielded address. The transaction
              is completely private.
            </p>
          </div>
        </div>
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
