# Pool Creation Instructions

This guide explains how to create an Aerodrome CL pool with no lock using the `create-pool-no-lock.ts` script.

## Pool Configuration

The script is pre-configured with the following parameters:

- **New Token**: `0x4538A9657EAd6Dc78C84BfACD760d718A46acACE`
- **ACES Token**: `0x55337650856299363c496065C836B9C6E9dE0367`
- **Liquidity**: 999,999,999 new tokens + 9,000,000 ACES
- **Fee Tier**: 2% (tick spacing 500)
- **Lock Duration**: None (0 seconds)
- **Network**: Base Mainnet (Chain ID 8453)

## Prerequisites

### 1. Token Balances

Ensure your wallet has sufficient balances:
- At least **999,999,999** of your new token (`0x4538A9657EAd6Dc78C84BfACD760d718A46acACE`)
- At least **9,000,000** ACES tokens (`0x55337650856299363c496065C836B9C6E9dE0367`)
- At least **0.001 ETH** for gas fees (Base has very low gas costs)

### 2. Environment Variables

Create or update `apps/frontend/.env.local` with your private key:

```bash
# Required: Your wallet private key (DO NOT COMMIT THIS FILE)
PRIVATE_KEY=0x...

# Optional: Custom RPC URL (falls back to public Base RPC if not set)
QUICKNODE_BASE_URL=https://...
```

**⚠️ SECURITY WARNING**: Never commit `.env.local` to git! It should already be in `.gitignore`.

## Running the Script

### Step 1: Navigate to the frontend directory

```bash
cd apps/frontend
```

### Step 2: Run a dry run (simulation) first

This will simulate the transaction without actually sending it:

```bash
npm run create-pool
```

The script is configured with `dryRun: false` by default, but you can edit the script to set `dryRun: true` for testing.

### Step 3: Review the output

The script will show:
- ✅ Configuration details
- ✅ Pre-flight checks (pool existence, balances, approvals)
- ✅ Token balances and required amounts
- ✅ Gas estimates
- ✅ Token approval status
- ✅ Price calculation
- ✅ Simulation result (if dry run)

### Step 4: Execute the real transaction

If the dry run succeeds, ensure `dryRun: false` in the script and run:

```bash
npm run create-pool
```

The script will:
1. Check if the pool already exists (exits if it does)
2. Verify you have sufficient token balances
3. Check token approvals
4. Approve tokens if needed (2 transactions)
5. Create the pool and add liquidity (1 transaction)

### Step 5: View your pool

After successful creation, the script will output:
- 📍 Pool address
- 🧾 Transaction hash with Basescan link
- 🔗 Aerodrome UI link

## Script Configuration

You can modify the pool parameters by editing `scripts/create-pool-no-lock.ts`:

```typescript
const CONFIG = {
  newToken: '0x4538A9657EAd6Dc78C84BfACD760d718A46acACE',
  acesToken: '0x55337650856299363c496065C836B9C6E9dE0367',
  tickSpacing: 500, // 2% fee tier
  newTokenLiquidity: '999999999', // 999,999,999 tokens
  acesLiquidity: '9000000', // 9,000,000 ACES
  noLock: true, // No lock on liquidity
  dryRun: false, // Set to true to simulate only
  skipSimulation: false, // Set to true to skip simulation
  maxFeePerGasGwei: 0.05, // Base gas is very low
  maxPriorityFeePerGasGwei: 0.01,
};
```

## Troubleshooting

### Error: "Missing PRIVATE_KEY environment variable"

**Solution**: Add your private key to `apps/frontend/.env.local`:
```bash
PRIVATE_KEY=0x...
```

### Error: "Insufficient balance of new token"

**Solution**: Ensure your wallet has at least 999,999,999 of your new token. Check your balance on Basescan.

### Error: "Pool already exists"

**Solution**: A pool for this token pair and tick spacing already exists. The script will show you the existing pool address. You can either:
- Add liquidity to the existing pool via Aerodrome UI
- Use a different tick spacing (different fee tier)

### Error: "InvalidToken" (0xc1ab6dc1)

**Solution**: Your new token is not whitelisted on the Aerodrome CL Pool Launcher. Options:
1. Contact Aerodrome team to whitelist your token
2. Use a different pool launcher that doesn't require whitelisting
3. Use the ensure-aces-pairable script if ACES needs whitelisting

### Error: "Transaction dropped" or "not found"

**Solution**: The transaction was not mined. Try again with higher gas:
```typescript
maxFeePerGasGwei: 0.1, // Increase from 0.05
maxPriorityFeePerGasGwei: 0.05, // Increase from 0.01
```

### Error: "Insufficient allowance"

**Solution**: The script should auto-approve tokens. If this fails:
1. Check if you have enough ETH for gas
2. Manually approve tokens on Basescan
3. Run the script again

## Understanding the Output

### Successful Pool Creation

```
=============================================================
✅ POOL CREATED SUCCESSFULLY!
=============================================================

📍 Pool Address:     0x...
🔒 Locker Address:   (none - no lock)
🧾 Transaction:      0x...

🔗 Links:
   Basescan:         https://basescan.org/tx/0x...
   Aerodrome Pool:   https://aerodrome.finance/liquidity

💡 Next Steps:
   1. View your LP position on Aerodrome
   2. Monitor pool activity and trading volume
   3. You can add/remove liquidity or lock it later if desired
```

### What You Get

After successful pool creation:
- **Pool Contract**: A new Aerodrome CL pool at the displayed address
- **LP Position (NFT)**: An NFT representing your liquidity position, sent to your wallet
- **No Lock**: Your LP NFT is freely transferable immediately (no lock period)
- **Full Range**: Your liquidity is active at all price points

### Managing Your Position

You can manage your LP position via:
1. **Aerodrome UI**: https://aerodrome.finance/liquidity
2. **Aerodrome Contracts**: Directly interact with the pool contract
3. **Lock Later**: You can lock your position later if desired using Aerodrome's locker contracts

## Advanced Options

### Verbose Error Output

For detailed error information:

```bash
VERBOSE_ERROR=1 npm run create-pool
```

### Custom RPC URL

Use a custom RPC provider for better reliability:

```bash
# In .env.local
QUICKNODE_BASE_URL=https://your-quicknode-url.base.quiknode.pro/...
```

### Skip Simulation

To skip the simulation and send the transaction directly (useful if simulation fails but you know the tx will succeed):

Edit the script and set:
```typescript
skipSimulation: true,
```

## Gas Costs

Typical gas costs on Base Mainnet:
- **Token Approvals**: ~50,000 gas each × 2 = 100,000 gas total
- **Pool Creation**: ~1,000,000 gas
- **Total**: ~1,100,000 gas

At 0.05 Gwei (typical Base gas price):
- **Total Cost**: ~0.00006 ETH (~$0.01 USD)

Base has extremely low gas costs compared to Ethereum mainnet!

## Support

If you encounter issues:
1. Check the error message and troubleshooting section above
2. Review the "Share with team" debug block in the error output
3. Run with `VERBOSE_ERROR=1` for detailed error information
4. Check your transaction on Basescan if a tx hash is provided
5. Verify your token balances and approvals on Basescan

## Related Scripts

- `npm run launch-pool` - General pool launch script (configurable)
- `npm run ensure-aces-pairable` - Whitelist ACES on the launcher
- `npm run list-cl-tick-spacings` - List available tick spacings and fees
- `npm run get-revert-reason` - Get revert reason from a failed transaction
