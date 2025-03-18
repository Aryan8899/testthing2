/**
 * Transaction utilities for swap operations
 * Handles both direct and multi-hop swaps
 */
import { Transaction } from "@mysten/sui/transactions";
import { Token } from "./tokenUtils";
import { RouteInfo } from "../hooks/useRoutes";
import { CONSTANTS } from "../constants/addresses";
import {
  scaleAmount,
  sortTokenTypes,
  normalizeTokenType,
  matchTokenTypes,
  findOptimalCoins,
} from "./routeUtils";

/**
 * Create a transaction for multi-hop token swapping
 * This handles both direct and multi-hop swaps appropriately
 */
export async function createSwapTransactionWithRoute(
  suiClient: any,
  account: { address: string },
  token0: Token,
  token1: Token,
  amount0: string,
  minAmountOut: string,
  selectedRoute: RouteInfo,
  deadline: number
): Promise<Transaction> {
  // Handle direct swap vs multi-hop
  if (selectedRoute.type === "direct") {
    return createDirectSwapTransaction(
      suiClient,
      account,
      token0,
      token1,
      amount0,
      minAmountOut,
      selectedRoute.pairs[0].pairId,
      deadline
    );
  } else {
    return createMultiHopSwapTransaction(
      suiClient,
      account,
      token0,
      token1,
      amount0,
      minAmountOut,
      selectedRoute,
      deadline
    );
  }
}

/**
 * Create a transaction for direct token swapping (single hop)
 */
async function createDirectSwapTransaction(
  suiClient: any,
  account: { address: string },
  token0: Token,
  token1: Token,
  amount0: string,
  minAmountOut: string,
  pairId: string,
  deadline: number
): Promise<Transaction> {
  console.log("Creating direct swap transaction");

  // Sort token types to ensure consistent ordering
  const [sortedType0, sortedType1] = sortTokenTypes(
    token0.coinType as string,
    token1.coinType as string
  );

  // Determine if we need to swap the tokens based on sorting
  const needToSwap = sortedType0 !== token0.coinType;

  // Choose the appropriate swap function based on token order
  const swapFunction = needToSwap
    ? "swap_exact_tokens1_for_tokens0"
    : "swap_exact_tokens0_for_tokens1";

  // Calculate amounts with proper decimal handling
  const scaledAmountIn = scaleAmount(amount0, token0.decimals);
  const scaledMinAmountOut = scaleAmount(minAmountOut, token1.decimals);

  console.log("Swap parameters:", {
    function: swapFunction,
    typeArg0: sortedType0,
    typeArg1: sortedType1,
    amountIn: scaledAmountIn.toString(),
    minOut: scaledMinAmountOut.toString(),
    deadline,
  });

  // Create transaction with proper error handling
  const swapTx = new Transaction();

  try {
    // Fetch coins for token0
    const coins = await suiClient.getCoins({
      owner: account.address,
      coinType: token0.coinType,
    });

    // Find optimal coins to use (handling UTXO model)
    const coinsToUse = findOptimalCoins(coins.data, scaledAmountIn.toString());

    if (!coinsToUse || coinsToUse.length === 0) {
      throw new Error("Insufficient balance");
    }

    // Prepare input coin(s)
    let inputCoin;

    if (coinsToUse.length === 1) {
      // Single coin case
      const coinToUse = coinsToUse[0];
      const isSUI = token0.coinType === "0x2::sui::SUI";

      if (BigInt(coinToUse.balance) > scaledAmountIn) {
        // Need to split the coin when balance > needed amount
        const coinObj = isSUI
          ? swapTx.gas
          : swapTx.object(coinToUse.coinObjectId);

        [inputCoin] = swapTx.splitCoins(coinObj, [
          swapTx.pure.u64(scaledAmountIn.toString()),
        ]);
      } else {
        // Use whole coin when balance = needed amount
        inputCoin = isSUI ? swapTx.gas : swapTx.object(coinToUse.coinObjectId);
      }
    } else {
      // Multiple coins case (need to merge first)
      const primaryCoin = swapTx.object(coinsToUse[0].coinObjectId);
      const otherCoins = coinsToUse
        .slice(1)
        .map((coin) => swapTx.object(coin.coinObjectId));

      // Merge coins first
      swapTx.mergeCoins(primaryCoin, otherCoins);

      // Now split if needed
      const totalBalance = coinsToUse.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        BigInt(0)
      );

      if (totalBalance > scaledAmountIn) {
        [inputCoin] = swapTx.splitCoins(primaryCoin, [
          swapTx.pure.u64(scaledAmountIn.toString()),
        ]);
      } else {
        inputCoin = primaryCoin;
      }
    }

    // Add the swap call
    swapTx.moveCall({
      target: `${CONSTANTS.PACKAGE_ID}::router::${swapFunction}`,
      typeArguments: [sortedType0, sortedType1], // Use sorted types in correct order
      arguments: [
        swapTx.object(CONSTANTS.ROUTER_ID),
        swapTx.object(CONSTANTS.FACTORY_ID),
        swapTx.object(pairId),
        inputCoin,
        swapTx.pure.u256(scaledMinAmountOut.toString()),
        swapTx.pure.u64(deadline),
      ],
    });

    return swapTx;
  } catch (error) {
    console.error("Error creating direct swap transaction:", error);
    throw error;
  }
}

/**
 * Create a transaction for multi-hop token swapping
 */
async function createMultiHopSwapTransaction(
  suiClient: any,
  account: { address: string },
  token0: Token,
  token1: Token,
  amount0: string,
  minAmountOut: string,
  route: RouteInfo,
  deadline: number
): Promise<Transaction> {
  console.log("Creating multi-hop swap transaction");

  if (route.path.length < 3 || route.pairs.length < 2) {
    throw new Error("Invalid route for multi-hop swap");
  }

  // Calculate amounts with proper decimal handling
  const scaledAmountIn = scaleAmount(amount0, token0.decimals);
  const scaledMinAmountOut = scaleAmount(minAmountOut, token1.decimals);

  // Create transaction
  const swapTx = new Transaction();

  try {
    // Fetch coins for token0
    const coins = await suiClient.getCoins({
      owner: account.address,
      coinType: token0.coinType,
    });

    // Find optimal coins to use (handling UTXO model)
    const coinsToUse = findOptimalCoins(coins.data, scaledAmountIn.toString());

    if (!coinsToUse || coinsToUse.length === 0) {
      throw new Error("Insufficient balance");
    }

    // Prepare input coin(s)
    let inputCoin;

    if (coinsToUse.length === 1) {
      // Single coin case
      const coinToUse = coinsToUse[0];
      const isSUI = token0.coinType === "0x2::sui::SUI";

      if (BigInt(coinToUse.balance) > scaledAmountIn) {
        // Need to split the coin when balance > needed amount
        const coinObj = isSUI
          ? swapTx.gas
          : swapTx.object(coinToUse.coinObjectId);

        [inputCoin] = swapTx.splitCoins(coinObj, [
          swapTx.pure.u64(scaledAmountIn.toString()),
        ]);
      } else {
        // Use whole coin when balance = needed amount
        inputCoin = isSUI ? swapTx.gas : swapTx.object(coinToUse.coinObjectId);
      }
    } else {
      // Multiple coins case (need to merge first)
      const primaryCoin = swapTx.object(coinsToUse[0].coinObjectId);
      const otherCoins = coinsToUse
        .slice(1)
        .map((coin) => swapTx.object(coin.coinObjectId));

      // Merge coins first
      swapTx.mergeCoins(primaryCoin, otherCoins);

      // Now split if needed
      const totalBalance = coinsToUse.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        BigInt(0)
      );

      if (totalBalance > scaledAmountIn) {
        [inputCoin] = swapTx.splitCoins(primaryCoin, [
          swapTx.pure.u64(scaledAmountIn.toString()),
        ]);
      } else {
        inputCoin = primaryCoin;
      }
    }

    // Extract all tokens in the path
    const firstPair = route.pairs[0];
    const secondPair = route.pairs[1];

    // Normalize token types to ensure we have consistent addresses
    const inputTokenType = normalizeTokenType(route.path[0]);
    const intermediateTokenType = normalizeTokenType(route.path[1]);
    const outputTokenType = normalizeTokenType(route.path[2]);

    console.log("Multi-hop path:", {
      inputToken: inputTokenType,
      intermediateToken: intermediateTokenType,
      outputToken: outputTokenType,
      firstPairId: firstPair.pairId,
      secondPairId: secondPair.pairId,
    });

    // Determine token positions in each pair
    const isInputToken0InFirstPair = matchTokenTypes(
      inputTokenType,
      firstPair.reserves.token0
    );

    const isMidToken0InSecondPair = matchTokenTypes(
      intermediateTokenType,
      secondPair.reserves.token0
    );

    // Explicitly logging token matching results for debugging
    console.log({
      isInputToken0InFirstPair,
      isMidToken0InSecondPair,
      firstPair: {
        token0: firstPair.reserves.token0,
        token1: firstPair.reserves.token1,
      },
      secondPair: {
        token0: secondPair.reserves.token0,
        token1: secondPair.reserves.token1,
      },
    });

    // Determine which multi-hop function to use
    let multiHopFunction;
    let typeArgs: string[] = [];

    if (isInputToken0InFirstPair) {
      // Input is token0 in first pair
      if (isMidToken0InSecondPair) {
        // Mid token is token0 in second pair, output is token1 in second pair
        multiHopFunction = "swap_exact_token0_to_mid_then_mid_to_token1";
        typeArgs = [
          firstPair.reserves.token0, // Input token (T0)
          firstPair.reserves.token1, // Intermediate token (TMid)
          secondPair.reserves.token1, // Output token (T2)
        ];
      } else {
        // Mid token is token1 in second pair, output is token0 in second pair
        multiHopFunction = "swap_exact_token0_to_mid_then_mid_to_token0";
        typeArgs = [
          firstPair.reserves.token0, // Input token (T0)
          firstPair.reserves.token1, // Intermediate token (TMid)
          secondPair.reserves.token0, // Output token (T1)
        ];
      }
    } else {
      // Input is token1 in first pair
      if (isMidToken0InSecondPair) {
        // Mid token is token0 in second pair, output is token1 in second pair
        multiHopFunction = "swap_exact_token1_to_mid_then_mid_to_token1";
        typeArgs = [
          firstPair.reserves.token0, // Intermediate token (TMid)
          firstPair.reserves.token1, // Input token (T1)
          secondPair.reserves.token1, // Output token (T2)
        ];
      } else {
        // Mid token is token1 in second pair, output is token0 in second pair
        multiHopFunction = "swap_exact_token1_to_mid_then_mid_to_token0";
        typeArgs = [
          secondPair.reserves.token0, // Output token (T0)
          firstPair.reserves.token0, // Intermediate token (TMid)
          firstPair.reserves.token1, // Input token (T1)
        ];
      }
    }

    console.log("Multi-hop strategy:", {
      function: multiHopFunction,
      typeArgs,
      amountIn: scaledAmountIn.toString(),
      minOut: scaledMinAmountOut.toString(),
    });

    // Call the multi-hop swap function
    swapTx.moveCall({
      target: `${CONSTANTS.PACKAGE_ID}::router::${multiHopFunction}`,
      typeArguments: typeArgs,
      arguments: [
        swapTx.object(CONSTANTS.ROUTER_ID),
        swapTx.object(CONSTANTS.FACTORY_ID),
        swapTx.object(firstPair.pairId),
        swapTx.object(secondPair.pairId),
        inputCoin,
        swapTx.pure.u256(scaledMinAmountOut.toString()),
        swapTx.pure.u64(deadline),
      ],
    });

    return swapTx;
  } catch (error) {
    console.error("Error creating multi-hop swap transaction:", error);
    throw error;
  }
}

/**
 * Estimate gas budget required for a swap transaction
 * Multi-hop swaps generally require higher gas budgets
 */
export function estimateGasBudget(route: RouteInfo): number {
  // Base gas budget for a standard transaction
  const baseGasBudget = 10_000_000; // 10M units

  // Add additional gas for multi-hop transactions
  if (route.type === "multi") {
    // Scale gas based on number of hops
    return baseGasBudget * (1 + route.hops * 0.5);
  }

  return baseGasBudget;
}

/**
 * Helper function to validate route before creating transaction
 * Returns true if route is valid, false otherwise
 */
export function validateRoute(route: RouteInfo): boolean {
  if (!route) return false;

  // Check path
  if (!Array.isArray(route.path) || route.path.length < 2) {
    return false;
  }

  // Check pairs
  if (!Array.isArray(route.pairs) || route.pairs.length === 0) {
    return false;
  }

  // For multi-hop routes, we need at least 2 pairs
  if (route.type === "multi" && route.pairs.length < 2) {
    return false;
  }

  // Check if all pairs have valid IDs
  for (const pair of route.pairs) {
    if (
      !pair.pairId ||
      typeof pair.pairId !== "string" ||
      !pair.pairId.startsWith("0x")
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Simulate a transaction to check for potential errors
 */
export async function simulateTransaction(
  suiClient: any,
  account: { address: string },
  transaction: Transaction
): Promise<{ success: boolean; error: string | null }> {
  try {
    const simulation = await suiClient.devInspectTransactionBlock({
      transactionBlock: transaction,
      sender: account.address,
    });

    // Check if there are any errors in the simulation
    if (simulation.effects?.status?.error) {
      return {
        success: false,
        error: simulation.effects.status.error,
      };
    }

    return {
      success: true,
      error: null,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error during simulation",
    };
  }
}
