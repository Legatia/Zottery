#[starknet::contract]
pub mod ClaimVerifier {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use zottery_starknet::interfaces::{IClaimVerifier, Claim, ILotteryManager, IClaimVerifierAdmin};

    #[storage]
    struct Storage {
        // Core
        owner: ContractAddress,
        lottery_manager: ContractAddress,
        vault: ContractAddress,

        // Claim tracking
        claims: Map<felt252, Claim>,  // nullifier => Claim
        nullifier_used: Map<felt252, bool>,

        // ZK verification
        verification_key_hash: felt252,

        // Relayer authorization
        authorized_relayers: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PayoutAuthorized: PayoutAuthorized,
        PayoutRecorded: PayoutRecorded,
        RelayerAuthorized: RelayerAuthorized,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutAuthorized {
        pub nullifier: felt252,
        pub draw_id: u64,
        pub amount: u256,
        pub z_address_hash: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PayoutRecorded {
        pub nullifier: felt252,
        pub zcash_tx_hash: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RelayerAuthorized {
        pub relayer: ContractAddress,
        pub authorized: bool,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        lottery_manager: ContractAddress,
        vault: ContractAddress,
        verification_key_hash: felt252,
    ) {
        self.owner.write(owner);
        self.lottery_manager.write(lottery_manager);
        self.vault.write(vault);
        self.verification_key_hash.write(verification_key_hash);
    }

    #[abi(embed_v0)]
    impl ClaimVerifierImpl of IClaimVerifier<ContractState> {
        fn claim_prize(
            ref self: ContractState,
            draw_id: u64,
            nullifier: felt252,
            z_address_hash: felt252,
            proof: Span<felt252>
        ) -> bool {
            // Check nullifier not already used
            assert(!self.nullifier_used.read(nullifier), 'Nullifier already used');

            // Verify ZK proof
            let is_valid = self._verify_proof(draw_id, nullifier, z_address_hash, proof);
            assert(is_valid, 'Invalid proof');

            // Mark nullifier as used
            self.nullifier_used.write(nullifier, true);

            // Get prize pool amount
            let amount = self._get_prize_pool(draw_id);

            // Store claim
            let claim = Claim {
                nullifier: nullifier,
                draw_id: draw_id,
                amount: amount,
                z_address_hash: z_address_hash,
                claimed_at: get_block_timestamp(),
                zcash_tx_hash: 0,  // Set later by relayer
            };
            self.claims.write(nullifier, claim);

            // Emit cross-chain payout event
            self.emit(PayoutAuthorized {
                nullifier: nullifier,
                draw_id: draw_id,
                amount: amount,
                z_address_hash: z_address_hash,
                timestamp: get_block_timestamp(),
            });

            true
        }

        fn is_nullifier_used(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifier_used.read(nullifier)
        }

        fn get_payout_amount(self: @ContractState, nullifier: felt252) -> u256 {
            let claim = self.claims.read(nullifier);
            claim.amount
        }

        fn record_payout(ref self: ContractState, nullifier: felt252, zcash_tx_hash: felt252) {
            // Only authorized relayers can record payouts
            self._only_authorized_relayer();

            let mut claim = self.claims.read(nullifier);
            assert(claim.nullifier == nullifier, 'Claim not found');
            assert(claim.zcash_tx_hash == 0, 'Already recorded');

            claim.zcash_tx_hash = zcash_tx_hash;
            self.claims.write(nullifier, claim);

            self.emit(PayoutRecorded {
                nullifier: nullifier,
                zcash_tx_hash: zcash_tx_hash,
                timestamp: get_block_timestamp(),
            });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');
        }

        fn _only_authorized_relayer(self: @ContractState) {
            let caller = get_caller_address();
            assert(self.authorized_relayers.read(caller), 'Not authorized relayer');
        }

        fn _verify_proof(
            self: @ContractState,
            draw_id: u64,
            nullifier: felt252,
            z_address_hash: felt252,
            proof: Span<felt252>
        ) -> bool {
            // TODO: Implement full Groth16 verification
            // For MVP, we'll verify proof structure and public inputs

            // Proof should have 8 elements (Groth16 format)
            // A (2 elements), B (4 elements), C (2 elements)
            assert(proof.len() >= 8, 'Invalid proof length');

            // Get winning commitment from lottery manager
            // let winning_commitment = lottery_manager.get_winning_commitment(draw_id);

            // Public inputs for ZK circuit:
            // 1. winning_commitment
            // 2. nullifier
            // 3. draw_id
            // 4. z_address_hash

            // For now, accept all proofs (INSECURE - for testing only)
            // Production MUST implement full Groth16 verification
            true
        }

        fn _get_prize_pool(self: @ContractState, draw_id: u64) -> u256 {
            // TODO: Query lottery_manager for prize pool
            1000000  // 1 USDC placeholder
        }
    }

    // Admin functions
    #[abi(embed_v0)]
    impl AdminImpl of IClaimVerifierAdmin<ContractState> {
        fn authorize_relayer(ref self: ContractState, relayer: ContractAddress, authorized: bool) {
            self._only_owner();
            self.authorized_relayers.write(relayer, authorized);

            self.emit(RelayerAuthorized {
                relayer: relayer,
                authorized: authorized,
            });
        }
    }
}
