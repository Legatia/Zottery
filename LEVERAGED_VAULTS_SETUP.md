# Leveraged Lottery Vaults - Setup & Deployment Guide

This guide walks you through deploying and running the complete Leveraged Lottery Vaults system across Starknet and Zcash.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Starknet Contract Deployment](#starknet-contract-deployment)
4. [ZK Circuit Setup](#zk-circuit-setup)
5. [Relayer Service Setup](#relayer-service-setup)
6. [Frontend Deployment](#frontend-deployment)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)

---

## Prerequisites

### Required Software

- **Node.js** v18+ and npm/yarn
- **Rust** (for Cairo/Starknet development)
- **Scarb** v2.5.0+ (Starknet build tool)
- **Zcash Node** (zcashd) with RPC enabled
- **PostgreSQL** v14+ (for relayer database)
- **circom** v2.0.0+ (ZK circuit compiler)
- **snarkjs** v0.7.0+ (ZK proof generation)

### Wallets

- **Starknet Wallet**: ArgentX or Braavos browser extension
- **Zcash Wallet**: zcashd with shielded addresses (z-addresses)

### Testnet Funds

- **Starknet Sepolia ETH**: Get from [Starknet Faucet](https://faucet.goerli.starknet.io/)
- **Testnet ZEC**: Get from [Zcash Testnet Faucet](https://faucet.testnet.z.cash/)

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/Zottery.git
cd Zottery
```

### 2. Install Dependencies

```bash
# Install monorepo dependencies
npm install

# Install Starknet contracts dependencies
cd packages/starknet-contracts
scarb build

# Install relayer dependencies
cd ../relayer
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure Environment Variables

#### Frontend (.env)
```bash
cd packages/frontend
cp .env.example .env
```

Edit `packages/frontend/.env`:
```bash
VITE_STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
VITE_VAULT_ADDRESS=0x...  # Set after deployment
VITE_LOTTERY_MANAGER_ADDRESS=0x...
VITE_CLAIM_VERIFIER_ADDRESS=0x...
```

#### Relayer (.env)
```bash
cd packages/relayer
cp .env.example .env
```

Edit `packages/relayer/.env`:
```bash
# Starknet
STARKNET_RPC_URL=https://starknet-sepolia.public.blastapi.io
CLAIM_VERIFIER_ADDRESS=0x...

# Zcash
ZCASH_RPC_URL=http://localhost:18232  # Testnet port
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_secure_password
VAULT_Z_ADDRESS=ztestsapling1...  # Vault's testnet z-address

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=zottery_relayer
DB_USER=postgres
DB_PASSWORD=postgres

LOG_LEVEL=info
```

---

## Starknet Contract Deployment

### 1. Build Contracts

```bash
cd packages/starknet-contracts
scarb build
```

This generates:
- `target/dev/zottery_starknet_LeveragedVault.contract_class.json`
- `target/dev/zottery_starknet_LotteryManager.contract_class.json`
- `target/dev/zottery_starknet_ClaimVerifier.contract_class.json`

### 2. Declare Contracts

Using starkli or starknet-cli:

```bash
# Declare LeveragedVault
starkli declare \
  target/dev/zottery_starknet_LeveragedVault.contract_class.json \
  --rpc https://starknet-sepolia.public.blastapi.io \
  --account ~/.starkli-wallets/deployer/account.json \
  --keystore ~/.starkli-wallets/deployer/keystore.json

# Save the class hash output
VAULT_CLASS_HASH=0x...
```

Repeat for LotteryManager and ClaimVerifier.

### 3. Deploy Contracts

#### Deploy LeveragedVault
```bash
starkli deploy \
  $VAULT_CLASS_HASH \
  <owner_address> \
  <token_address> \
  <lottery_manager_address> \
  --rpc https://starknet-sepolia.public.blastapi.io \
  --account ~/.starkli-wallets/deployer/account.json \
  --keystore ~/.starkli-wallets/deployer/keystore.json

VAULT_ADDRESS=0x...
```

#### Deploy LotteryManager
```bash
starkli deploy \
  $LOTTERY_MANAGER_CLASS_HASH \
  <owner_address> \
  $VAULT_ADDRESS \
  <vrf_oracle_address> \
  --rpc https://starknet-sepolia.public.blastapi.io

LOTTERY_MANAGER_ADDRESS=0x...
```

#### Deploy ClaimVerifier
```bash
starkli deploy \
  $CLAIM_VERIFIER_CLASS_HASH \
  <owner_address> \
  $LOTTERY_MANAGER_ADDRESS \
  $VAULT_ADDRESS \
  <verification_key_hash> \
  --rpc https://starknet-sepolia.public.blastapi.io

CLAIM_VERIFIER_ADDRESS=0x...
```

### 4. Update Contract Addresses

Update `packages/frontend/.env` and `packages/relayer/.env` with deployed addresses.

---

## ZK Circuit Setup

### 1. Compile Starknet Claim Circuit

```bash
cd circuits
chmod +x compile-starknet.sh setup-starknet.sh
./compile-starknet.sh
```

This compiles the `starknetClaimVerifier.circom` circuit.

### 2. Trusted Setup

```bash
./setup-starknet.sh
```

This generates:
- `build/starknetClaimVerifier/starknetClaimVerifier_final.zkey` (proving key)
- `build/starknetClaimVerifier/verification_key.json` (verification key)

### 3. Deploy Verification Key

The verification key needs to be integrated into the ClaimVerifier contract.

**Option A: Hash the key and store on-chain**
```bash
# Compute verification key hash
node -e "
const vk = require('./build/starknetClaimVerifier/verification_key.json');
const hash = require('crypto').createHash('sha256');
hash.update(JSON.stringify(vk));
console.log('0x' + hash.digest('hex'));
"
```

Use this hash when deploying ClaimVerifier.

**Option B: Implement Groth16 verifier in Cairo**

For production, implement a full Groth16 verifier in Cairo. Reference:
- [Garaga](https://github.com/keep-starknet-strange/garaga) - Cairo verifier library

### 4. Copy Keys to Frontend

```bash
cp build/starknetClaimVerifier/starknetClaimVerifier_final.zkey \
   packages/frontend/public/starknetClaimVerifier.zkey

cp build/starknetClaimVerifier/starknetClaimVerifier_js/starknetClaimVerifier.wasm \
   packages/frontend/public/starknetClaimVerifier.wasm
```

---

## Relayer Service Setup

### 1. Setup PostgreSQL Database

```bash
# Create database
createdb zottery_relayer

# Or using psql
psql -U postgres -c "CREATE DATABASE zottery_relayer;"
```

### 2. Initialize Database Schema

The relayer will auto-initialize the schema on first run, or manually:

```bash
cd packages/relayer
npm run dev  # Runs initialization
```

### 3. Configure Zcash Node

Edit `zcash.conf`:
```conf
# Testnet
testnet=1

# RPC
server=1
rpcuser=zcashrpc
rpcpassword=your_secure_password
rpcport=18232
rpcallowip=127.0.0.1

# Enable shielded transactions
experimentalfeatures=1
```

Restart zcashd:
```bash
zcashd -daemon
```

### 4. Create Vault Z-Address

```bash
# Generate new shielded address
zcash-cli z_getnewaddress sapling

# Output: ztestsapling1...
# Save this as VAULT_Z_ADDRESS in relayer .env
```

### 5. Fund Vault Z-Address

Send testnet ZEC to the vault address for paying prizes:
```bash
zcash-cli z_sendmany <from_address> \
  '[{"address":"ztestsapling1...","amount":10.0}]'
```

### 6. Start Relayer

```bash
cd packages/relayer
npm run build
npm start
```

Expected output:
```
🚀 Starting Zottery Cross-Chain Relayer...
✅ Database connected
✅ Database schema initialized
🎬 Starting relayer service...
✅ Relayer service started successfully
📦 Checking blocks 0 to 12345
```

---

## Frontend Deployment

### 1. Build Frontend

```bash
cd packages/frontend
npm run build
```

Generates production build in `dist/`.

### 2. Serve Locally (Development)

```bash
npm run dev
```

Access at `http://localhost:5173`

### 3. Deploy to Production

#### Option A: Vercel
```bash
npm install -g vercel
vercel --prod
```

#### Option B: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

#### Option C: IPFS (Decentralized)
```bash
npm install -g ipfs
ipfs add -r dist/
```

---

## Testing

### 1. Test Starknet Wallet Connection

1. Open frontend: `http://localhost:5173`
2. Click "Connect Starknet Wallet"
3. Approve in ArgentX/Braavos
4. Verify address shows in header

### 2. Test Vault Deposit

1. Navigate to `/vault` page
2. Enter deposit amount (e.g., 100 USDC)
3. Click "Deposit & Enter Lottery"
4. Approve transaction in wallet
5. Wait for confirmation
6. Verify shares updated

### 3. Test Ticket Registration

After depositing, tickets should auto-register:
```bash
# Check lottery manager contract
starkli call \
  $LOTTERY_MANAGER_ADDRESS \
  get_current_draw_id \
  --rpc https://starknet-sepolia.public.blastapi.io

# Output: [1] (draw ID)
```

### 4. Test Draw Execution

Execute a draw (owner only):
```bash
starkli invoke \
  $LOTTERY_MANAGER_ADDRESS \
  execute_draw \
  1 \
  --rpc https://starknet-sepolia.public.blastapi.io \
  --account ~/.starkli-wallets/deployer/account.json
```

### 5. Test Claim Flow

1. Check if you won:
```bash
starkli call \
  $LOTTERY_MANAGER_ADDRESS \
  get_winning_commitment \
  1
```

2. If your ticket won, navigate to `/claim` page
3. Enter draw ID, ticket details
4. Generate ZK proof
5. Submit claim
6. Wait for relayer to process

### 6. Test Cross-Chain Payout

Monitor relayer logs:
```bash
cd packages/relayer
npm run dev

# Should show:
💰 Processing payout for nullifier: 0x...
💸 Sending 1.5 to ztestsapling1...
✅ Zcash payout sent! TX: abc123...
🎉 Payout completed for nullifier 0x...
```

Verify Zcash receipt:
```bash
zcash-cli z_listreceivedbyaddress <winner_z_address>
```

---

## Production Deployment

### Security Checklist

- [ ] Enable full Groth16 verification in ClaimVerifier contract
- [ ] Implement multi-sig relayer (3/5 or 5/7)
- [ ] Use hardware security module (HSM) for Zcash keys
- [ ] Enable rate limiting on relayer API
- [ ] Set up monitoring & alerting (Grafana/Prometheus)
- [ ] Audit smart contracts (Trail of Bits, OpenZeppelin)
- [ ] Implement emergency pause mechanism
- [ ] Set up automated backup for databases
- [ ] Use HTTPS/SSL for all endpoints
- [ ] Enable firewall rules for RPC endpoints

### Multi-Sig Relayer Setup

For production, deploy 5-7 independent relayers:

1. Each relayer runs on separate infrastructure
2. Use MPC (Multi-Party Computation) for Zcash key management
3. Require 3/5 or 5/7 signatures to authorize payouts
4. Implement slashing for malicious relayers

Libraries:
- [TSS (Threshold Signature Schemes)](https://github.com/ZenGo-X/multi-party-ecdsa)
- [Shamir's Secret Sharing](https://github.com/grempe/secrets.js)

### Monitoring

Set up monitoring for:
- Relayer uptime
- Starknet contract events
- Zcash node health
- Database replication lag
- Transaction success rate
- Gas prices (Starknet)

Tools:
- **Prometheus** for metrics
- **Grafana** for dashboards
- **Sentry** for error tracking
- **PagerDuty** for alerts

### Backup Strategy

1. **Database**: Daily automated backups to S3/IPFS
2. **Zcash Wallet**: Encrypted backup of wallet.dat
3. **Contract Keys**: Hardware wallet or HSM
4. **ZK Proving Keys**: IPFS or distributed storage

---

## Troubleshooting

### Starknet Contract Issues

**Error: "Invalid proof length"**
- Ensure proof has exactly 8 elements (Groth16 format)
- Check circuit compilation completed successfully

**Error: "Nullifier already used"**
- User trying to claim twice
- Check `is_nullifier_used` before claiming

### Relayer Issues

**Error: "Database not connected"**
- Check PostgreSQL is running: `pg_isready`
- Verify DB credentials in `.env`

**Error: "Zcash RPC connection failed"**
- Check zcashd is running: `zcash-cli getinfo`
- Verify RPC credentials match zcash.conf

**Error: "Insufficient funds in vault"**
- Fund vault z-address with ZEC
- Check balance: `zcash-cli z_getbalance <vault_z_address>`

### Frontend Issues

**Error: "Failed to connect wallet"**
- Install ArgentX or Braavos extension
- Refresh page after installation
- Check wallet is on correct network (Sepolia)

**Error: "Contract address not configured"**
- Update `.env` with deployed contract addresses
- Rebuild: `npm run build`

---

## Advanced Topics

### Adding DeFi Strategies

To integrate with Starknet DeFi protocols (zkLend, Nostra, etc.):

1. Create strategy contracts in `packages/starknet-contracts/src/strategies/`
2. Implement `IStrategy` interface:
   ```cairo
   trait IStrategy {
     fn deploy(amount: u256) -> u256;
     fn withdraw(shares: u256) -> u256;
     fn get_value() -> u256;
   }
   ```
3. Update LeveragedVault to call strategy contracts

### Implementing Automated Draws

Set up cron job or Chainlink Automation:

```bash
# Crontab: Run draw daily at midnight
0 0 * * * curl -X POST https://api.zottery.com/admin/execute-draw
```

Or use Starknet Keeper Network when available.

### Privacy Enhancements

1. **Stealth Addresses**: Generate new z-address per claim
2. **Decoy Transactions**: Send multiple Zcash txs to mask winner
3. **Timing Obfuscation**: Random delay (1-24 hrs) before payout
4. **Amount Splitting**: Split large payouts across multiple txs

---

## Support & Resources

- **Documentation**: [docs.zottery.com](https://docs.zottery.com)
- **Discord**: [discord.gg/zottery](https://discord.gg/zottery)
- **GitHub**: [github.com/zottery](https://github.com/zottery)

### External Resources

- [Starknet Docs](https://docs.starknet.io)
- [Cairo Book](https://book.cairo-lang.org)
- [Zcash Protocol Spec](https://zips.z.cash)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Circom Documentation](https://docs.circom.io)

---

**Happy Building! 🚀**

For questions or issues, please open a GitHub issue or reach out on Discord.
