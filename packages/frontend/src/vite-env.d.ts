/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STARKNET_RPC_URL?: string;
  readonly VITE_VAULT_ADDRESS?: string;
  readonly VITE_LOTTERY_MANAGER_ADDRESS?: string;
  readonly VITE_CLAIM_VERIFIER_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
