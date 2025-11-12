#!/bin/bash

# Circuit Test Script
# Tests the circuit with sample inputs

set -e

echo "🧪 Testing Zottery Claim Verifier Circuit..."
echo ""

# Check if circuit is compiled and setup
if [ ! -f "build/claimVerifier.wasm" ]; then
    echo "❌ Circuit not compiled. Run ./compile.sh first"
    exit 1
fi

if [ ! -f "build/claimVerifier_final.zkey" ]; then
    echo "❌ Trusted setup not completed. Run ./setup.sh first"
    exit 1
fi

# Create test input
echo "📝 Creating test input..."

cat > build/test_input.json << EOF
{
  "nullifier": "12345678901234567890123456789012345678901234567890123456789012345",
  "winningNumbers": ["7", "14", "21", "28", "35", "42"],
  "minMatches": "3",
  "ticketTreeRoot": "98765432109876543210987654321098765432109876543210987654321098765",
  "drawId": "1",
  "ticketNumbers": ["7", "14", "21", "30", "40", "49"],
  "salt": "11111111111111111111111111111111111111111111111111111111111111111",
  "claimKey": "22222222222222222222222222222222222222222222222222222222222222222",
  "merkleProof": [
    "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
    "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
  ],
  "merklePathIndices": [
    "0", "0", "0", "0", "0", "0", "0", "0", "0", "0",
    "0", "0", "0", "0", "0", "0", "0", "0", "0", "0"
  ]
}
EOF

echo "✅ Test input created"
echo ""

# Calculate witness
echo "🔢 Calculating witness..."
node build/claimVerifier_js/generate_witness.js \
    build/claimVerifier_js/claimVerifier.wasm \
    build/test_input.json \
    build/witness.wtns

echo "✅ Witness calculated"
echo ""

# Generate proof
echo "🔐 Generating proof..."
snarkjs groth16 prove \
    build/claimVerifier_final.zkey \
    build/witness.wtns \
    build/test_proof.json \
    build/test_public.json

echo "✅ Proof generated"
echo ""

# Verify proof
echo "✅ Verifying proof..."
snarkjs groth16 verify \
    build/verification_key.json \
    build/test_public.json \
    build/test_proof.json

echo ""
echo "🎉 Test completed successfully!"
echo ""
echo "Generated files:"
echo "  - build/test_proof.json (ZK Proof)"
echo "  - build/test_public.json (Public signals)"
echo "  - build/witness.wtns (Witness)"
