import { useState } from 'react'
import './SwapPage.css'

type Tab = 'swap' | 'pool' | 'bridge'

export default function SwapPage() {
    const [activeTab, setActiveTab] = useState<Tab>('swap')
    const [tokenIn, setTokenIn] = useState('USDC')
    const [tokenOut, setTokenOut] = useState('stZEC')
    const [amountIn, setAmountIn] = useState('')
    const [amountOut, setAmountOut] = useState('')
    const [zAddress, setZAddress] = useState('')

    const handleSwap = () => {
        console.log('Swapping', amountIn, tokenIn, 'for', tokenOut)
    }

    const handleBridgeWithdraw = () => {
        console.log('Withdrawing', amountIn, 'stZEC to', zAddress)
        // TODO: Call stZEC.burn_to_zcash(amount, zAddress)
    }

    const handleSwitchTokens = () => {
        setTokenIn(tokenOut)
        setTokenOut(tokenIn)
        setAmountIn(amountOut)
        setAmountOut(amountIn)
    }

    return (
        <div className="swap-page">
            <div className="swap-container">
                <div className="tabs">
                    <div
                        className={`tab ${activeTab === 'swap' ? 'active' : ''}`}
                        onClick={() => setActiveTab('swap')}
                    >
                        Swap
                    </div>
                    <div
                        className={`tab ${activeTab === 'pool' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pool')}
                    >
                        Pool
                    </div>
                    <div
                        className={`tab ${activeTab === 'bridge' ? 'active' : ''}`}
                        onClick={() => setActiveTab('bridge')}
                    >
                        Bridge
                    </div>
                </div>

                <div className="swap-header">
                    <h2>
                        {activeTab === 'swap' && 'Swap'}
                        {activeTab === 'pool' && 'Add Liquidity'}
                        {activeTab === 'bridge' && 'Zcash Bridge'}
                    </h2>
                    <button className="swap-settings-btn">⚙️</button>
                </div>

                {activeTab === 'bridge' ? (
                    <div className="bridge-content">
                        <div className="bridge-section">
                            <h3>Deposit ZEC (Mint stZEC)</h3>
                            <p className="instruction-text">
                                Send ZEC to the Vault Z-Address with your Starknet address as the <strong>memo</strong>.
                            </p>
                            <div className="address-box">
                                <span className="label">Vault Z-Address:</span>
                                <code className="address">ztestsapling1...</code>
                                <button className="copy-btn">📋</button>
                            </div>
                        </div>

                        <div className="divider"></div>

                        <div className="bridge-section">
                            <h3>Withdraw ZEC (Burn stZEC)</h3>
                            <div className="token-input-container">
                                <div className="input-header">
                                    <span>Amount</span>
                                    <span>Balance: 0.00 stZEC</span>
                                </div>
                                <div className="input-row">
                                    <input
                                        type="number"
                                        className="token-amount-input"
                                        placeholder="0.00"
                                        value={amountIn}
                                        onChange={(e) => setAmountIn(e.target.value)}
                                    />
                                    <span className="token-label">stZEC</span>
                                </div>
                            </div>

                            <div className="token-input-container">
                                <div className="input-header">
                                    <span>Destination Z-Address</span>
                                </div>
                                <input
                                    type="text"
                                    className="text-input"
                                    placeholder="ztestsapling1..."
                                    value={zAddress}
                                    onChange={(e) => setZAddress(e.target.value)}
                                />
                            </div>

                            <button className="swap-action-btn" onClick={handleBridgeWithdraw}>
                                Withdraw to Zcash
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="token-input-container">
                            <div className="input-header">
                                <span>You pay</span>
                                <span>Balance: 0.00</span>
                            </div>
                            <div className="input-row">
                                <input
                                    type="number"
                                    className="token-amount-input"
                                    placeholder="0"
                                    value={amountIn}
                                    onChange={(e) => setAmountIn(e.target.value)}
                                />
                                <button className="token-select-btn">
                                    {tokenIn} <span>▼</span>
                                </button>
                            </div>
                        </div>

                        <div className="swap-arrow">
                            <button className="swap-arrow-btn" onClick={handleSwitchTokens}>
                                ↓
                            </button>
                        </div>

                        <div className="token-input-container">
                            <div className="input-header">
                                <span>You receive</span>
                                <span>Balance: 0.00</span>
                            </div>
                            <div className="input-row">
                                <input
                                    type="number"
                                    className="token-amount-input"
                                    placeholder="0"
                                    value={amountOut}
                                    onChange={(e) => setAmountOut(e.target.value)}
                                />
                                <button className="token-select-btn">
                                    {tokenOut} <span>▼</span>
                                </button>
                            </div>
                        </div>

                        {activeTab === 'swap' && (
                            <div className="swap-details">
                                <div className="detail-row">
                                    <span>Rate</span>
                                    <span className="detail-value">1 {tokenIn} = 0.025 {tokenOut}</span>
                                </div>
                                <div className="detail-row">
                                    <span>Network Fee</span>
                                    <span className="detail-value">~$0.50</span>
                                </div>
                                <div className="detail-row">
                                    <span>Lottery Fee (0.05%)</span>
                                    <span className="detail-value">0.0005 {tokenIn}</span>
                                </div>
                            </div>
                        )}

                        <button className="swap-action-btn" onClick={handleSwap}>
                            {activeTab === 'swap' ? 'Swap' : 'Add Liquidity'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
