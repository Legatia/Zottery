import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { GetDrawResponse } from '@zottery/shared';
import './HomePage.css';

export default function HomePage() {
  const [draw, setDraw] = useState<GetDrawResponse['draw'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentDraw();
  }, []);

  const loadCurrentDraw = async () => {
    try {
      setLoading(true);
      const response = await api.getCurrentDraw();
      if (response.success && response.draw) {
        setDraw(response.draw);
      } else {
        setError(response.error || 'No active draw');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatZEC = (amount: number) => {
    return `${amount.toFixed(4)} ZEC`;
  };

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Win Anonymously with Zottery</h1>
        <p className="hero-subtitle">
          The first truly private lottery. Choose your mode: traditional Zcash lottery or DeFi yield vault.
        </p>
      </section>

      {/* Lottery Modes Section */}
      <section className="lottery-modes">
        <h2>Choose Your Lottery Mode</h2>
        <div className="modes-grid">

          {/* Traditional Zcash Lottery */}
          <div className="mode-card traditional">
            <div className="mode-header">
              <div className="mode-icon">🎫</div>
              <h3>Traditional Lottery</h3>
              <div className="mode-badge classic">Classic</div>
            </div>

            <p className="mode-description">
              Buy tickets directly with ZEC. Simple, straightforward lottery.
            </p>

            <div className="mode-features">
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Pay per ticket with ZEC</span>
              </div>
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Traditional prize pool</span>
              </div>
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Simple & direct</span>
              </div>
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Anonymous claims</span>
              </div>
            </div>

            <div className="mode-stats">
              <div className="mode-stat">
                <div className="stat-label">Network</div>
                <div className="stat-value">Zcash</div>
              </div>
              <div className="mode-stat">
                <div className="stat-label">Risk</div>
                <div className="stat-value">Pay per ticket</div>
              </div>
            </div>

            <Link to="/purchase" className="mode-button traditional-btn">
              Buy Tickets →
            </Link>
          </div>

          {/* DeFi Vault Lottery */}
          <div className="mode-card vault featured">
            <div className="mode-header">
              <div className="mode-icon">💎</div>
              <h3>DeFi Vault Lottery</h3>
              <div className="mode-badge new">NEW</div>
            </div>

            <p className="mode-description">
              Deposit USDC, earn leveraged yield, and keep your principal. No-loss lottery!
            </p>

            <div className="mode-features">
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Keep your principal</span>
              </div>
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Earn 20% of yield</span>
              </div>
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>5x-10x leveraged prizes</span>
              </div>
              <div className="mode-feature">
                <span className="check">✓</span>
                <span>Cross-chain privacy</span>
              </div>
            </div>

            <div className="mode-stats">
              <div className="mode-stat">
                <div className="stat-label">Network</div>
                <div className="stat-value">Starknet + Zcash</div>
              </div>
              <div className="mode-stat">
                <div className="stat-label">Risk</div>
                <div className="stat-value">No loss (keep principal)</div>
              </div>
            </div>

            <Link to="/vault" className="mode-button vault-btn">
              Open Vault →
            </Link>
          </div>
        </div>

        <div className="mode-comparison">
          <h3>Which Mode is Right for You?</h3>
          <div className="comparison-grid">
            <div className="comparison-item">
              <strong>🎫 Traditional:</strong> Perfect if you have ZEC and want a simple, direct lottery experience
            </div>
            <div className="comparison-item">
              <strong>💎 DeFi Vault:</strong> Perfect if you want to earn yield while playing and keep your deposit safe
            </div>
          </div>
        </div>
      </section>

      <section className="current-draw">
        <h2>Current Traditional Draw</h2>
        {loading && (
          <div className="center">
            <div className="loading"></div>
          </div>
        )}

        {error && (
          <div className="alert alert-warning">
            {error}
          </div>
        )}

        {draw && (
          <div className="draw-info-grid">
            <div className="draw-info-card">
              <div className="draw-info-label">Draw #</div>
              <div className="draw-info-value">{draw.drawId}</div>
            </div>

            <div className="draw-info-card">
              <div className="draw-info-label">Prize Pool</div>
              <div className="draw-info-value prize-pool">
                {formatZEC(draw.prizePool)}
              </div>
            </div>

            <div className="draw-info-card">
              <div className="draw-info-label">Tickets Sold</div>
              <div className="draw-info-value">{draw.ticketsSold}</div>
            </div>

            <div className="draw-info-card">
              <div className="draw-info-label">Status</div>
              <div className="draw-info-value">
                <span className={`badge badge-${draw.status === 'open' ? 'success' : 'warning'}`}>
                  {draw.status.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="draw-info-card full-width">
              <div className="draw-info-label">Sales Close</div>
              <div className="draw-info-value">{formatDate(draw.salesCloseDate)}</div>
            </div>

            <div className="draw-info-card full-width">
              <div className="draw-info-label">Draw Date</div>
              <div className="draw-info-value">{formatDate(draw.drawDate)}</div>
            </div>

            {draw.winningNumbers && draw.winningNumbers.length > 0 && (
              <div className="draw-info-card full-width">
                <div className="draw-info-label">Winning Numbers</div>
                <div className="winning-numbers">
                  {draw.winningNumbers.map((num: number, idx: number) => (
                    <span key={idx} className="winning-ball">{num}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="features">
        <h2>Why Zottery?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Complete Privacy</h3>
            <p>
              Claim prizes anonymously using zero-knowledge proofs. No one knows who won.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Powered by Zcash</h3>
            <p>
              Leverages Zcash's shielded transactions for truly private prize distribution.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎲</div>
            <h3>Provably Fair</h3>
            <p>
              Verifiable random number generation ensures fair and transparent draws.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Multiple Prize Tiers</h3>
            <p>
              Match 3, 4, 5, or all 6 numbers to win. More chances to win prizes!
            </p>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Buy Tickets</h3>
              <p>
                Send ZEC to the lottery address and receive your ticket with 6 random numbers.
                Save your claim key securely!
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Wait for Draw</h3>
              <p>
                After sales close, winning numbers are generated using verifiable randomness.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Check Results</h3>
              <p>
                Compare your ticket numbers with the winning numbers. Match 3+ to win!
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Claim Anonymously</h3>
              <p>
                Generate a zero-knowledge proof and claim your prize to a shielded address.
                No identity required!
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Play?</h2>
        <p>Buy your tickets now for a chance to win anonymously!</p>
        <Link to="/purchase" className="btn-cta">
          Get Started
        </Link>
      </section>
    </div>
  );
}
