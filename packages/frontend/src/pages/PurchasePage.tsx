import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { LOTTERY_CONFIG } from '@zottery/shared';
import './PurchasePage.css';

export default function PurchasePage() {
  const [lotteryAddress, setLotteryAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);

  useEffect(() => {
    loadLotteryAddress();
    generateRandomSelection();
  }, []);

  const loadLotteryAddress = async () => {
    try {
      setLoading(true);
      const response = await api.getLotteryAddress();
      if (response.success) {
        setLotteryAddress(response.address);
      } else {
        setError('Failed to load lottery address');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomSelection = () => {
    const numbers: number[] = [];
    const available = Array.from({ length: LOTTERY_CONFIG.MAX_NUMBER }, (_, i) => i + 1);

    for (let i = 0; i < LOTTERY_CONFIG.NUMBERS_PER_TICKET; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      numbers.push(available[randomIndex]);
      available.splice(randomIndex, 1);
    }

    setSelectedNumbers(numbers.sort((a, b) => a - b));
  };

  const toggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else {
      if (selectedNumbers.length < LOTTERY_CONFIG.NUMBERS_PER_TICKET) {
        setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
      }
    }
  };

  const getMemoString = () => {
    if (selectedNumbers.length !== LOTTERY_CONFIG.NUMBERS_PER_TICKET) return '';
    return `NUMS:${selectedNumbers.join(',')}`;
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(lotteryAddress);
    alert('Address copied to clipboard!');
  };

  const copyMemo = () => {
    navigator.clipboard.writeText(getMemoString());
    alert('Memo copied to clipboard!');
  };

  return (
    <div className="purchase-page">
      <div className="page-header">
        <h1>Buy Lottery Tickets</h1>
        <p>Select your numbers and send ZEC to purchase</p>
      </div>

      <div className="purchase-content">
        <div className="number-selection-section">
          <div className="section-header">
            <h2>1. Choose Your Numbers</h2>
            <button onClick={generateRandomSelection} className="random-button">
              Random Pick 🎲
            </button>
          </div>

          <div className="numbers-grid">
            {Array.from({ length: LOTTERY_CONFIG.MAX_NUMBER }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                className={`number-btn ${selectedNumbers.includes(num) ? 'selected' : ''}`}
                onClick={() => toggleNumber(num)}
                disabled={!selectedNumbers.includes(num) && selectedNumbers.length >= LOTTERY_CONFIG.NUMBERS_PER_TICKET}
              >
                {num}
              </button>
            ))}
          </div>

          <div className="selection-status">
            Selected: {selectedNumbers.length}/{LOTTERY_CONFIG.NUMBERS_PER_TICKET}
          </div>
        </div>

        <div className="purchase-info">
          <div className="info-card">
            <h3>2. Send Payment</h3>
            <ol className="purchase-steps">
              <li>
                <strong>Send ZEC to the lottery address</strong>
                <p>Price: {LOTTERY_CONFIG.TICKET_PRICE} ZEC per ticket</p>
              </li>
              <li>
                <strong>IMPORTANT: Include the Memo</strong>
                <p>You MUST include the generated memo below to register your numbers!</p>
              </li>
              <li>
                <strong>Wait for confirmation</strong>
                <p>Your ticket will be created automatically</p>
              </li>
            </ol>
          </div>

          <div className="info-card">
            <h3>Prize Structure</h3>
            <div className="prize-tiers">
              <div className="prize-tier">
                <span className="tier-matches">Match 5/5</span>
                <span className="tier-prize">Jackpot (50x Yield)</span>
              </div>
              <div className="prize-tier">
                <span className="tier-matches">Match 4/5</span>
                <span className="tier-prize">Tier 3 (5x Yield)</span>
              </div>
              <div className="prize-tier">
                <span className="tier-matches">Match 3/5</span>
                <span className="tier-prize">Tier 4 (1x Yield)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="center">
          <div className="loading"></div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {lotteryAddress && (
        <div className="payment-details-section">
          <h2>Payment Details</h2>

          <div className="payment-grid">
            <div className="address-card">
              <div className="address-label">Lottery Address (Shielded)</div>
              <div className="address-container">
                <code className="address">{lotteryAddress}</code>
                <button onClick={copyAddress} className="copy-button">Copy</button>
              </div>
            </div>

            <div className="memo-card">
              <div className="address-label">Memo (Required)</div>
              <div className="address-container">
                <code className="memo-text">{getMemoString() || 'Select 5 numbers...'}</code>
                <button
                  onClick={copyMemo}
                  className="copy-button"
                  disabled={selectedNumbers.length !== LOTTERY_CONFIG.NUMBERS_PER_TICKET}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="cli-instructions">
            <h3>Zcash CLI Command</h3>
            <div className="code-block">
              <code>
                zcash-cli z_sendmany "FROM_ADDRESS" '[{`{`}"address": "{lotteryAddress}", "amount": {LOTTERY_CONFIG.TICKET_PRICE}, "memo": "{Buffer.from(getMemoString()).toString('hex')}"{`}`}]'
              </code>
            </div>
            <p className="cli-note">Note: Memo must be hex-encoded for CLI</p>
          </div>
        </div>
      )}

      <div className="warning-section">
        <div className="alert alert-warning">
          <h3>⚠️ Important: Save Your Claim Key</h3>
          <p>
            After your transaction is confirmed, your ticket will be created automatically.
            You will need your private key or view key to prove ownership and claim prizes.
          </p>
        </div>
      </div>
    </div>
  );
}
