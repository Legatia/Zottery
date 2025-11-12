#!/bin/bash

# Circuit Compilation Script
# Compiles the Circom circuit to R1CS and WASM formats

set -e

echo "🔧 Compiling Zottery Claim Verifier Circuit..."

# Create build directory if it doesn't exist
mkdir -p build

# Compile circuit
circom claimVerifier.circom \
    --r1cs build/claimVerifier.r1cs \
    --wasm build/claimVerifier.wasm \
    --sym build/claimVerifier.sym \
    --c build/claimVerifier.c \
    --json build/claimVerifier.json

echo "✅ Circuit compiled successfully!"
echo ""
echo "Generated files:"
echo "  - build/claimVerifier.r1cs (Rank 1 Constraint System)"
echo "  - build/claimVerifier.wasm (WebAssembly for proof generation)"
echo "  - build/claimVerifier.sym (Symbols)"
echo "  - build/claimVerifier.json (Circuit info)"
echo ""
echo "Circuit statistics:"
snarkjs r1cs info build/claimVerifier.r1cs
echo ""
echo "Next step: Run ./setup.sh to perform the trusted setup"
