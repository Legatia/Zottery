import React, { useState, useEffect } from 'react';
import { starknetService } from '../services/starknet';
import './StarknetWalletButton.css';

export const StarknetWalletButton: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Check if wallet is already connected
    const wallet = starknetService.getWallet();
    if (wallet) {
      setIsConnected(true);
      setAddress(wallet.address);
    }
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const wallet = await starknetService.connectWallet();
      setIsConnected(true);
      setAddress(wallet.address);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      alert('Failed to connect wallet. Please make sure you have ArgentX or Braavos installed.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await starknetService.disconnectWallet();
    setIsConnected(false);
    setAddress('');
  };

  if (isConnected) {
    return (
      <div className="starknet-wallet-connected">
        <div className="wallet-address">
          <span className="wallet-icon">⚡</span>
          <span className="address-text">
            {starknetService.formatAddress(address)}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="disconnect-button"
          title="Disconnect wallet"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting}
      className="connect-wallet-button"
    >
      {isConnecting ? (
        <>
          <span className="spinner"></span>
          Connecting...
        </>
      ) : (
        <>
          <span className="wallet-icon">⚡</span>
          Connect Starknet Wallet
        </>
      )}
    </button>
  );
};
