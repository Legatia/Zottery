#!/bin/bash

set -e

CIRCUIT_NAME="starknetClaimVerifier"
BUILD_DIR="build/${CIRCUIT_NAME}"

echo "🔧 Compiling ${CIRCUIT_NAME} circuit..."

# Create build directory
mkdir -p ${BUILD_DIR}

# Compile circuit
echo "📦 Running circom compiler..."
circom ${CIRCUIT_NAME}.circom \
  --r1cs \
  --wasm \
  --sym \
  --c \
  -o ${BUILD_DIR}

echo "✅ Circuit compiled successfully!"
echo "📁 Output directory: ${BUILD_DIR}"
echo ""
echo "Files generated:"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs (Rank-1 Constraint System)"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm (WebAssembly)"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}.sym (Symbol table)"
echo ""
echo "Next steps:"
echo "  1. Run ./setup-starknet.sh to generate proving/verification keys"
echo "  2. Use the keys for proof generation and verification"
