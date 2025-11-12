#!/bin/bash

# Trusted Setup Script
# Performs the Powers of Tau ceremony and generates proving/verification keys

set -e

echo "🔐 Starting Trusted Setup for Zottery Claim Verifier..."
echo ""

# Create build directory if it doesn't exist
mkdir -p build

# Check if circuit is compiled
if [ ! -f "build/claimVerifier.r1cs" ]; then
    echo "❌ Circuit not compiled yet. Please run ./compile.sh first"
    exit 1
fi

# ============================================================================
# Phase 1: Powers of Tau Ceremony
# ============================================================================

echo "📊 Phase 1: Powers of Tau Ceremony"
echo "This creates the universal trusted setup parameters..."
echo ""

# Download or generate Powers of Tau file
# For circuits with ~10k constraints, we use powers of tau 2^12
POT_FILE="build/powersOfTau28_hez_final_12.ptau"

if [ ! -f "$POT_FILE" ]; then
    echo "Downloading Powers of Tau file..."
    wget -O "$POT_FILE" https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau
    echo "✅ Downloaded Powers of Tau file"
else
    echo "✅ Powers of Tau file already exists"
fi

echo ""

# ============================================================================
# Phase 2: Circuit-Specific Setup
# ============================================================================

echo "🎯 Phase 2: Circuit-Specific Setup"
echo "Generating proving and verification keys..."
echo ""

# Generate zkey (proving key)
echo "Generating initial zkey..."
snarkjs groth16 setup build/claimVerifier.r1cs "$POT_FILE" build/claimVerifier_0000.zkey

# Contribute to the ceremony (in production, this would be done by multiple parties)
echo ""
echo "Contributing randomness to the ceremony..."
snarkjs zkey contribute build/claimVerifier_0000.zkey build/claimVerifier_0001.zkey \
    --name="First contribution" \
    -v \
    -e="$(openssl rand -hex 32)"

# Export final zkey
echo ""
echo "Exporting final proving key..."
snarkjs zkey export solidityverifier build/claimVerifier_0001.zkey build/verifier.sol

# Export verification key
echo ""
echo "Exporting verification key..."
snarkjs zkey export verificationkey build/claimVerifier_0001.zkey build/verification_key.json

# Create a symlink for easier access
ln -sf claimVerifier_0001.zkey build/claimVerifier_final.zkey

echo ""
echo "✅ Trusted setup completed successfully!"
echo ""
echo "Generated files:"
echo "  - build/claimVerifier_final.zkey (Proving key)"
echo "  - build/verification_key.json (Verification key)"
echo "  - build/verifier.sol (Solidity verifier contract)"
echo ""
echo "Setup statistics:"
snarkjs zkey export verificationkey build/claimVerifier_final.zkey /dev/stdout | head -20
echo ""
echo "⚠️  IMPORTANT: In production, the trusted setup should be done by"
echo "   multiple independent parties to ensure security."
echo ""
echo "Next step: Circuit is ready for use!"
echo "  - Backend: Copy verification_key.json to backend"
echo "  - Frontend: Copy claimVerifier.wasm and claimVerifier_final.zkey"
