#[starknet::contract]
pub mod LotteryManager {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::poseidon::poseidon_hash_span;
    use super::super::interfaces::{ILotteryManager, Draw, TicketCommitment};

    #[storage]
    struct Storage {
        // Core
        owner: ContractAddress,
        vault: ContractAddress,

        // Draw management
        current_draw_id: u64,
        draws: Map<u64, Draw>,
        current_prize_pool: u256,  // Accumulated yield for next draw

        // Ticket tracking
        ticket_commitments: Map<u64, felt252>,  // ticket_id => commitment
        ticket_draw_mapping: Map<u64, u64>,     // ticket_id => draw_id
        next_ticket_id: u64,
        draw_ticket_count: Map<u64, u64>,       // draw_id => count

        // VRF/Randomness oracle
        vrf_oracle: ContractAddress,

        // Draw schedule
        draw_interval: u64,  // seconds between draws
        last_draw_time: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        TicketRegistered: TicketRegistered,
        DrawExecuted: DrawExecuted,
        PrizePoolUpdated: PrizePoolUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TicketRegistered {
        pub ticket_id: u64,
        pub commitment: felt252,
        pub draw_id: u64,
        pub user: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DrawExecuted {
        pub draw_id: u64,
        pub winning_commitment: felt252,
        pub prize_pool: u256,
        pub ticket_count: u64,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrizePoolUpdated {
        pub amount_added: u256,
        pub new_total: u256,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault: ContractAddress,
        vrf_oracle: ContractAddress,
    ) {
        self.owner.write(owner);
        self.vault.write(vault);
        self.vrf_oracle.write(vrf_oracle);
        self.current_draw_id.write(1);
        self.next_ticket_id.write(1);
        self.draw_interval.write(86400);  // 24 hours
        self.last_draw_time.write(get_block_timestamp());
    }

    #[abi(embed_v0)]
    impl LotteryManagerImpl of ILotteryManager<ContractState> {
        fn register_ticket(ref self: ContractState, commitment: felt252) -> u64 {
            let caller = get_caller_address();
            let current_draw = self.current_draw_id.read();
            let ticket_id = self.next_ticket_id.read();

            // Store ticket
            self.ticket_commitments.write(ticket_id, commitment);
            self.ticket_draw_mapping.write(ticket_id, current_draw);

            // Update counters
            self.next_ticket_id.write(ticket_id + 1);
            let current_count = self.draw_ticket_count.read(current_draw);
            self.draw_ticket_count.write(current_draw, current_count + 1);

            // Emit event
            self.emit(TicketRegistered {
                ticket_id: ticket_id,
                commitment: commitment,
                draw_id: current_draw,
                user: caller,
            });

            ticket_id
        }

        fn execute_draw(ref self: ContractState, draw_id: u64) -> felt252 {
            self._only_owner();
            assert(draw_id == self.current_draw_id.read(), 'Invalid draw ID');

            let ticket_count = self.draw_ticket_count.read(draw_id);
            assert(ticket_count > 0, 'No tickets for draw');

            // Get randomness from VRF oracle
            // For now, use block timestamp + draw_id as seed
            let random_seed = self._get_randomness(draw_id);

            // Select winning ticket index
            let winning_index = random_seed % ticket_count;

            // Get winning commitment
            let winning_ticket_id = winning_index + 1;  // Simplified: assumes sequential IDs
            let winning_commitment = self.ticket_commitments.read(winning_ticket_id);

            // Get current prize pool and reset for next draw
            let prize_pool = self.current_prize_pool.read();
            self.current_prize_pool.write(0);  // Reset for next draw

            // Store draw result
            let draw = Draw {
                draw_id: draw_id,
                winning_commitment: winning_commitment,
                prize_pool: prize_pool,
                ticket_count: ticket_count,
                executed_at: get_block_timestamp(),
                is_executed: true,
            };
            self.draws.write(draw_id, draw);

            // Increment draw ID for next draw
            self.current_draw_id.write(draw_id + 1);
            self.last_draw_time.write(get_block_timestamp());

            // Emit event
            self.emit(DrawExecuted {
                draw_id: draw_id,
                winning_commitment: winning_commitment,
                prize_pool: prize_pool,
                ticket_count: ticket_count,
                timestamp: get_block_timestamp(),
            });

            winning_commitment
        }

        fn get_winning_commitment(self: @ContractState, draw_id: u64) -> felt252 {
            let draw = self.draws.read(draw_id);
            assert(draw.is_executed, 'Draw not executed');
            draw.winning_commitment
        }

        fn get_ticket_count(self: @ContractState, draw_id: u64) -> u64 {
            self.draw_ticket_count.read(draw_id)
        }

        fn get_prize_pool(self: @ContractState, draw_id: u64) -> u256 {
            let draw = self.draws.read(draw_id);
            draw.prize_pool
        }

        fn is_draw_executed(self: @ContractState, draw_id: u64) -> bool {
            let draw = self.draws.read(draw_id);
            draw.is_executed
        }

        fn get_current_draw_id(self: @ContractState) -> u64 {
            self.current_draw_id.read()
        }

        fn add_to_prize_pool(ref self: ContractState, amount: u256) {
            // Only vault can add to prize pool
            let caller = get_caller_address();
            assert(caller == self.vault.read(), 'Only vault can add');

            let current_pool = self.current_prize_pool.read();
            let new_total = current_pool + amount;
            self.current_prize_pool.write(new_total);

            self.emit(PrizePoolUpdated {
                amount_added: amount,
                new_total: new_total,
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

        fn _get_randomness(self: @ContractState, draw_id: u64) -> u64 {
            // TODO: Integrate with Pragma VRF or Starknet native VRF
            // For now, use deterministic but unpredictable seed
            let timestamp = get_block_timestamp();
            let seed_array = array![timestamp.into(), draw_id.into()];
            let hash = poseidon_hash_span(seed_array.span());

            // Convert felt252 to u64 for modulo operation
            // This is a simplification; production should use proper VRF
            let hash_u256: u256 = hash.into();
            let hash_low: u128 = hash_u256.low;
            hash_low.try_into().unwrap()
        }

        fn _get_prize_pool(self: @ContractState) -> u256 {
            // TODO: Call vault.calculate_prize_pool()
            // For now, return placeholder
            1000000  // 1 USDC (6 decimals)
        }
    }
}
