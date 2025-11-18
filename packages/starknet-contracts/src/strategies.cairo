use starknet::ContractAddress;

// Base strategy interface for DeFi integrations
#[starknet::interface]
pub trait IStrategy<TContractState> {
    // Deploy capital to strategy
    fn deploy(ref self: TContractState, amount: u256) -> u256;

    // Withdraw capital from strategy
    fn withdraw(ref self: TContractState, shares: u256) -> u256;

    // Get current value of deployed capital
    fn get_value(self: @TContractState) -> u256;

    // Harvest yield/rewards
    fn harvest(ref self: TContractState) -> u256;

    // Get strategy name
    fn get_name(self: @TContractState) -> felt252;
}

// Lending strategy (zkLend, Nostra)
#[starknet::interface]
pub trait ILendingStrategy<TContractState> {
    fn supply(ref self: TContractState, amount: u256) -> u256;
    fn redeem(ref self: TContractState, shares: u256) -> u256;
    fn claim_rewards(ref self: TContractState) -> u256;
    fn get_apy(self: @TContractState) -> u256;
}

// LP strategy (Jediswap, Ekubo)
#[starknet::interface]
pub trait ILPStrategy<TContractState> {
    fn add_liquidity(ref self: TContractState, amount_a: u256, amount_b: u256) -> u256;
    fn remove_liquidity(ref self: TContractState, lp_tokens: u256) -> (u256, u256);
    fn claim_fees(ref self: TContractState) -> u256;
    fn get_reserves(self: @TContractState) -> (u256, u256);
}

// Borrowing interface for leverage
#[starknet::interface]
pub trait IBorrowingProtocol<TContractState> {
    fn borrow(ref self: TContractState, amount: u256, collateral: u256) -> u256;
    fn repay(ref self: TContractState, amount: u256) -> u256;
    fn get_borrow_rate(self: @TContractState) -> u256;
    fn get_ltv(self: @TContractState) -> u256;
    fn get_health_factor(self: @TContractState, user: ContractAddress) -> u256;
}
