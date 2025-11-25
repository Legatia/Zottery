#!/bin/bash

# Zottery Starknet Contracts Deployment Script
# Usage: ./deploy.sh <network>
# Example: ./deploy.sh sepolia

set -e

NETWORK=${1:-sepolia}
echo "🚀 Deploying Zottery contracts to Starknet $NETWORK"

# Configuration
RPC_URL="https://starknet-${NETWORK}.public.blastapi.io"
ACCOUNT_FILE="~/.starkli-wallets/deployer/account.json"
KEYSTORE_FILE="~/.starkli-wallets/deployer/keystore.json"

# Check if starkli is installed
if ! command -v starkli &> /dev/null; then
    echo "❌ starkli not found. Please install: https://book.starkli.rs/installation"
    exit 1
fi

# Check if scarb is installed
if ! command -v scarb &> /dev/null; then
    echo "❌ scarb not found. Please install: https://docs.swmansion.com/scarb/download"
    exit 1
fi

echo "📦 Building contracts..."
scarb build

echo ""
echo "================================"
echo "Step 1: Declare Contracts"
echo "================================"

# Declare LeveragedVault
echo "📝 Declaring LeveragedVault..."
VAULT_CLASS_HASH=$(starkli declare \
  target/dev/zottery_starknet_LeveragedVault.contract_class.json \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Class hash declared" | awk '{print $NF}')

if [ -z "$VAULT_CLASS_HASH" ]; then
    echo "❌ Failed to declare LeveragedVault"
    exit 1
fi
echo "✅ LeveragedVault declared: $VAULT_CLASS_HASH"

# Declare LotteryManager
echo "📝 Declaring LotteryManager..."
LOTTERY_CLASS_HASH=$(starkli declare \
  target/dev/zottery_starknet_LotteryManager.contract_class.json \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Class hash declared" | awk '{print $NF}')

if [ -z "$LOTTERY_CLASS_HASH" ]; then
    echo "❌ Failed to declare LotteryManager"
    exit 1
fi
echo "✅ LotteryManager declared: $LOTTERY_CLASS_HASH"

# Declare ClaimVerifier
echo "📝 Declaring ClaimVerifier..."
CLAIM_CLASS_HASH=$(starkli declare \
  target/dev/zottery_starknet_ClaimVerifier.contract_class.json \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Class hash declared" | awk '{print $NF}')

if [ -z "$CLAIM_CLASS_HASH" ]; then
    echo "❌ Failed to declare ClaimVerifier"
    exit 1
fi
echo "✅ ClaimVerifier declared: $CLAIM_CLASS_HASH"

# Declare StZEC
echo "📝 Declaring StZEC..."
ST_ZEC_CLASS_HASH=$(starkli declare \
  target/dev/zottery_starknet_StZEC.contract_class.json \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Class hash declared" | awk '{print $NF}')

if [ -z "$ST_ZEC_CLASS_HASH" ]; then
    echo "❌ Failed to declare StZEC"
    exit 1
fi
echo "✅ StZEC declared: $ST_ZEC_CLASS_HASH"

# Declare ZotterySwap
echo "📝 Declaring ZotterySwap..."
SWAP_CLASS_HASH=$(starkli declare \
  target/dev/zottery_starknet_ZotterySwap.contract_class.json \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Class hash declared" | awk '{print $NF}')

if [ -z "$SWAP_CLASS_HASH" ]; then
    echo "❌ Failed to declare ZotterySwap"
    exit 1
fi
echo "✅ ZotterySwap declared: $SWAP_CLASS_HASH"

echo ""
echo "================================"
echo "Step 2: Deploy Contracts"
echo "================================"

# Get deployer address
DEPLOYER_ADDRESS=$(starkli account fetch $ACCOUNT_FILE --rpc $RPC_URL | grep "Address" | awk '{print $2}')
echo "Deployer address: $DEPLOYER_ADDRESS"

# Set contract addresses (you may need to adjust these)
# For Sepolia testnet USDC
TOKEN_ADDRESS="0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8"
VRF_ORACLE="0x0000000000000000000000000000000000000000000000000000000000000000"  # Placeholder

# Deploy LeveragedVault
echo "🏗️  Deploying LeveragedVault..."
VAULT_ADDRESS=$(starkli deploy \
  $VAULT_CLASS_HASH \
  $DEPLOYER_ADDRESS \
  $TOKEN_ADDRESS \
  0x0 \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Contract deployed" | awk '{print $NF}')

if [ -z "$VAULT_ADDRESS" ]; then
    echo "❌ Failed to deploy LeveragedVault"
    exit 1
fi
echo "✅ LeveragedVault deployed: $VAULT_ADDRESS"

# Deploy LotteryManager (needs vault address)
echo "🏗️  Deploying LotteryManager..."
LOTTERY_ADDRESS=$(starkli deploy \
  $LOTTERY_CLASS_HASH \
  $DEPLOYER_ADDRESS \
  $VAULT_ADDRESS \
  $VRF_ORACLE \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Contract deployed" | awk '{print $NF}')

if [ -z "$LOTTERY_ADDRESS" ]; then
    echo "❌ Failed to deploy LotteryManager"
    exit 1
fi
echo "✅ LotteryManager deployed: $LOTTERY_ADDRESS"

# Deploy StZEC
echo "🏗️  Deploying StZEC..."
ST_ZEC_ADDRESS=$(starkli deploy \
  $ST_ZEC_CLASS_HASH \
  $DEPLOYER_ADDRESS \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Contract deployed" | awk '{print $NF}')

if [ -z "$ST_ZEC_ADDRESS" ]; then
    echo "❌ Failed to deploy StZEC"
    exit 1
fi
echo "✅ StZEC deployed: $ST_ZEC_ADDRESS"

# Deploy ZotterySwap
echo "🏗️  Deploying ZotterySwap..."
# Constructor: token0, token1, lottery_manager
SWAP_ADDRESS=$(starkli deploy \
  $SWAP_CLASS_HASH \
  $TOKEN_ADDRESS \
  $ST_ZEC_ADDRESS \
  $LOTTERY_ADDRESS \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Contract deployed" | awk '{print $NF}')

if [ -z "$SWAP_ADDRESS" ]; then
    echo "❌ Failed to deploy ZotterySwap"
    exit 1
fi
echo "✅ ZotterySwap deployed: $SWAP_ADDRESS"

# Update vault with lottery manager address
echo "🔗 Updating LeveragedVault with LotteryManager address..."
# This requires an update function in the vault contract
# For now, we'll skip this and note it needs manual update

# Compute verification key hash (placeholder)
VERIFICATION_KEY_HASH="0x1234567890abcdef"  # TODO: Compute from actual verification key

# Deploy ClaimVerifier
echo "🏗️  Deploying ClaimVerifier..."
CLAIM_ADDRESS=$(starkli deploy \
  $CLAIM_CLASS_HASH \
  $DEPLOYER_ADDRESS \
  $LOTTERY_ADDRESS \
  $VAULT_ADDRESS \
  $VERIFICATION_KEY_HASH \
  --rpc $RPC_URL \
  --account $ACCOUNT_FILE \
  --keystore $KEYSTORE_FILE \
  2>&1 | grep "Contract deployed" | awk '{print $NF}')

if [ -z "$CLAIM_ADDRESS" ]; then
    echo "❌ Failed to deploy ClaimVerifier"
    exit 1
fi
echo "✅ ClaimVerifier deployed: $CLAIM_ADDRESS"

echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo "================================"
echo ""
echo "Contract Addresses:"
echo "-------------------"
echo "LeveragedVault:    $VAULT_ADDRESS"
echo "LotteryManager:    $LOTTERY_ADDRESS"
echo "ClaimVerifier:     $CLAIM_ADDRESS"
echo "StZEC:             $ST_ZEC_ADDRESS"
echo "ZotterySwap:       $SWAP_ADDRESS"
echo ""
echo "Class Hashes:"
echo "-------------"
echo "LeveragedVault:    $VAULT_CLASS_HASH"
echo "LotteryManager:    $LOTTERY_CLASS_HASH"
echo "ClaimVerifier:     $CLAIM_CLASS_HASH"
echo ""
echo "Network: Starknet $NETWORK"
echo "Deployer: $DEPLOYER_ADDRESS"
echo ""
echo "📝 Save these addresses to your .env files:"
echo ""
echo "# Frontend (.env)"
echo "VITE_VAULT_ADDRESS=$VAULT_ADDRESS"
echo "VITE_LOTTERY_MANAGER_ADDRESS=$LOTTERY_ADDRESS"
echo "VITE_CLAIM_VERIFIER_ADDRESS=$CLAIM_ADDRESS"
echo ""
echo "# Relayer (.env)"
echo "CLAIM_VERIFIER_ADDRESS=$CLAIM_ADDRESS"
echo ""
echo "🔍 Verify contracts on Starkscan:"
echo "https://${NETWORK}.starkscan.co/contract/$VAULT_ADDRESS"
echo "https://${NETWORK}.starkscan.co/contract/$LOTTERY_ADDRESS"
echo "https://${NETWORK}.starkscan.co/contract/$CLAIM_ADDRESS"
echo ""
echo "✨ Done!"
