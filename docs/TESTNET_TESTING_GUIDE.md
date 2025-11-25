# Zottery Testnet Testing Guide

Complete end-to-end testing guide for the Leveraged Lottery Vaults on Starknet Sepolia + Zcash Testnet.

## Prerequisites Checklist

- [ ] Starknet wallet installed (ArgentX or Braavos)
- [ ] Starknet Sepolia ETH for gas (from [faucet](https://faucet.goerli.starknet.io/))
- [ ] Zcash testnet node running (`zcashd -testnet`)
- [ ] Zcash testnet ZEC (from [faucet](https://faucet.testnet.z.cash/))
- [ ] PostgreSQL running (for relayer)
- [ ] Node.js v18+ installed

## Setup Phase

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/Zottery.git
cd Zottery
npm install
```

### 2. Deploy Starknet Contracts

```bash
cd packages/starknet-contracts

# Build contracts
scarb build

# Deploy to Sepolia
./scripts/deploy.sh sepolia
```

**Expected Output:**
```
✅ LeveragedVault deployed: 0xabc123...
✅ LotteryManager deployed: 0xdef456...
✅ ClaimVerifier deployed: 0x789ghi...
```

**Save these addresses!** You'll need them for configuration.

### 3. Compile ZK Circuits

```bash
cd ../../circuits

# Compile Starknet claim circuit
./compile-starknet.sh

# Run trusted setup
./setup-starknet.sh

# Copy to frontend
cp build/starknetClaimVerifier/starknetClaimVerifier_final.zkey \
   ../packages/frontend/public/
cp build/starknetClaimVerifier/starknetClaimVerifier_js/starknetClaimVerifier.wasm \
   ../packages/frontend/public/
```

**Expected Output:**
```
✅ Circuit compiled successfully!
✅ Trusted setup complete!
```

### 4. Configure Environment

#### Frontend Configuration
```bash
cd ../packages/frontend
cp ../.env.sepolia.example .env
```

Edit `.env`:
```bash
VITE_STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
VITE_VAULT_ADDRESS=0xabc123...  # From deployment
VITE_LOTTERY_MANAGER_ADDRESS=0xdef456...
VITE_CLAIM_VERIFIER_ADDRESS=0x789ghi...
```

#### Relayer Configuration
```bash
cd ../relayer
cp ../.env.sepolia.example .env
```

Edit `.env`:
```bash
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
CLAIM_VERIFIER_ADDRESS=0x789ghi...

ZCASH_RPC_URL=http://localhost:18232
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_password
VAULT_Z_ADDRESS=ztestsapling1...  # Generate below

DB_NAME=zottery_relayer_testnet
```

### 5. Setup Zcash Vault

```bash
# Generate vault z-address
zcash-cli -testnet z_getnewaddress sapling

# Output: ztestsapling1abcd...
# Copy this to relayer .env as VAULT_Z_ADDRESS

# Fund vault (get testnet ZEC from faucet)
# Send at least 10 ZEC to the vault address for payouts
```

### 6. Initialize Relayer Database

```bash
cd packages/relayer
npm install

# Create database
createdb zottery_relayer_testnet

# Start relayer (will auto-init schema)
npm run dev
```

**Expected Output:**
```
🚀 Starting Zottery Cross-Chain Relayer...
✅ Database connected
✅ Database schema initialized
✅ Relayer service started successfully
📦 Checking blocks 0 to 12345
```

Keep this running in a separate terminal!

---

## Testing Scenarios

### Test 1: Wallet Connection

**Objective:** Verify Starknet wallet integration works.

1. Start frontend:
```bash
cd packages/frontend
npm run dev
# Open http://localhost:5173
```

2. Navigate to `/vault` page

3. Click "Connect Starknet Wallet"

4. Approve connection in ArgentX/Braavos

**Expected Result:**
- ✅ Wallet address shows in header
- ✅ Vault stats load (TVL, leverage, etc.)
- ✅ No errors in console

**Common Issues:**
- Wallet not detected: Install ArgentX or Braavos extension
- Wrong network: Switch wallet to Sepolia testnet
- RPC errors: Check VITE_STARKNET_RPC_URL in .env

---

### Test 2: Deposit to Vault

**Objective:** Deposit USDC and receive vault shares.

**Prerequisites:**
- Sepolia ETH for gas
- Testnet USDC (can mint from faucet or swap)

**Steps:**

1. Get testnet USDC:
```bash
# Sepolia USDC address: 0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8
# Use Starknet faucet or testnet DEX
```

2. In frontend `/vault` page:
   - Enter amount: `1000` USDC
   - Click "Deposit & Enter Lottery"
   - Approve transaction in wallet

3. Wait for confirmation (~30 seconds)

**Expected Result:**
- ✅ Transaction successful
- ✅ "Your Position" updates with shares
- ✅ TVL increases
- ✅ Tickets generated (1 per 100 USDC = 10 tickets)

**Verification:**
```bash
# Check vault state on-chain
starkli call \
  $VITE_VAULT_ADDRESS \
  total_assets \
  --rpc https://starknet-sepolia.public.blastapi.io

# Should show 1000 USDC (in contract format)
```

**Common Issues:**
- Insufficient USDC: Get more from faucet
- Gas estimation failed: Increase gas limit
- Transaction reverted: Check contract is not paused

---

### Test 3: Leverage Execution

**Objective:** Vault takes leveraged position.

**Prerequisites:**
- Vault has deposits from Test 2

**Steps:**

1. Call execute_strategy (owner only):
```bash
starkli invoke \
  $VITE_VAULT_ADDRESS \
  execute_strategy \
  --rpc https://starknet-sepolia.public.blastapi.io \
  --account ~/.starkli-wallets/deployer/account.json \
  --keystore ~/.starkli-wallets/deployer/keystore.json
```

2. Refresh frontend `/vault` page

**Expected Result:**
- ✅ "Deployed Capital" = TVL × Leverage
- ✅ Example: 1000 USDC × 5x = 5000 USDC deployed
- ✅ Event emitted: `StrategyExecuted`

**Verification:**
```bash
starkli call \
  $VITE_VAULT_ADDRESS \
  get_deployed_capital \
  --rpc https://starknet-sepolia.public.blastapi.io

# Should show 5000 USDC (1000 × 5x)
```

---

### Test 4: Yield Harvest

**Objective:** Harvest simulated yield and update prize pool.

**Note:** In testnet, yield is simulated based on time elapsed. In production, this would claim from real DeFi protocols.

**Steps:**

1. Wait at least 1 hour (for time-based yield calculation)

2. Call harvest_yield:
```bash
starkli invoke \
  $VITE_VAULT_ADDRESS \
  harvest_yield \
  --rpc https://starknet-sepolia.public.blastapi.io \
  --account ~/.starkli-wallets/deployer/account.json
```

3. Check relayer logs for prize pool update

4. Refresh frontend

**Expected Result:**
- ✅ "Total Yield" increases
- ✅ "Prize Pool" updates (80% of yield)
- ✅ Event: `YieldAccrued`
- ✅ Relayer sees: `PrizePoolUpdated`

**Verification:**
```bash
# Check total yield
starkli call $VITE_VAULT_ADDRESS get_total_yield --rpc ...

# Check prize pool
starkli call $VITE_LOTTERY_MANAGER_ADDRESS get_prize_pool --rpc ...
```

**Yield Calculation:**
```
Time elapsed: 1 hour = 3600 seconds
Deployed capital: 5000 USDC
APY: 10% (simulated)

Yield = 5000 × 0.10 × (3600 / 31536000)
      = 5000 × 0.10 × 0.000114
      = 0.057 USDC

To prize pool (80%): 0.046 USDC
```

---

### Test 5: Draw Execution

**Objective:** Execute lottery draw and select winner.

**Prerequisites:**
- At least 1 ticket registered
- Prize pool > 0

**Steps:**

1. Get current draw ID:
```bash
starkli call \
  $VITE_LOTTERY_MANAGER_ADDRESS \
  get_current_draw_id \
  --rpc https://starknet-sepolia.public.blastapi.io

# Output: 1
```

2. Execute draw:
```bash
starkli invoke \
  $VITE_LOTTERY_MANAGER_ADDRESS \
  execute_draw \
  1 \
  --rpc https://starknet-sepolia.public.blastapi.io \
  --account ~/.starkli-wallets/deployer/account.json
```

3. Check winning commitment:
```bash
starkli call \
  $VITE_LOTTERY_MANAGER_ADDRESS \
  get_winning_commitment \
  1 \
  --rpc https://starknet-sepolia.public.blastapi.io

# Output: 0x1a2b3c... (winning commitment hash)
```

**Expected Result:**
- ✅ Draw executed successfully
- ✅ Winning commitment selected
- ✅ Prize pool assigned to draw
- ✅ Current draw ID incremented to 2
- ✅ Event: `DrawExecuted`

**Verification:**
```bash
# Check draw is executed
starkli call \
  $VITE_LOTTERY_MANAGER_ADDRESS \
  is_draw_executed \
  1 \
  --rpc ...

# Output: true
```

---

### Test 6: Anonymous Claim (Cross-Chain)

**Objective:** Winner claims prize anonymously via Zcash.

**Prerequisites:**
- You are the winner (check winning commitment matches your ticket)
- Relayer is running
- Vault z-address has ZEC

**Steps:**

1. **Check if you won:**
```typescript
// In frontend, you stored:
// - ticket_id
// - secret_salt
// Compute your commitment:
const commitment = poseidon([ticket_id, secret_salt])

// Compare with winning commitment
const winningCommitment = await lottery.get_winning_commitment(1)
if (commitment === winningCommitment) {
  console.log("🎉 YOU WON!")
}
```

2. **Generate ZK Proof** (in frontend `/claim` page):
   - Enter draw ID: `1`
   - Enter your Zcash z-address: `ztestsapling1...`
   - Frontend generates proof using snarkjs
   - Proof takes ~30 seconds in browser

3. **Submit claim:**
   - Click "Submit Claim"
   - Approve Starknet transaction
   - Wait for confirmation

4. **Monitor relayer:**
```bash
# Relayer logs should show:
💰 Processing payout for nullifier: 0x...
💸 Sending 0.046 to ztestsapling1...
✅ Zcash payout sent! TX: abc123...
🎉 Payout completed
```

5. **Verify Zcash receipt:**
```bash
zcash-cli -testnet z_listreceivedbyaddress YOUR_Z_ADDRESS

# Should show incoming shielded transaction
```

**Expected Result:**
- ✅ Claim transaction succeeds on Starknet
- ✅ Nullifier marked as used
- ✅ Relayer detects `PayoutAuthorized` event
- ✅ Zcash transaction sent to winner's z-address
- ✅ Winner receives prize (shielded)
- ✅ Privacy maintained: no public link between Starknet and Zcash addresses

**Privacy Verification:**
- Block explorer shows claim transaction but NOT recipient
- Zcash blockchain shows shielded transaction (amount hidden)
- Winner's identity never revealed

---

### Test 7: Zottery Swap & Bridge (New)

**Objective:** Test the end-to-end flow of bridging ZEC and swapping.

**Prerequisites:**
- Zcash Testnet Wallet (e.g., YWallet, Zecwallet Lite)
- Starknet Wallet (ArgentX/Braavos)
- Testnet ZEC (from faucet)

**Step 1: Deposit ZEC (Mint stZEC)**
1. Open your Zcash wallet.
2. Send **1 ZEC** to the **Vault Z-Address** (found in Relayer logs or Frontend Bridge tab).
3. **CRITICAL:** In the **Memo** field, paste your **Starknet Address** (e.g., `0x123...`).
4. Send the transaction.
5. Wait for Relayer to detect deposit (check logs).
6. **Result:** You should receive `1.0 stZEC` in your Starknet wallet.

**Step 2: Swap stZEC for USDC**
1. Go to the **Swap** page in the Frontend (`/swap`).
2. Select **stZEC** -> **USDC**.
3. Enter amount: `0.5`.
4. Click **Swap**.
5. Approve transaction.
6. **Result:** Your `stZEC` balance decreases, `USDC` balance increases.

**Step 3: Withdraw ZEC (Burn stZEC)**
1. Go to the **Bridge** tab in the Frontend (`/swap`).
2. Enter Amount: `0.4`.
3. Enter **Destination Z-Address** (your Zcash wallet address).
4. Click **Withdraw to Zcash**.
5. Approve transaction (this calls `stZEC.burn_to_zcash`).
6. Wait for Relayer to detect withdrawal event.
7. **Result:** You receive `0.4 ZEC` (minus fees) in your Zcash wallet.

---

### Test 8: Withdrawal (Vault)

**Objective:** Withdraw funds from vault.

**Steps:**

1. In frontend `/vault` page:
   - Click "Max" to withdraw all shares
   - Click "Withdraw"
   - Approve transaction

2. Wait for confirmation

**Expected Result:**
- ✅ Shares redeemed for USDC
- ✅ User receives principal + yield share
- ✅ TVL decreases
- ✅ Lottery tickets forfeited

**Verification:**
```bash
# Check user shares = 0
starkli call \
  $VITE_VAULT_ADDRESS \
  user_shares \
  YOUR_ADDRESS \
  --rpc ...

# Output: 0
```

---

## Performance Metrics

Track these metrics during testing:

| Metric | Target | Actual |
|--------|--------|--------|
| Deposit gas cost | < 50,000 | ___ |
| Claim gas cost | < 200,000 | ___ |
| ZK proof generation | < 60s | ___ |
| Relayer latency | < 5 min | ___ |
| Zcash confirmation | ~2.5 min | ___ |

---

## Troubleshooting

### Issue: Contract not found

**Solution:**
- Verify contract addresses in .env match deployment output
- Check RPC URL is correct for Sepolia
- Ensure contracts were deployed successfully

### Issue: ZK proof generation fails

**Solution:**
- Check browser console for errors
- Verify circuit files (.wasm, .zkey) are in public/ folder
- Ensure proof inputs are correct format
- Try incognito mode (disable extensions)

### Issue: Relayer not processing claims

**Solution:**
```bash
# Check relayer is running
ps aux | grep relayer

# Check database connection
psql -d zottery_relayer_testnet -c "SELECT * FROM relayer_state;"

# Check Zcash node
zcash-cli -testnet getinfo

# Check vault z-address balance
zcash-cli -testnet z_getbalance VAULT_Z_ADDRESS
```

### Issue: Transaction reverted

**Common Causes:**
- Insufficient gas
- Contract paused
- Invalid inputs
- Permission denied (owner-only functions)

**Debug:**
```bash
# Get transaction receipt
starkli transaction TXHASH --rpc ...

# Check contract state
starkli call CONTRACT_ADDRESS FUNCTION --rpc ...
```

---

## Success Criteria

Your testnet deployment is ready for mainnet when:

- [ ] All 7 test scenarios pass
- [ ] No errors in relayer logs for 24 hours
- [ ] At least 3 successful cross-chain claims
- [ ] Prize pool grows with harvests
- [ ] Frontend loads without errors
- [ ] ZK proofs generate in < 60 seconds
- [ ] Zcash payouts arrive within 10 minutes

---

## Next Steps

1. **Security Audit:** Have contracts audited by Trail of Bits, OpenZeppelin, etc.
2. **Load Testing:** Test with 100+ concurrent users
3. **Multi-Sig Relayers:** Deploy 5-7 independent relayers
4. **Real DeFi Integration:** Connect to zkLend, Jediswap, Ekubo
5. **Mainnet Deployment:** Deploy to Starknet mainnet + Zcash mainnet

---

## Support

- **Discord:** [discord.gg/zottery](https://discord.gg/zottery)
- **GitHub Issues:** [github.com/zottery/issues](https://github.com/zottery/issues)
- **Docs:** [docs.zottery.com](https://docs.zottery.com)

**Happy Testing! 🚀**
