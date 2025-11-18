#[starknet::contract]
pub mod LeveragedVault {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::super::interfaces::{ILeveragedVault};

    #[storage]
    struct Storage {
        // Core vault storage
        owner: ContractAddress,
        token: ContractAddress,  // USDC or ETH
        total_assets: u256,
        total_shares: u256,
        user_shares: Map<ContractAddress, u256>,

        // Leverage settings
        leverage_multiplier: u8,  // 1x to 10x
        max_leverage: u8,

        // Strategy tracking
        deployed_capital: u256,
        total_yield: u256,
        last_yield_update: u64,

        // Lottery integration
        lottery_manager: ContractAddress,
        prize_pool_percentage: u8,  // % of yield to prize pool

        // Pausing
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposit: Deposit,
        Withdraw: Withdraw,
        LeverageUpdated: LeverageUpdated,
        StrategyExecuted: StrategyExecuted,
        YieldAccrued: YieldAccrued,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        pub user: ContractAddress,
        pub amount: u256,
        pub shares: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdraw {
        pub user: ContractAddress,
        pub shares: u256,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct LeverageUpdated {
        pub old_leverage: u8,
        pub new_leverage: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct StrategyExecuted {
        pub deployed_capital: u256,
        pub leverage: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldAccrued {
        pub yield_amount: u256,
        pub to_prize_pool: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        token: ContractAddress,
        lottery_manager: ContractAddress,
    ) {
        self.owner.write(owner);
        self.token.write(token);
        self.lottery_manager.write(lottery_manager);
        self.leverage_multiplier.write(1);
        self.max_leverage.write(10);
        self.prize_pool_percentage.write(80);  // 80% of yield to prize pool
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl LeveragedVaultImpl of ILeveragedVault<ContractState> {
        fn deposit(ref self: ContractState, amount: u256) -> u256 {
            assert(!self.paused.read(), 'Vault is paused');
            assert(amount > 0, 'Amount must be > 0');

            let caller = get_caller_address();

            // Calculate shares to mint
            let shares = if self.total_shares.read() == 0 {
                amount  // First deposit: 1:1 ratio
            } else {
                // shares = (amount * total_shares) / total_assets
                (amount * self.total_shares.read()) / self.total_assets.read()
            };

            // Update storage
            self.total_assets.write(self.total_assets.read() + amount);
            self.total_shares.write(self.total_shares.read() + shares);
            let user_current_shares = self.user_shares.read(caller);
            self.user_shares.write(caller, user_current_shares + shares);

            // Emit event
            self.emit(Deposit {
                user: caller,
                amount: amount,
                shares: shares,
            });

            shares
        }

        fn withdraw(ref self: ContractState, shares: u256) -> u256 {
            assert(!self.paused.read(), 'Vault is paused');
            let caller = get_caller_address();
            let user_shares = self.user_shares.read(caller);
            assert(shares <= user_shares, 'Insufficient shares');

            // Calculate amount to return
            // amount = (shares * total_assets) / total_shares
            let amount = (shares * self.total_assets.read()) / self.total_shares.read();

            // Update storage
            self.user_shares.write(caller, user_shares - shares);
            self.total_shares.write(self.total_shares.read() - shares);
            self.total_assets.write(self.total_assets.read() - amount);

            // Emit event
            self.emit(Withdraw {
                user: caller,
                shares: shares,
                amount: amount,
            });

            amount
        }

        fn set_leverage(ref self: ContractState, multiplier: u8) {
            self._only_owner();
            assert(multiplier >= 1 && multiplier <= self.max_leverage.read(), 'Invalid leverage');

            let old_leverage = self.leverage_multiplier.read();
            self.leverage_multiplier.write(multiplier);

            self.emit(LeverageUpdated {
                old_leverage: old_leverage,
                new_leverage: multiplier,
            });
        }

        fn get_leverage(self: @ContractState) -> u8 {
            self.leverage_multiplier.read()
        }

        fn total_assets(self: @ContractState) -> u256 {
            self.total_assets.read()
        }

        fn total_shares(self: @ContractState) -> u256 {
            self.total_shares.read()
        }

        fn user_shares(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_shares.read(user)
        }

        fn execute_strategy(ref self: ContractState) {
            self._only_owner();

            let base_capital = self.total_assets.read();
            let leverage = self.leverage_multiplier.read();

            // Calculate total deployed capital with leverage
            // deployed = base_capital * leverage
            let deployed = base_capital * leverage.into();

            self.deployed_capital.write(deployed);

            self.emit(StrategyExecuted {
                deployed_capital: deployed,
                leverage: leverage,
            });
        }

        fn calculate_prize_pool(self: @ContractState) -> u256 {
            let total_yield = self.total_yield.read();
            let percentage = self.prize_pool_percentage.read();

            // prize_pool = total_yield * percentage / 100
            (total_yield * percentage.into()) / 100
        }

        fn harvest_yield(ref self: ContractState) -> u256 {
            self._only_owner();

            // TODO: In production, claim rewards from actual DeFi protocols
            // For MVP, simulate yield based on deployed capital and time
            let deployed = self.deployed_capital.read();
            let last_update = self.last_yield_update.read();
            let current_time = get_block_timestamp();
            let time_elapsed = current_time - last_update;

            // Simulate 10% APY (simplified calculation)
            // yield = deployed * 0.10 * (time_elapsed / 31536000)
            // Using basis points to avoid decimals: 1000 bp = 10%
            let yearly_yield = (deployed * 1000) / 10000;  // 10% of deployed
            let yield_amount = (yearly_yield * time_elapsed.into()) / 31536000;  // Pro-rata for time

            if yield_amount > 0 {
                self._accrue_yield(yield_amount);

                // Transfer yield to prize pool
                let to_prize_pool = (yield_amount * self.prize_pool_percentage.read().into()) / 100;
                // TODO: Call lottery_manager.add_to_prize_pool(to_prize_pool)
            }

            yield_amount
        }

        fn get_total_yield(self: @ContractState) -> u256 {
            self.total_yield.read()
        }

        fn get_apy(self: @ContractState) -> u256 {
            // Return APY in basis points (1000 = 10%)
            // TODO: Calculate actual APY from strategy performance
            1000  // 10% APY placeholder
        }

        fn get_deployed_capital(self: @ContractState) -> u256 {
            self.deployed_capital.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');
        }

        fn _accrue_yield(ref self: ContractState, yield_amount: u256) {
            let percentage = self.prize_pool_percentage.read();
            let to_prize_pool = (yield_amount * percentage.into()) / 100;

            self.total_yield.write(self.total_yield.read() + yield_amount);
            self.last_yield_update.write(get_block_timestamp());

            self.emit(YieldAccrued {
                yield_amount: yield_amount,
                to_prize_pool: to_prize_pool,
            });
        }
    }
}
