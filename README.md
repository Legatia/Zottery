# Zottery - Anonymous Lottery System

**Zottery** is a privacy-preserving lottery system that leverages Zcash for anonymous prize claims. Built with traditional lottery mechanics but enhanced with zero-knowledge proofs, Zottery allows winners to claim prizes without revealing their identity.

## Features

- **🎫 Traditional Lottery Mechanics**: Pick or get assigned 6 numbers from 1-49
- **🔒 Complete Anonymity**: Claim prizes without revealing identity using zero-knowledge proofs
- **⚡ Zcash Integration**: Leverages Zcash shielded transactions for private payouts
- **🎲 Provably Fair**: Verifiable random number generation for transparent draws
- **🎯 Multiple Prize Tiers**: Win with 3, 4, 5, or all 6 matching numbers
- **💻 Modern Stack**: TypeScript, React, Node.js, SQLite

## Architecture

The system consists of three main packages:

- **Backend** (`packages/backend`): Node.js + Express server handling ticket purchases, draws, and claims
- **Frontend** (`packages/frontend`): React application for user interaction
- **Shared** (`packages/shared`): Common types and utilities used across packages

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## How It Works

### 1. Ticket Purchase

Users send ZEC to the lottery's transparent address. The system:
- Detects the payment on-chain
- Generates 6 random numbers (or uses user-selected numbers)
- Creates a ticket with: `hash(numbers || salt || claim_key)`
- Returns the claim key to the user (must be saved securely!)

### 2. Draw Execution

After ticket sales close:
- Verifiable Random Function (VRF) generates 6 winning numbers
- System calculates prize distribution based on matches
- Results published transparently

### 3. Anonymous Claiming

Winners generate a zero-knowledge proof that proves:
- "I own a ticket with X matching numbers"
- WITHOUT revealing which ticket or their identity

The system verifies the proof and sends prizes to shielded z-addresses.

### 4. Prize Distribution

- **Match 6/6**: 60% of prize pool (Grand Prize)
- **Match 5/6**: 20% of prize pool
- **Match 4/6**: 15% of prize pool
- **Match 3/6**: 5% of prize pool

## Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Zcash Node** with RPC access
  - Testnet recommended for development
  - Must have a funded wallet for prize payouts

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Zottery
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all packages (root, backend, frontend, shared).

### 3. Configure Backend

Create `.env` file in `packages/backend/`:

```bash
cp packages/backend/.env.example packages/backend/.env
```

Edit `packages/backend/.env`:

```env
# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database
DATABASE_PATH=./data/zottery.db

# Zcash RPC Configuration (Testnet)
ZCASH_RPC_URL=http://localhost:18232
ZCASH_RPC_USER=zcash
ZCASH_RPC_PASSWORD=your_rpc_password

# Lottery Transparent Address
LOTTERY_TRANSPARENT_ADDRESS=t1YourTestnetAddressHere
```

### 4. Set Up Zcash Node

#### Install Zcash

Follow the official guide: https://z.cash/download/

#### Configure Zcash for Testnet

Edit `~/.zcash/zcash.conf`:

```conf
testnet=1
rpcuser=zcash
rpcpassword=your_rpc_password
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
server=1
```

#### Start Zcash Node

```bash
zcashd -daemon
```

Wait for sync (can take a while for first sync):

```bash
zcash-cli getblockchaininfo
```

#### Generate Lottery Address

```bash
# Generate transparent address for receiving ticket payments
zcash-cli getnewaddress

# Generate shielded address for testing claims
zcash-cli z_getnewaddress sapling
```

Use the transparent address in your `.env` file.

#### Get Testnet Funds

Visit a testnet faucet:
- https://faucet.testnet.z.cash/

## Running the Application

### Development Mode

Run both backend and frontend:

```bash
npm run dev
```

Or run separately:

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

### Zero-Knowledge Proof Setup (Optional but Recommended)

The system works in two modes:

**Development Mode** (Default):
- Uses mock proofs for testing
- No circuit compilation needed
- Claims processed with basic validation

**Production Mode** (Full ZKP):
- Real cryptographic proofs
- Complete anonymity guarantees
- Requires circuit compilation

To enable full ZKP:

```bash
cd circuits
npm install
./compile.sh    # Compile circuits (5-10 minutes)
./setup.sh      # Trusted setup (10-20 minutes)
./test.sh       # Test circuits

# Deploy to backend and frontend
cp build/verification_key.json ../packages/backend/src/circuits/
mkdir -p ../packages/frontend/public/circuits
cp build/claimVerifier.wasm ../packages/frontend/public/circuits/
cp build/claimVerifier_final.zkey ../packages/frontend/public/circuits/
```

See **[ZKP_SETUP.md](./ZKP_SETUP.md)** for detailed instructions.

### Production Build

```bash
# Build all packages
npm run build

# Start backend
npm run start:backend
```

For frontend, deploy the built files from `packages/frontend/dist` to a static host.

## Usage Guide

### For Users

#### 1. Buy Tickets

1. Navigate to "Buy Tickets" page
2. Copy the lottery address
3. Send ZEC using Zcash wallet:
   ```bash
   zcash-cli sendtoaddress <lottery-address> 1.0
   ```
4. Wait for confirmation (typically 2.5 minutes)
5. Your ticket will be created automatically

#### 2. Check Draws

1. Navigate to "Past Draws" page
2. View winning numbers and prize distribution
3. Check if your ticket numbers match

#### 3. Claim Prizes

1. Navigate to "Claim Prize" page
2. Enter draw ID
3. Enter your shielded address (z-address)
4. System generates zero-knowledge proof
5. Submit claim
6. Receive prize to your shielded address

### For Administrators

#### Manual Draw Execution (Development)

```bash
curl -X POST http://localhost:3001/api/dev/execute-draw \
  -H "Content-Type: application/json" \
  -d '{"drawId": 1}'
```

#### Check System Status

```bash
# Health check
curl http://localhost:3001/health

# Current draw
curl http://localhost:3001/api/draw/current
```

## API Documentation

### Draws

- `GET /api/draw/current` - Get current active draw
- `GET /api/draw/:drawId` - Get specific draw by ID
- `GET /api/draws` - Get all draws (paginated)

### Tickets

- `GET /api/lottery/address` - Get lottery address for purchases
- `GET /api/ticket/:ticketHash` - Get ticket information

### Claims

- `POST /api/claim/submit` - Submit a prize claim with ZK proof
- `GET /api/claim/:claimId` - Get claim status
- `GET /api/claim/nullifier/:nullifier` - Check if nullifier used

### Development Endpoints

- `POST /api/dev/execute-draw` - Manually execute a draw
- `POST /api/dev/verify-ticket` - Verify ticket can claim (without ZKP)

## Project Structure

```
Zottery/
├── circuits/                 # Zero-knowledge circuits
│   ├── claimVerifier.circom  # Main claim circuit
│   ├── merkle.circom         # Merkle tree verification
│   ├── matchCounter.circom   # Number matching
│   ├── ticketHash.circom     # Hash computations
│   ├── compile.sh            # Compilation script
│   ├── setup.sh              # Trusted setup script
│   ├── test.sh               # Circuit testing
│   ├── README.md             # Circuit documentation
│   └── build/                # Generated files (after setup)
│       ├── claimVerifier.wasm
│       ├── claimVerifier_final.zkey
│       └── verification_key.json
│
├── packages/
│   ├── backend/              # Backend server
│   │   ├── src/
│   │   │   ├── index.ts      # Main server entry
│   │   │   ├── database/     # Database layer
│   │   │   ├── services/     # Business logic
│   │   │   │   ├── zcash.ts  # Zcash integration
│   │   │   │   ├── tickets.ts # Ticket management
│   │   │   │   ├── draws.ts   # Draw execution
│   │   │   │   ├── claims.ts  # Claim processing
│   │   │   │   └── zkp.ts     # ZKP verification
│   │   │   ├── circuits/     # Verification key (after setup)
│   │   │   └── api/          # API routes
│   │   └── package.json
│   │
│   ├── frontend/             # React frontend
│   │   ├── src/
│   │   │   ├── App.tsx       # Main app component
│   │   │   ├── pages/        # Page components
│   │   │   └── services/     # API client + ZKP
│   │   ├── public/
│   │   │   └── circuits/     # Circuit files (after setup)
│   │   │       ├── claimVerifier.wasm
│   │   │       └── claimVerifier_final.zkey
│   │   └── package.json
│   │
│   └── shared/               # Shared types
│       ├── src/
│       │   └── types.ts      # Common interfaces
│       └── package.json
│
├── ARCHITECTURE.md           # System design docs
├── ZKP_SETUP.md              # ZKP setup guide
├── package.json              # Root package
└── README.md                 # This file
```

## Development Roadmap

### Current Status

- ✅ Backend API implementation
- ✅ Zcash integration
- ✅ Ticket purchase flow with automatic creation
- ✅ Draw execution with VRF
- ✅ Frontend UI with all pages
- ✅ **Full ZKP Circuit Implementation**
  - ✅ Circom circuits (ClaimVerifier, Merkle proof, match counter)
  - ✅ Compilation and setup scripts
  - ✅ Backend verification with snarkjs
  - ✅ Frontend proof generation in browser
  - ✅ Fallback mode for development
- ✅ Comprehensive documentation

### Next Steps

1. **Production Readiness**
   - Multi-party trusted setup ceremony (≥10 participants)
   - Security audit of circuits and implementation
   - Performance optimization for mobile devices

2. **Enhanced Features**
   - User-selected lottery numbers
   - Ticket storage in browser (encrypted)
   - Real-time transaction monitoring
   - Email/notification system

3. **Security Hardening**
   - Production-grade VRF (Chainlink VRF)
   - Multi-sig treasury management
   - Rate limiting and DDoS protection
   - Security audit

4. **Deployment**
   - Docker containerization
   - CI/CD pipeline
   - Monitoring and logging
   - Mainnet configuration

## Zero-Knowledge Proofs (Roadmap)

The ZKP circuit would prove:

```
Public Inputs:
- nullifier (derived from claim_key)
- winning numbers (6 numbers)
- prize matches (3-6)
- ticket set root (Merkle root)
- draw ID

Private Inputs:
- ticket numbers
- salt
- claim_key
- Merkle proof

Circuit Constraints:
1. hash(numbers, salt, claim_key) is in ticket set (Merkle proof)
2. count_matches(numbers, winning_numbers) >= prize_matches
3. nullifier = hash(claim_key)
4. All inputs are valid field elements
```

Implementation would use:
- **circom**: Circuit definition language
- **snarkjs**: ZK proof generation and verification
- **Groth16**: Efficient ZK-SNARK protocol

## Security Considerations

### Current Implementation

- ✅ Transparent ticket purchases (visible on-chain)
- ✅ Shielded prize distributions (private)
- ✅ Nullifier-based double-claim prevention
- ✅ VRF for provably fair draws
- ⚠️ Simplified proof verification (development)

### Production Requirements

- Implement full ZK-SNARK circuit
- Multi-sig wallet for prize pool
- Regular security audits
- Bug bounty program
- Rate limiting and abuse prevention

## Contributing

This is a proof-of-concept implementation. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Disclaimer

**This is experimental software for educational purposes.**

- Not audited for production use
- Test on testnet only
- No warranties or guarantees
- Use at your own risk

For production deployment, conduct thorough security audits and testing.

## Support

For questions or issues:
- Open an issue on GitHub
- Review the ARCHITECTURE.md for technical details
- Check Zcash documentation: https://z.cash/

## Acknowledgments

- **Zcash**: For privacy-preserving cryptocurrency technology
- **circom & snarkjs**: For zero-knowledge proof tools
- **The Zcash community**: For inspiration and technical resources

---

**Built with privacy in mind. Win anonymously with Zottery!** 🎫🔒
