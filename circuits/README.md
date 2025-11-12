# Zottery Zero-Knowledge Circuits

This directory contains the Circom circuits for anonymous lottery prize claiming.

## Overview

The **ClaimVerifier** circuit allows winners to prove they own a winning ticket without revealing:
- Which specific ticket they own
- Their identity
- The claim key itself

## Circuit Architecture

### Main Circuit: `claimVerifier.circom`

**Public Inputs** (visible to everyone):
- `nullifier` - Unique identifier derived from claim key (prevents double-claiming)
- `winningNumbers[6]` - The drawn winning numbers (1-49)
- `minMatches` - Minimum number of matches required (3-6)
- `ticketTreeRoot` - Merkle root of all tickets in this draw
- `drawId` - The draw being claimed from

**Private Inputs** (kept secret by claimer):
- `ticketNumbers[6]` - The claimer's ticket numbers
- `salt` - Random salt used in ticket generation
- `claimKey` - Secret key for claiming
- `merkleProof[20]` - Merkle proof that ticket is in the tree
- `merklePathIndices[20]` - Path indices for Merkle proof

**Constraints Verified**:
1. ✓ Ticket numbers are in valid range (1-49)
2. ✓ Ticket hash = hash(numbers || salt || claimKey)
3. ✓ Ticket hash exists in Merkle tree (with root = ticketTreeRoot)
4. ✓ Count of matching numbers ≥ minMatches
5. ✓ Nullifier = hash(claimKey)

### Helper Circuits

- **`merkle.circom`** - Merkle tree inclusion proof verification
- **`matchCounter.circom`** - Counts matching numbers between two arrays
- **`ticketHash.circom`** - Computes ticket hash and nullifier using Poseidon

## Setup Instructions

### Prerequisites

```bash
# Install Node.js dependencies
npm install

# Install circom compiler (if not installed globally)
npm install -g circom
```

### Step 1: Compile Circuit

```bash
./compile.sh
```

This generates:
- `build/claimVerifier.r1cs` - Rank 1 Constraint System
- `build/claimVerifier.wasm` - WebAssembly for proof generation
- `build/claimVerifier_js/` - JavaScript witness calculator

### Step 2: Trusted Setup

```bash
./setup.sh
```

This performs the trusted setup ceremony and generates:
- `build/claimVerifier_final.zkey` - Proving key
- `build/verification_key.json` - Verification key
- `build/verifier.sol` - Solidity verifier (optional)

**⚠️ Production Note**: In production, the trusted setup should be done by multiple independent parties through a multi-party computation ceremony to ensure no single party has the "toxic waste."

### Step 3: Test Circuit

```bash
./test.sh
```

This runs a test with sample inputs to verify the circuit works correctly.

## Circuit Statistics

After compilation, view circuit statistics:

```bash
snarkjs r1cs info build/claimVerifier.r1cs
```

Expected output:
- Constraints: ~10,000-50,000 (depending on optimization)
- Public inputs: 5 (nullifier, 6 winning numbers as array, minMatches, ticketTreeRoot, drawId)
- Private inputs: 28 (6 ticket numbers, salt, claimKey, 20 merkle proof elements, 20 path indices)

## Integration

### Backend Integration

1. Copy verification key:
```bash
cp build/verification_key.json ../packages/backend/src/circuits/
```

2. Update backend to use snarkjs for verification:
```typescript
import { groth16 } from 'snarkjs';
const vKey = require('./circuits/verification_key.json');

async function verifyProof(proof, publicSignals) {
  return await groth16.verify(vKey, publicSignals, proof);
}
```

### Frontend Integration

1. Copy circuit artifacts:
```bash
cp build/claimVerifier.wasm ../packages/frontend/public/circuits/
cp build/claimVerifier_final.zkey ../packages/frontend/public/circuits/
```

2. Generate proofs in browser:
```typescript
import { groth16 } from 'snarkjs';

async function generateProof(inputs) {
  const { proof, publicSignals } = await groth16.fullProve(
    inputs,
    '/circuits/claimVerifier.wasm',
    '/circuits/claimVerifier_final.zkey'
  );
  return { proof, publicSignals };
}
```

## Security Considerations

### Trusted Setup
- The current setup uses a single contribution (for development)
- **Production requires multi-party ceremony** with ≥10 participants
- Each participant adds entropy; only one needs to be honest
- Consider using Perpetual Powers of Tau for Phase 1

### Circuit Security
- All constraints are deterministic
- No information leakage through timing or side channels
- Poseidon hash chosen for ZK-friendliness (fewer constraints than SHA-256)

### Known Limitations
- Merkle tree fixed at 20 levels (max ~1M tickets per draw)
- Numbers must be in range 1-49 (hardcoded)
- Requires trusted setup (consider PLONK/STARK for setup-free alternative)

## Development

### Modifying the Circuit

1. Edit `.circom` files
2. Recompile: `./compile.sh`
3. Regenerate setup: `./setup.sh`
4. Test: `./test.sh`

### Debugging

View circuit info:
```bash
snarkjs r1cs print build/claimVerifier.r1cs build/claimVerifier.sym
```

Export to JSON:
```bash
snarkjs r1cs export json build/claimVerifier.r1cs build/claimVerifier.r1cs.json
```

## Performance

### Proof Generation
- Time: ~5-30 seconds (depending on device)
- Memory: ~500MB-2GB RAM
- Browser-compatible via WebAssembly

### Verification
- Time: <100ms
- Memory: <10MB
- Very efficient on backend

## References

- [Circom Documentation](https://docs.circom.io/)
- [snarkjs Documentation](https://github.com/iden3/snarkjs)
- [Poseidon Hash](https://www.poseidon-hash.info/)
- [Groth16 Protocol](https://eprint.iacr.org/2016/260.pdf)

## Troubleshooting

### "Circuit not compiled"
Run `./compile.sh` first.

### "Powers of Tau download failed"
Download manually:
```bash
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau \
  -O build/powersOfTau28_hez_final_12.ptau
```

### "Out of memory"
Increase Node.js memory:
```bash
export NODE_OPTIONS="--max-old-space-size=8192"
```

### "Proof generation too slow"
- Use a more powerful device
- Consider reducing Merkle tree levels (edit circuit)
- Wait for WASM optimizations to load

## License

MIT License - See main project LICENSE file
