#!/bin/bash

set -e

CIRCUIT_NAME="starknetClaimVerifier"
BUILD_DIR="build/${CIRCUIT_NAME}"
PTAU_FILE="powersOfTau28_hez_final_14.ptau"

echo "🔐 Setting up ${CIRCUIT_NAME} trusted setup..."

# Check if Powers of Tau file exists
if [ ! -f "${PTAU_FILE}" ]; then
    echo "📥 Downloading Powers of Tau file..."
    wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau
fi

# Generate zkey (proving key)
echo "🔑 Generating proving key..."
npx snarkjs groth16 setup \
  ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs \
  ${PTAU_FILE} \
  ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey

# Contribute to ceremony (phase 2)
echo "🎲 Contributing randomness..."
npx snarkjs zkey contribute \
  ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey \
  ${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey \
  --name="First contribution" \
  -v \
  -e="$(openssl rand -hex 32)"

# Export verification key
echo "📤 Exporting verification key..."
npx snarkjs zkey export verificationkey \
  ${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey \
  ${BUILD_DIR}/verification_key.json

# Export Solidity verifier (for reference, not used on Starknet)
echo "📜 Exporting Solidity verifier (reference only)..."
npx snarkjs zkey export solidityverifier \
  ${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey \
  ${BUILD_DIR}/${CIRCUIT_NAME}_verifier.sol

echo ""
echo "✅ Trusted setup complete!"
echo ""
echo "Generated files:"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey (Proving key)"
echo "  - ${BUILD_DIR}/verification_key.json (Verification key)"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}_verifier.sol (Solidity verifier - reference)"
echo ""
echo "⚠️  NOTE: For Starknet deployment, you'll need to:"
echo "   1. Convert verification_key.json to Cairo format"
echo "   2. Implement Groth16 verifier in Cairo"
echo "   3. Or use a Starknet ZK verification library"
echo ""
echo "Next: Run ./test-starknet.sh to test proof generation"
