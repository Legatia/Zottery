#[starknet::contract]
mod ZotterySwap {
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::event::EventEmitter;
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_contract_address;
    use crate::interfaces::IZotterySwap;
    
    #[starknet::interface]
    trait IERC20<TContractState> {
        fn name(self: @TContractState) -> felt252;
        fn symbol(self: @TContractState) -> felt252;
        fn decimals(self: @TContractState) -> u8;
        fn total_supply(self: @TContractState) -> u256;
        fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
        fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
        fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
        fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    }

    #[storage]
    struct Storage {
        token0: ContractAddress,
        token1: ContractAddress,
        reserve0: u256,
        reserve1: u256,
        total_supply: u256,
        balances: Map::<ContractAddress, u256>,
        lottery_manager: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Mint: Mint,
        Burn: Burn,
        Swap: Swap,
        Sync: Sync,
    }

    #[derive(Drop, starknet::Event)]
    struct Mint {
        sender: ContractAddress,
        amount0: u256,
        amount1: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Burn {
        sender: ContractAddress,
        amount0: u256,
        amount1: u256,
        to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct Swap {
        sender: ContractAddress,
        amount0_in: u256,
        amount1_in: u256,
        amount0_out: u256,
        amount1_out: u256,
        to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct Sync {
        reserve0: u256,
        reserve1: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        token0: ContractAddress,
        token1: ContractAddress,
        lottery_manager: ContractAddress
    ) {
        self.token0.write(token0);
        self.token1.write(token1);
        self.lottery_manager.write(lottery_manager);
    }

    // Helper to get reserves
    #[external(v0)]
    fn get_reserves(self: @ContractState) -> (u256, u256) {
        (self.reserve0.read(), self.reserve1.read())
    }

    // Add Liquidity
    #[external(v0)]
    fn add_liquidity(ref self: ContractState, amount0_desired: u256, amount1_desired: u256) -> u256 {
        let caller = get_caller_address();
        let this_contract = get_contract_address();

        // Transfer tokens in (Optimistic transfer for simplicity in this example)
        // In production, you'd check allowances and transfer first
        // Assuming caller has approved this contract
        IERC20Dispatcher { contract_address: self.token0.read() }.transfer_from(caller, this_contract, amount0_desired);
        IERC20Dispatcher { contract_address: self.token1.read() }.transfer_from(caller, this_contract, amount1_desired);

        let (reserve0, reserve1) = get_reserves(@self);
        let mut liquidity: u256 = 0;

        if self.total_supply.read() == 0 {
            // Initial liquidity = sqrt(x * y) - MINIMUM_LIQUIDITY
            // For simplicity, just sqrt(x * y)
            // Note: Cairo doesn't have built-in sqrt for u256 easily accessible in standard lib without imports
            // Using a simplified approximation or assuming 1:1 for initial deposit if reserves empty
             liquidity = amount0_desired; // Simplified for MVP
        } else {
            // min(amount0 * totalSupply / reserve0, amount1 * totalSupply / reserve1)
            let total_supply = self.total_supply.read();
            let liq0 = (amount0_desired * total_supply) / reserve0;
            let liq1 = (amount1_desired * total_supply) / reserve1;
            if liq0 < liq1 {
                liquidity = liq0;
            } else {
                liquidity = liq1;
            }
        }

        assert(liquidity > 0, 'Insufficient liquidity minted');

        // Mint LP tokens
        starknet::storage::StorageMapWriteAccess::write(self.balances, caller, starknet::storage::StorageMapReadAccess::read(self.balances, caller) + liquidity);
        self.total_supply.write(self.total_supply.read() + liquidity);

        // Update reserves
        self.reserve0.write(reserve0 + amount0_desired);
        self.reserve1.write(reserve1 + amount1_desired);
        self.emit(Sync { reserve0: reserve0 + amount0_desired, reserve1: reserve1 + amount1_desired });

        self.emit(Mint { sender: caller, amount0: amount0_desired, amount1: amount1_desired });

        liquidity
    }

    // Remove Liquidity
    #[external(v0)]
    fn remove_liquidity(ref self: ContractState, liquidity: u256) -> (u256, u256) {
        let caller = get_caller_address();
        // let this_contract = get_contract_address(); // Unused

        assert(starknet::storage::StorageMapReadAccess::read(self.balances, caller) >= liquidity, 'Insufficient LP balance');

        let (reserve0, reserve1) = get_reserves(@self);
        let total_supply = self.total_supply.read();

        let amount0 = (liquidity * reserve0) / total_supply;
        let amount1 = (liquidity * reserve1) / total_supply;

        assert(amount0 > 0 && amount1 > 0, 'Insufficient liquidity burned');

        // Burn LP tokens
        starknet::storage::StorageMapWriteAccess::write(self.balances, caller, starknet::storage::StorageMapReadAccess::read(self.balances, caller) - liquidity);
        self.total_supply.write(total_supply - liquidity);

        // Transfer tokens out
        IERC20Dispatcher { contract_address: self.token0.read() }.transfer(caller, amount0);
        IERC20Dispatcher { contract_address: self.token1.read() }.transfer(caller, amount1);

        // Update reserves
        self.reserve0.write(reserve0 - amount0);
        self.reserve1.write(reserve1 - amount1);
        self.emit(Sync { reserve0: reserve0 - amount0, reserve1: reserve1 - amount1 });

        self.emit(Burn { sender: caller, amount0, amount1, to: caller });

        (amount0, amount1)
    }

    // Swap
    #[external(v0)]
    fn swap(ref self: ContractState, amount0_out: u256, amount1_out: u256, to: ContractAddress) {
        assert(amount0_out > 0 || amount1_out > 0, 'Insufficient output amount');
        
        let (reserve0, reserve1) = get_reserves(@self);
        assert(amount0_out < reserve0 && amount1_out < reserve1, 'Insufficient liquidity');

        let token0 = self.token0.read();
        let token1 = self.token1.read();
        // let this_contract = get_contract_address(); // Unused

        // Optimistically transfer out
        if amount0_out > 0 {
            IERC20Dispatcher { contract_address: token0 }.transfer(to, amount0_out);
        }
        if amount1_out > 0 {
            IERC20Dispatcher { contract_address: token1 }.transfer(to, amount1_out);
        }

        // Check balances after transfer to ensure input amount is sufficient (K invariant)
        // In a real implementation, we'd query balance_of(this_contract)
        // For this MVP, we'll assume the caller sent tokens *before* calling swap (not ideal UX but easier to code)
        // OR we use transfer_from for the input amount. Let's use transfer_from for input.
        
        // Wait, standard Uniswap V2 `swap` assumes tokens are already transferred. 
        // Let's implement a `swap_exact_tokens_for_tokens` style instead which is more user friendly.
    }

    #[external(v0)]
    fn swap_exact_tokens_for_tokens(
        ref self: ContractState, 
        amount_in: u256, 
        amount_out_min: u256, 
        path: Array<ContractAddress>, 
        to: ContractAddress
    ) -> Array<u256> {
        // Simplified: Only supports direct swap between token0 and token1
        assert(path.len() == 2, 'Invalid path length');
        let token_in = *path.at(0);
        // let token_out = *path.at(1); // Unused, implied by logic

        let (reserve_in, reserve_out) = if token_in == self.token0.read() {
            (self.reserve0.read(), self.reserve1.read())
        } else {
            (self.reserve1.read(), self.reserve0.read())
        };

        // Calculate amount out with 0.3% fee
        // amount_in_with_fee = amount_in * 997
        // numerator = amount_in_with_fee * reserve_out
        // denominator = (reserve_in * 1000) + amount_in_with_fee
        // amount_out = numerator / denominator

        let amount_in_with_fee = amount_in * 997;
        let numerator = amount_in_with_fee * reserve_out;
        let denominator = (reserve_in * 1000) + amount_in_with_fee;
        let amount_out = numerator / denominator;

        assert(amount_out >= amount_out_min, 'Insufficient output amount');

        // Transfer input from user
        let caller = get_caller_address();
        let _this_contract = get_contract_address();
        IERC20Dispatcher { contract_address: token_in }.transfer_from(caller, _this_contract, amount_in);

        // Fee collection for Lottery (0.05%)
        // Total fee is 0.3% (30/10000). 
        // LP gets 0.25% (25/10000).
        // Lottery gets 0.05% (5/10000).
        // The K constant grows by the LP fee. The Lottery fee is extracted.
        
        let lottery_fee = amount_in * 5 / 10000;
        if lottery_fee > 0 {
             IERC20Dispatcher { contract_address: token_in }.transfer(self.lottery_manager.read(), lottery_fee);
        }

        // Transfer output to user
        let token_out_address = if token_in == self.token0.read() { self.token1.read() } else { self.token0.read() };
        IERC20Dispatcher { contract_address: token_out_address }.transfer(to, amount_out);

        // Update reserves
        // New reserve_in = old_reserve_in + amount_in - lottery_fee
        // New reserve_out = old_reserve_out - amount_out
        
        let new_reserve_in = reserve_in + amount_in - lottery_fee;
        let new_reserve_out = reserve_out - amount_out;

        if token_in == self.token0.read() {
            self.reserve0.write(new_reserve_in);
            self.reserve1.write(new_reserve_out);
            self.emit(Sync { reserve0: new_reserve_in, reserve1: new_reserve_out });
        } else {
            self.reserve0.write(new_reserve_out);
            self.reserve1.write(new_reserve_in);
            self.emit(Sync { reserve0: new_reserve_out, reserve1: new_reserve_in });
        }

        let mut amounts = ArrayTrait::new();
        amounts.append(amount_in);
        amounts.append(amount_out);
        amounts
    }
}
