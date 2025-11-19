import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { LOTTERY_CONFIG } from '@zottery/shared';
import './PurchasePage.css';

export default function PurchasePage() {
  const [lotteryAddress, setLotteryAddress] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLotteryAddress();
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

  const copyAddress = () => {
    navigator.clipboard.writeText(lotteryAddress);
    alert('Address copied to clipboard!');
  };

  return (
    <div className="purchase-page">
      <div className="page-header">
        <h1>Buy Lottery Tickets</h1>
        <p>Send ZEC to purchase tickets for the current draw</p>
      </div>

      <div className="purchase-info">
        <div className="info-card">
          <h3>How to Purchase</h3>
          <ol className="purchase-steps">
            <li>
              <strong>Send ZEC to the lottery address below</strong>
              <p>Minimum: {LOTTERY_CONFIG.TICKET_PRICE} ZEC per ticket</p>
            </li>
            <li>
              <strong>Wait for confirmation</strong>
              <p>Your transaction needs at least 1 confirmation</p>
            </li>
            <li>
              <strong>Your ticket will be automatically created</strong>
              <p>Random numbers will be assigned to your ticket</p>
            </li>
            <li>
              <strong>Save your claim information</strong>
              <p>You'll need this to claim prizes anonymously!</p>
            </li>
          </ol>
        </div>

        <div className="info-card">
          <h3>Prize Structure</h3>
          <div className="prize-tiers">
            <div className="prize-tier">
              <span className="tier-matches">Match 5/5</span>
              <span className="tier-prize">60% of prize pool</span>
            </div>
            <div className="prize-tier">
              <span className="tier-matches">Match 4/5</span>
              <span className="tier-prize">20% of prize pool</span>
            </div>
            <div className="prize-tier">
              <span className="tier-matches">Match 3/5</span>
              <span className="tier-prize">15% of prize pool</span>
            </div>
          </div>
          <p className="prize-note">
            Prizes are split equally among winners in each tier
          </p>
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
        <div className="lottery-address-section">
          <h2>Lottery Address</h2>
          <div className="address-card">
            <div className="address-label">Send ZEC to this address:</div>
            <div className="address-container">
              <code className="address">{lotteryAddress}</code>
              <button onClick={copyAddress} className="copy-button">
                Copy
              </button>
            </div>
            <div className="address-info">
              <p>
                <strong>Amount:</strong> {LOTTERY_CONFIG.TICKET_PRICE} ZEC or more
              </p>
              <p className="info-note">
                Multiple of {LOTTERY_CONFIG.TICKET_PRICE} ZEC = multiple tickets
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="warning-section">
        <div className="alert alert-warning">
          <h3>⚠️ Important: Save Your Claim Key</h3>
          <p>
            After your transaction is confirmed, your ticket will be created automatically.
            Currently, this is a development version where tickets are tracked by transaction ID.
          </p>
          <p>
            <strong>In the full version:</strong> You will receive a unique claim key that you must save securely.
            Without this key, you cannot claim prizes even if you win! Store it in a password manager or write it down.
          </p>
        </div>
      </div>

      <div className="instructions-section">
        <h2>Using Zcash CLI</h2>
        <div className="code-block">
          <code>
            zcash-cli sendtoaddress {lotteryAddress || '<lottery-address>'} {LOTTERY_CONFIG.TICKET_PRICE}
          </code>
        </div>

        <h3 className="section-subtitle">Check Transaction Status</h3>
        <div className="code-block">
          <code>
            zcash-cli gettransaction &lt;txid&gt;
          </code>
        </div>
      </div>

      <div className="faq-section">
        <h2>Frequently Asked Questions</h2>

        <div className="faq-item">
          <h3>Can I choose my own numbers?</h3>
          <p>
            Currently, numbers are randomly assigned. A future version will allow custom number selection.
          </p>
        </div>

        <div className="faq-item">
          <h3>How long until my ticket is created?</h3>
          <p>
            Your ticket will be created automatically after 1 blockchain confirmation, typically within a few minutes.
          </p>
        </div>

        <div className="faq-item">
          <h3>Can I buy multiple tickets?</h3>
          <p>
            Yes! Send multiples of {LOTTERY_CONFIG.TICKET_PRICE} ZEC to purchase multiple tickets in a single transaction.
          </p>
        </div>

        <div className="faq-item">
          <h3>Is my purchase anonymous?</h3>
          <p>
            Purchases are made from transparent addresses, so they are visible on the blockchain.
            However, <strong>prize claiming is completely anonymous</strong> using zero-knowledge proofs and shielded addresses.
          </p>
        </div>
      </div>
    </div>
  );
}
