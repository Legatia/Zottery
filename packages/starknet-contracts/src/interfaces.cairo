use starknet::ContractAddress;

#[starknet::interface]
pub trait ILeveragedVault<TContractState> {
    fn deposit(ref self: TContractState, amount: u256) -> u256;
    fn withdraw(ref self: TContractState, shares: u256) -> u256;
    fn set_leverage(ref self: TContractState, multiplier: u8);
    fn get_leverage(self: @TContractState) -> u8;
    fn total_assets(self: @TContractState) -> u256;
    fn total_shares(self: @TContractState) -> u256;
    fn user_shares(self: @TContractState, user: ContractAddress) -> u256;
    fn execute_strategy(ref self: TContractState);
    fn calculate_prize_pool(self: @TContractState) -> u256;
}

#[starknet::interface]
pub trait ILotteryManager<TContractState> {
    fn register_ticket(ref self: TContractState, commitment: felt252) -> u64;
    fn execute_draw(ref self: TContractState, draw_id: u64) -> felt252;
    fn get_winning_commitment(self: @TContractState, draw_id: u64) -> felt252;
    fn get_ticket_count(self: @TContractState, draw_id: u64) -> u64;
    fn get_prize_pool(self: @TContractState, draw_id: u64) -> u256;
    fn is_draw_executed(self: @TContractState, draw_id: u64) -> bool;
    fn get_current_draw_id(self: @TContractState) -> u64;
}

#[starknet::interface]
pub trait IClaimVerifier<TContractState> {
    fn claim_prize(
        ref self: TContractState,
        draw_id: u64,
        nullifier: felt252,
        z_address_hash: felt252,
        proof: Span<felt252>
    ) -> bool;
    fn is_nullifier_used(self: @TContractState, nullifier: felt252) -> bool;
    fn get_payout_amount(self: @TContractState, nullifier: felt252) -> u256;
    fn record_payout(ref self: TContractState, nullifier: felt252, zcash_tx_hash: felt252);
}

#[derive(Drop, Serde, starknet::Store)]
pub struct TicketCommitment {
    pub commitment: felt252,
    pub timestamp: u64,
    pub draw_id: u64,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Draw {
    pub draw_id: u64,
    pub winning_commitment: felt252,
    pub prize_pool: u256,
    pub ticket_count: u64,
    pub executed_at: u64,
    pub is_executed: bool,
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Claim {
    pub nullifier: felt252,
    pub draw_id: u64,
    pub amount: u256,
    pub z_address_hash: felt252,
    pub claimed_at: u64,
    pub zcash_tx_hash: felt252,
}
