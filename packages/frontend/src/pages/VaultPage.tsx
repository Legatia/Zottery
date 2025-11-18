import React, { useState, useEffect } from 'react';
import { starknetService } from '../services/starknet';
import { StarknetWalletButton } from '../components/StarknetWalletButton';
import './VaultPage.css';

export const VaultPage: React.FC = () => {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawShares, setWithdrawShares] = useState('');
  const [userShares, setUserShares] = useState<bigint>(BigInt(0));
  const [totalAssets, setTotalAssets] = useState<bigint>(BigInt(0));
  const [leverage, setLeverage] = useState<number>(1);
  const [_totalYield, setTotalYield] = useState<bigint>(BigInt(0));
  const [apy, setApy] = useState<number>(0);
  const [deployedCapital, setDeployedCapital] = useState<bigint>(BigInt(0));
  const [prizePool, setPrizePool] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  useEffect(() => {
    loadVaultData();
    const interval = setInterval(loadVaultData, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  const loadVaultData = async () => {
    try {
      const wallet = starknetService.getWallet();
      if (!wallet) return;

      const [shares, assets, lev, yield_total, apyBps, deployed, pool] = await Promise.all([
        starknetService.getUserShares(),
        starknetService.getTotalAssets(),
        starknetService.getCurrentLeverage(),
        starknetService.getTotalYield(),
        starknetService.getAPY(),
        starknetService.getDeployedCapital(),
        starknetService.getCurrentPrizePool(),
      ]);

      setUserShares(shares);
      setTotalAssets(assets);
      setLeverage(lev);
      setTotalYield(yield_total);
      setApy(apyBps);
      setDeployedCapital(deployed);
      setPrizePool(pool);
    } catch (error) {
      console.error('Failed to load vault data:', error);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || !starknetService.isConnected()) return;

    setIsLoading(true);
    setTxHash('');

    try {
      // Convert USDC amount to contract format (assuming 6 decimals)
      const amount = BigInt(Math.floor(parseFloat(depositAmount) * 1_000_000));

      const hash = await starknetService.deposit(amount);
      setTxHash(hash);
      setDepositAmount('');

      // Reload vault data
      await loadVaultData();

      alert('Deposit successful! Your tickets will be generated automatically.');
    } catch (error) {
      console.error('Deposit failed:', error);
      alert('Deposit failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawShares || !starknetService.isConnected()) return;

    setIsLoading(true);
    setTxHash('');

    try {
      const shares = BigInt(withdrawShares);

      const hash = await starknetService.withdraw(shares);
      setTxHash(hash);
      setWithdrawShares('');

      // Reload vault data
      await loadVaultData();

      alert('Withdrawal successful!');
    } catch (error) {
      console.error('Withdrawal failed:', error);
      alert('Withdrawal failed: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateUserValue = (): string => {
    if (userShares === BigInt(0)) return '0';
    // Simplified calculation - in production, query contract
    return (Number(userShares) / 1_000_000).toFixed(2);
  };

  const getLeverageColor = (lev: number): string => {
    if (lev <= 2) return '#10b981'; // Green
    if (lev <= 5) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  const getLeverageRisk = (lev: number): string => {
    if (lev <= 2) return 'Low Risk';
    if (lev <= 5) return 'Medium Risk';
    return 'High Risk';
  };

  return (
    <div className="vault-page">
      <div className="vault-header">
        <div className="header-content">
          <h1>
            <span className="gradient-text">Leveraged Lottery Vault</span>
          </h1>
          <p className="subtitle">
            Deposit funds, earn leveraged yield, and automatically enter lottery draws
          </p>
        </div>
        <StarknetWalletButton />
      </div>

      {/* Vault Stats */}
      <div className="vault-stats">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Total Value Locked</div>
            <div className="stat-value">
              ${(Number(totalAssets) / 1_000_000).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Current Leverage</div>
            <div
              className="stat-value"
              style={{ color: getLeverageColor(leverage) }}
            >
              {leverage}x
            </div>
            <div className="stat-sublabel">{getLeverageRisk(leverage)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <div className="stat-label">Your Position</div>
            <div className="stat-value">${calculateUserValue()}</div>
            <div className="stat-sublabel">
              {Number(userShares).toLocaleString()} shares
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-label">Current APY</div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              {(apy / 100).toFixed(1)}%
            </div>
            <div className="stat-sublabel">Leveraged yield</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💎</div>
          <div className="stat-content">
            <div className="stat-label">Deployed Capital</div>
            <div className="stat-value">
              ${(Number(deployedCapital) / 1_000_000).toLocaleString()}
            </div>
            <div className="stat-sublabel">{leverage}x leveraged</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <div className="stat-label">Prize Pool</div>
            <div className="stat-value" style={{ color: '#8b5cf6' }}>
              ${(Number(prizePool) / 1_000_000).toLocaleString()}
            </div>
            <div className="stat-sublabel">Next draw</div>
          </div>
        </div>
      </div>

      {/* Deposit/Withdraw Forms */}
      <div className="vault-actions">
        {/* Deposit Form */}
        <div className="action-card">
          <h2>Deposit</h2>
          <p className="action-description">
            Deposit USDC to earn leveraged yield and receive lottery tickets
          </p>

          <form onSubmit={handleDeposit}>
            <div className="input-group">
              <label htmlFor="deposit-amount">Amount (USDC)</label>
              <input
                id="deposit-amount"
                type="number"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="100.00"
                disabled={!starknetService.isConnected() || isLoading}
              />
              <div className="input-hint">
                1 ticket per 100 USDC deposited
              </div>
            </div>

            <button
              type="submit"
              className="action-button deposit-button"
              disabled={!starknetService.isConnected() || isLoading || !depositAmount}
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                <>💎 Deposit & Enter Lottery</>
              )}
            </button>
          </form>

          <div className="deposit-info">
            <div className="info-item">
              <span className="info-icon">⚡</span>
              <span>Automatic lottery entry</span>
            </div>
            <div className="info-item">
              <span className="info-icon">📈</span>
              <span>Earn {leverage}x leveraged yield</span>
            </div>
            <div className="info-item">
              <span className="info-icon">🔒</span>
              <span>Anonymous prize claims via Zcash</span>
            </div>
          </div>
        </div>

        {/* Withdraw Form */}
        <div className="action-card">
          <h2>Withdraw</h2>
          <p className="action-description">
            Withdraw your funds from the vault (forfeit lottery tickets)
          </p>

          <form onSubmit={handleWithdraw}>
            <div className="input-group">
              <label htmlFor="withdraw-shares">Shares to Withdraw</label>
              <input
                id="withdraw-shares"
                type="number"
                step="1"
                min="0"
                max={Number(userShares)}
                value={withdrawShares}
                onChange={(e) => setWithdrawShares(e.target.value)}
                placeholder="0"
                disabled={!starknetService.isConnected() || isLoading}
              />
              <div className="input-hint">
                Available: {Number(userShares).toLocaleString()} shares
              </div>
            </div>

            <button
              type="button"
              className="max-button"
              onClick={() => setWithdrawShares(userShares.toString())}
              disabled={!starknetService.isConnected() || userShares === BigInt(0)}
            >
              Max
            </button>

            <button
              type="submit"
              className="action-button withdraw-button"
              disabled={
                !starknetService.isConnected() ||
                isLoading ||
                !withdrawShares ||
                userShares === BigInt(0)
              }
            >
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                <>💸 Withdraw</>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Transaction Status */}
      {txHash && (
        <div className="tx-status">
          <div className="tx-icon">✅</div>
          <div className="tx-content">
            <div className="tx-label">Transaction Successful</div>
            <a
              href={`https://sepolia.starkscan.co/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-link"
            >
              View on Starkscan →
            </a>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Deposit USDC</h3>
              <p>
                Deposit USDC into the leveraged vault. Your funds are deployed
                to DeFi strategies on Starknet.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Earn Leveraged Yield</h3>
              <p>
                The vault uses {leverage}x leverage to amplify returns. Yield
                accumulates to the prize pool.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Get Lottery Tickets</h3>
              <p>
                Receive 1 ticket per 100 USDC deposited. Tickets automatically
                enter upcoming draws.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Win & Claim Anonymously</h3>
              <p>
                If you win, claim your prize anonymously via Zcash using
                zero-knowledge proofs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
