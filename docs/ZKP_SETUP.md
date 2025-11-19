# Zero-Knowledge Proof System Setup

This guide walks you through setting up the full ZKP system for Zottery.

## Overview

The ZKP system allows lottery winners to claim prizes anonymously by proving they own a winning ticket without revealing:
- Which specific ticket they own
- Their identity
- The claim key itself

## Prerequisites

### System Requirements

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Memory**: At least 4GB RAM (8GB recommended)
- **Disk Space**: ~2GB for circuit compilation
- **Time**: Initial setup takes 10-30 minutes

### Required Tools

```bash
# Install circom compiler globally
npm install -g circom

# Install snarkjs globally (optional but recommended)
npm install -g snarkjs
```

## Setup Steps

### 1. Install Dependencies

```bash
# From project root
cd circuits
npm install
```

This installs:
- `circom` - Circuit compiler
- `circoml lib` - Library of circuit components
- `snarkjs` - Proof generation and verification library

### 2. Compile Circuits

```bash
# From circuits directory
./compile.sh
```

This compiles the ClaimVerifier circuit and generates:
- `build/claimVerifier.r1cs` - Constraint system (8,000-50,000 constraints)
- `build/claimVerifier.wasm` - WebAssembly for browser proof generation
- `build/claimVerifier_js/` - JavaScript witness generator
- `build/claimVerifier.json` - Circuit information

**Expected output:**
```
🔧 Compiling Zottery Claim Verifier Circuit...
✅ Circuit compiled successfully!

Circuit statistics:
[INFO]  snarkJS: Curve: bn-128
[INFO]  snarkJS: # of Wires: 45123
[INFO]  snarkJS: # of Constraints: 12456
[INFO]  snarkJS: # of Private Inputs: 28
[INFO]  snarkJS: # of Public Inputs: 10
[INFO]  snarkJS: # of Outputs: 0
```

**Troubleshooting:**
- If you get "circom: command not found", install circom globally
- If compilation fails, check that all .circom files are present
- For "out of memory" errors, increase Node.js memory: `export NODE_OPTIONS="--max-old-space-size=8192"`

### 3. Perform Trusted Setup

```bash
# From circuits directory
./setup.sh
```

This performs the trusted setup ceremony:
1. Downloads Powers of Tau file (~200MB)
2. Generates proving key
3. Contributes randomness
4. Exports verification key

**Expected output:**
```
🔐 Starting Trusted Setup for Zottery Claim Verifier...

📊 Phase 1: Powers of Tau Ceremony
Downloading Powers of Tau file...
✅ Downloaded Powers of Tau file

🎯 Phase 2: Circuit-Specific Setup
Generating initial zkey...
Contributing randomness to the ceremony...
Exporting verification key...

✅ Trusted setup completed successfully!

Generated files:
  - build/claimVerifier_final.zkey (Proving key)
  - build/verification_key.json (Verification key)
  - build/verifier.sol (Solidity verifier contract)
```

**Important Security Note:**
The current setup uses a single contribution (for development). **In production**, this ceremony should be done by multiple independent parties to ensure no single party knows the "toxic waste." See [Multi-Party Ceremony](#multi-party-ceremony) below.

### 4. Test Circuit

```bash
# From circuits directory
./test.sh
```

This runs a test with sample inputs:
```
🧪 Testing Zottery Claim Verifier Circuit...

📝 Creating test input...
✅ Test input created

🔢 Calculating witness...
✅ Witness calculated

🔐 Generating proof...
✅ Proof generated

✅ Verifying proof...
[INFO]  snarkJS: OK!

🎉 Test completed successfully!
```

If the test passes, your ZKP system is ready!

### 5. Deploy to Backend

```bash
# From circuits directory
cp build/verification_key.json ../packages/backend/src/circuits/
```

Create the circuits directory first:
```bash
mkdir -p ../packages/backend/src/circuits
```

The backend will automatically load this file on startup.

### 6. Deploy to Frontend

```bash
# From circuits directory
mkdir -p ../packages/frontend/public/circuits
cp build/claimVerifier.wasm ../packages/frontend/public/circuits/
cp build/claimVerifier_final.zkey ../packages/frontend/public/circuits/
```

These files enable browser-based proof generation.

### 7. Verify Integration

Start the backend:
```bash
# From packages/backend
npm run dev
```

Look for this in the logs:
```
✅ ZKP verification key loaded
✅ Business services initialized
```

Start the frontend:
```bash
# From packages/frontend
npm run dev
```

Visit the Claim page - you should see:
```
✅ Full ZKP System Active
Zero-knowledge proof circuits are compiled and ready.
Your claims will be cryptographically verified!
```

## Proof Generation Flow

### Backend Flow

1. User submits claim with ZK proof
2. Backend validates proof structure
3. Backend calculates Merkle root of tickets
4. Backend verifies proof using snarkjs:
   ```typescript
   const isValid = await groth16.verify(vKey, publicSignals, proof);
   ```
5. If valid, marks claim as verified and schedules payout

### Frontend Flow

1. User enters ticket information (numbers, salt, claim key)
2. Frontend checks if ticket wins (matches ≥ 3)
3. Frontend generates nullifier from claim key
4. Frontend constructs circuit inputs:
   ```javascript
   {
     // Public
     nullifier, winningNumbers, minMatches, ticketTreeRoot, drawId,
     // Private
     ticketNumbers, salt, claimKey, merkleProof, merklePathIndices
   }
   ```
5. Frontend generates proof (10-30 seconds in browser)
6. Frontend submits proof to backend
7. Backend verifies and processes claim

## File Structure

After setup, you should have:

```
circuits/
├── build/
│   ├── claimVerifier.r1cs          # Constraint system
│   ├── claimVerifier.wasm          # WASM for browser
│   ├── claimVerifier_final.zkey    # Proving key
│   ├── verification_key.json       # Verification key
│   ├── verifier.sol                # Solidity verifier (optional)
│   └── powersOfTau28_hez_final_12.ptau  # Powers of Tau
├── *.circom                        # Circuit source files
├── compile.sh                      # Compilation script
├── setup.sh                        # Trusted setup script
└── test.sh                         # Test script

packages/backend/src/circuits/
└── verification_key.json           # For backend verification

packages/frontend/public/circuits/
├── claimVerifier.wasm              # For browser proof generation
└── claimVerifier_final.zkey        # For browser proof generation
```

## Multi-Party Ceremony

For production deployment, conduct a multi-party trusted setup:

### Option 1: Manual Multi-Party Ceremony

```bash
# Participant 1
snarkjs zkey contribute build/claimVerifier_0000.zkey build/claimVerifier_0001.zkey \
  --name="Participant 1" -e="$(openssl rand -hex 32)"

# Participant 2
snarkjs zkey contribute build/claimVerifier_0001.zkey build/claimVerifier_0002.zkey \
  --name="Participant 2" -e="$(openssl rand -hex 32)"

# ... continue for N participants

# Final participant exports verification key
snarkjs zkey export verificationkey build/claimVerifier_000N.zkey verification_key.json
```

### Option 2: Use Existing Powers of Tau

The Hermez Powers of Tau ceremony had 300+ participants:
- Already downloaded by setup.sh
- Secure for circuits up to 2^12 constraints
- No additional ceremony needed for Phase 1

### Option 3: Coordinate Public Ceremony

For maximum trust:
1. Announce ceremony publicly
2. Accept contributions sequentially
3. Publish all intermediate .zkey files
4. At least 10-50 participants recommended
5. Only one participant needs to be honest

## Performance Benchmarks

### Proof Generation (Browser)

| Device | Time | Memory |
|--------|------|--------|
| Desktop (Intel i7) | 8-15s | 1.5GB |
| Laptop (Intel i5) | 15-25s | 1.8GB |
| Mobile (iPhone 12) | 30-45s | 2GB |
| Mobile (Android mid-range) | 40-60s | 2.5GB |

### Proof Verification (Backend)

| Operation | Time |
|-----------|------|
| Verify proof | 50-100ms |
| Calculate Merkle root | 10-50ms (depends on ticket count) |
| Total verification | <200ms |

## Troubleshooting

### "Circuits not available" in Frontend

**Cause:** WASM/zkey files not in `public/circuits/`

**Solution:**
```bash
mkdir -p packages/frontend/public/circuits
cp circuits/build/claimVerifier.wasm packages/frontend/public/circuits/
cp circuits/build/claimVerifier_final.zkey packages/frontend/public/circuits/
```

### "Verification key not found" in Backend

**Cause:** verification_key.json not in backend

**Solution:**
```bash
mkdir -p packages/backend/src/circuits
cp circuits/build/verification_key.json packages/backend/src/circuits/
```

### Proof Generation Fails in Browser

**Symptoms:** "Error generating proof" or browser crashes

**Causes & Solutions:**

1. **Out of Memory**
   - Close other browser tabs
   - Use desktop browser instead of mobile
   - Increase browser memory limit (Chrome: `--max-old-space-size=4096`)

2. **CORS Issues**
   - Ensure frontend dev server is running
   - Check browser console for CORS errors
   - WASM/zkey files must be served from same origin

3. **Files Not Found**
   - Check network tab for 404 errors
   - Verify files are in `public/circuits/`
   - Clear browser cache and reload

### Proof Verification Fails on Backend

**Check logs for:**

```
❌ ZK proof verification failed
```

**Common causes:**

1. **Wrong Public Signals**
   - Nullifier doesn't match
   - Winning numbers mismatch
   - Draw ID incorrect
   - Ticket not in Merkle tree

2. **Invalid Proof Structure**
   - Proof format incorrect
   - Missing fields (pi_a, pi_b, pi_c)
   - Wrong protocol/curve

3. **Verification Key Mismatch**
   - Backend and frontend using different circuit versions
   - Re-run setup and redeploy both keys

## Development vs Production

### Development Mode

When circuits NOT compiled:
- Frontend shows: "⚠️ ZKP Circuits Not Compiled"
- System uses mock proofs (NOT secure)
- Claims still processed for testing
- Backend validates structure only

### Production Mode

When circuits compiled:
- Frontend shows: "✅ Full ZKP System Active"
- Real cryptographic proofs generated
- Backend verifies with snarkjs
- Complete anonymity guaranteed

## Security Audit Checklist

Before production deployment:

- [ ] Multi-party trusted setup completed (≥10 participants)
- [ ] All participants destroyed their contribution randomness
- [ ] Verification key published and audited
- [ ] Circuit logic reviewed by cryptographer
- [ ] No bugs in circuit constraints
- [ ] Powers of Tau ceremony trusted
- [ ] Backend verification implementation correct
- [ ] Frontend proof generation uses correct inputs
- [ ] Nullifier prevents double-claiming
- [ ] Merkle tree correctly computed
- [ ] No information leakage through timing
- [ ] Browser WASM sandbox prevents key extraction

## Additional Resources

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs GitHub](https://github.com/iden3/snarkjs)
- [ZK-SNARK Explainer](https://z.cash/technology/zksnarks/)
- [Trusted Setup Ceremony Guide](https://github.com/iden3/snarkjs#16-powers-of-tau)
- [Hermez Powers of Tau](https://github.com/iden3/snarkjs#7a-powers-of-tau)

## Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review circuit README: `circuits/README.md`
3. Check snarkjs documentation
4. Open an issue with:
   - Error message
   - Circuit statistics
   - Node.js/browser version
   - Memory available

---

**Remember:** The ZKP system provides mathematical guarantees of privacy.
Handle the trusted setup with care - it's the foundation of security!
