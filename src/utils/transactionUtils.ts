/**
 * Shared utilities for transaction handling
 */
import { Transaction } from "@mysten/sui/transactions";
import { Token, sortTokenTypes, findOptimalCoins } from "./tokenUtils";
import { CONSTANTS } from "../constants/addresses";

/**
 * Create a transaction for swapping tokens
 */
export async function createSwapTransaction(
  suiClient: any,
  account: { address: string },
  token0: Token,
  token1: Token,
  amount0: string,
  minAmountOut: string,
  currentPairId: string,
  deadline: number
): Promise<Transaction> {
  // Sort token types to ensure consistent ordering
  const [sortedType0, sortedType1] = sortTokenTypes(
    token0.coinType as string,
    token1.coinType as string
  );

  const needToSwap = sortedType0 !== token0.coinType;
  const swapFunction = needToSwap
    ? "swap_exact_tokens1_for_tokens0"
    : "swap_exact_tokens0_for_tokens1";

  // Calculate scaled amounts
  const scaledAmountIn = BigInt(
    Math.floor(parseFloat(amount0) * 10 ** token0.decimals)
  );
  const scaledMinAmountOut = BigInt(
    Math.floor(parseFloat(minAmountOut) * 10 ** token1.decimals)
  );

  // Fetch coins efficiently
  const coins = await suiClient.getCoins({
    owner: account.address,
    coinType: token0.coinType,
  });
  let coinToUse = coins.data.find(
    (coin: any) => BigInt(coin.balance) >= scaledAmountIn
  );

  if (!coinToUse) {
    // Merge coins if needed
    const totalBalance = coins.data.reduce(
      (acc: bigint, coin: any) => acc + BigInt(coin.balance),
      BigInt(0)
    );
    if (totalBalance < scaledAmountIn) throw new Error("Insufficient balance");

    // Merge all coins before selecting
    await suiClient.mergeCoins(
      account.address,
      coins.data.map((coin: any) => coin.coinObjectId)
    );
    coinToUse = coins.data[0]; // Re-fetch the coins if necessary
  }

  console.log({
    token0,
    token1,
    suiClient,
    amount0,
    minAmountOut,
    deadline,
    needToSwap,
    swapFunction,
    sortedType0,
    sortedType1,
    scaledAmountIn,
    scaledMinAmountOut,
    coins,
    coinToUse,
  });

  // Set up transaction
  const swapTx = new Transaction();
  const isSUI = token0.coinType === "0x2::sui::SUI";

  // Split coins efficiently
  const [splitCoin] = isSUI
    ? swapTx.splitCoins(swapTx.gas, [
        swapTx.pure.u64(scaledAmountIn.toString()),
      ])
    : swapTx.splitCoins(swapTx.object(coinToUse.coinObjectId), [
        swapTx.pure.u64(scaledAmountIn.toString()),
      ]);

  // Execute swap
  swapTx.moveCall({
    target: `${CONSTANTS.PACKAGE_ID}::router::${swapFunction}`,
    typeArguments: [sortedType0, sortedType1],
    arguments: [
      swapTx.object(CONSTANTS.ROUTER_ID),
      swapTx.object(CONSTANTS.FACTORY_ID),
      swapTx.object(currentPairId),
      splitCoin,
      swapTx.pure.u256(scaledMinAmountOut.toString()),
      swapTx.pure.u64(deadline),
    ],
  });

  return swapTx;
}

/**
 * Create a transaction for creating a trading pair
 */
export function createPairTransaction(
  token0: Token,
  token1: Token
): Transaction {
  // Sort token types
  const [sortedType0, sortedType1] = sortTokenTypes(
    token0.coinType as string,
    token1.coinType as string
  );

  // Create the pair transaction
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULES.ROUTER}::create_pair`,
    arguments: [
      tx.object(CONSTANTS.ROUTER_ID),
      tx.object(CONSTANTS.FACTORY_ID),
      tx.pure.string(sortedType0.split("::").pop() || ""),
      tx.pure.string(sortedType1.split("::").pop() || ""),
    ],
    typeArguments: [sortedType0, sortedType1],
  });

  return tx;
}

/**
 * Create a transaction for adding liquidity
 */
export async function createAddLiquidityTransaction(
  suiClient: any,
  account: { address: string },
  token0: Token,
  token1: Token,
  amount0: string,
  amount1: string,
  currentPairId: string,
  slippage: number = 5
): Promise<Transaction> {
  if (!token0.coinType || !token1.coinType) {
    throw new Error("Missing coin types");
  }

  // Sort token types to ensure consistent ordering
  const [sortedType0, sortedType1] = sortTokenTypes(
    token0.coinType,
    token1.coinType
  );

  // Determine if we need to swap the tokens based on sorting
  const needToSwap = sortedType0 !== token0.coinType;

  // Determine the correct order of amounts based on sorted types
  const [finalAmount0, finalAmount1, finalDecimals0, finalDecimals1] =
    needToSwap
      ? [amount1, amount0, token1.decimals, token0.decimals]
      : [amount0, amount1, token0.decimals, token1.decimals];

  // Calculate amounts with proper decimal handling
  const amount0Value = Math.floor(
    parseFloat(finalAmount0) * Math.pow(10, finalDecimals0)
  );
  const amount1Value = Math.floor(
    parseFloat(finalAmount1) * Math.pow(10, finalDecimals1)
  );

  // Fetch coins for each token type
  const [coins0, coins1] = await Promise.all([
    suiClient.getCoins({ owner: account.address, coinType: sortedType0 }),
    suiClient.getCoins({ owner: account.address, coinType: sortedType1 }),
  ]);

  // Find suitable coins to use
  const coinToSplit0 = coins0.data.find(
    (coin: any) => BigInt(coin.balance) >= BigInt(amount0Value)
  );
  const coinToSplit1 = coins1.data.find(
    (coin: any) => BigInt(coin.balance) >= BigInt(amount1Value)
  );

  if (!coinToSplit0 || !coinToSplit1) {
    throw new Error("Insufficient balance");
  }

  // Setup transaction
  const addLiquidityTx = new Transaction();

  // Handle SUI vs other coins differently
  const isSUI0 = sortedType0.includes("0x2::sui::SUI");
  const isSUI1 = sortedType1.includes("0x2::sui::SUI");

  const splitCoin0 = isSUI0
    ? addLiquidityTx.splitCoins(addLiquidityTx.gas, [
        addLiquidityTx.pure.u64(amount0Value),
      ])[0]
    : addLiquidityTx.splitCoins(
        addLiquidityTx.object(coinToSplit0.coinObjectId),
        [addLiquidityTx.pure.u64(amount0Value)]
      )[0];

  const splitCoin1 = isSUI1
    ? addLiquidityTx.splitCoins(addLiquidityTx.gas, [
        addLiquidityTx.pure.u64(amount1Value),
      ])[0]
    : addLiquidityTx.splitCoins(
        addLiquidityTx.object(coinToSplit1.coinObjectId),
        [addLiquidityTx.pure.u64(amount1Value)]
      )[0];

  // Set slippage parameters
  const minAmount0 =
    (BigInt(amount0Value) * BigInt(100 - slippage)) / BigInt(100);
  const minAmount1 =
    (BigInt(amount1Value) * BigInt(100 - slippage)) / BigInt(100);
  const deadline = Math.floor(Date.now() + 1200000); // 20 minutes

  // Add liquidity call
  addLiquidityTx.moveCall({
    target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULES.ROUTER}::add_liquidity`,
    arguments: [
      addLiquidityTx.object(CONSTANTS.ROUTER_ID),
      addLiquidityTx.object(CONSTANTS.FACTORY_ID),
      addLiquidityTx.object(currentPairId),
      splitCoin0,
      splitCoin1,
      addLiquidityTx.pure.u256(amount0Value.toString()),
      addLiquidityTx.pure.u256(amount1Value.toString()),
      addLiquidityTx.pure.u256(minAmount0.toString()),
      addLiquidityTx.pure.u256(minAmount1.toString()),
      addLiquidityTx.pure.string(sortedType0.split("::").pop() || ""),
      addLiquidityTx.pure.string(sortedType1.split("::").pop() || ""),
      addLiquidityTx.pure.u64(deadline),
    ],
    typeArguments: [sortedType0, sortedType1],
  });

  return addLiquidityTx;
}

/**
 * Simulate a transaction to check for errors
 */
export async function simulateTransaction(
  suiClient: any,
  account: { address: string },
  transaction: Transaction
): Promise<{ success: boolean; error?: string }> {
  try {
    const simulationResult = await suiClient.devInspectTransactionBlock({
      transactionBlock: transaction,
      sender: account.address,
    });
    console.log("simulationResult", simulationResult);

    if (simulationResult.effects?.status?.error) {
      return {
        success: false,
        error: simulationResult.effects.status.error,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during simulation",
    };
  }
}
