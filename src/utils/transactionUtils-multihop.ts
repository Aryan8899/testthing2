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

import { createSwapTransaction } from "./transactionUtils";

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

  if (selectedRoute.type === "direct") {
    return createSwapTransaction(
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
 * With improved error handling, debugging and robust token matching
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

  try {
    // STEP 1: Fetch pair object with more detailed error handling
    console.log(`Fetching pair details for pair ID: ${pairId}`);
    let pairObj;
    try {
      pairObj = await suiClient.getObject({
        id: pairId,
        options: { showContent: true, showType: true, showDisplay: true },
      });
      console.log("Raw pair object:", JSON.stringify(pairObj, null, 2));
    } catch (error: any) {
      console.error("Failed to fetch pair data:", error);
      throw new Error(`Failed to fetch pair details: ${error.message}`);
    }

    if (!pairObj.data?.content?.fields) {
      console.error("Invalid pair structure:", pairObj);
      throw new Error("Pair object has invalid structure");
    }

    // STEP 2: Extract token types with better field detection
    const pairFields = pairObj.data.content.fields;

    // Log the full structure of pairFields to debug
    console.log("Pair fields:", pairFields);

    // Check various possible field names for token types
    let pairToken0 = "";
    let pairToken1 = "";

    // Try different field naming patterns
    // if (pairFields.token0_type) {
    //   pairToken0 = pairFields.token0_type;
    //   pairToken1 = pairFields.token1_type;
    // } else if (pairFields.token_0_type) {
    //   pairToken0 = pairFields.token_0_type;
    //   pairToken1 = pairFields.token_1_type;
    // } else if (pairFields.type_0) {
    //   pairToken0 = pairFields.type_0;
    //   pairToken1 = pairFields.type_1;
    // } else
    {
      // Try to find the token type fields by inspecting all fields
      Object.entries(pairFields).forEach(([key, value]) => {
        if (
          typeof value === "string" &&
          value.includes("::") &&
          key.toLowerCase().includes("token") &&
          key.includes("0")
        ) {
          pairToken0 = value.toString();
        }
        if (
          typeof value === "string" &&
          value.includes("::") &&
          key.toLowerCase().includes("token") &&
          key.includes("1")
        ) {
          pairToken1 = value.toString();
        }
      });
    }

    if (!pairToken0 || !pairToken1) {
      console.error(
        "Could not find token type fields in pair object:",
        pairFields
      );
      throw new Error("Failed to extract token types from pair");
    }

    console.log("Pair token types identified:", {
      pairToken0,
      pairToken1,
      userToken0: token0.coinType,
      userToken1: token1.coinType,
    });

    // STEP 3: Determine token positions with more robust matching
    // Normalize all token types for consistent comparison
    const normalizedPairToken0 = normalizeTokenType(pairToken0);
    const normalizedPairToken1 = normalizeTokenType(pairToken1);
    const normalizedUserToken0 = normalizeTokenType(token0.coinType as string);
    const normalizedUserToken1 = normalizeTokenType(token1.coinType as string);

    console.log("Normalized token types:", {
      normalizedPairToken0,
      normalizedPairToken1,
      normalizedUserToken0,
      normalizedUserToken1,
    });

    // Check multiple matching patterns to be robust
    const isInputToken0 = matchTokenTypes(
      normalizedPairToken0,
      normalizedUserToken0
    );

    console.log("Token matching result:", {
      isInputToken0,
      matchDetails: {
        pairToken0_vs_userToken0: matchTokenTypes(
          normalizedPairToken0,
          normalizedUserToken0
        ),
        pairToken1_vs_userToken0: matchTokenTypes(
          normalizedPairToken1,
          normalizedUserToken0
        ),
        pairToken0_vs_userToken1: matchTokenTypes(
          normalizedPairToken0,
          normalizedUserToken1
        ),
        pairToken1_vs_userToken1: matchTokenTypes(
          normalizedPairToken1,
          normalizedUserToken1
        ),
      },
    });

    // STEP 4: Select swap function with verification
    const swapFunction = isInputToken0
      ? "swap_exact_tokens0_for_tokens1"
      : "swap_exact_tokens1_for_tokens0";

    console.log(`Selected swap function: ${swapFunction}`);

    // STEP 5: Calculate amounts with proper decimal handling
    const scaledAmountIn = scaleAmount(amount0, token0.decimals);
    const scaledMinAmountOut = scaleAmount(minAmountOut, token1.decimals);

    console.log("Swap parameters:", {
      function: swapFunction,
      typeArg0: pairToken0,
      typeArg1: pairToken1,
      amountIn: scaledAmountIn.toString(),
      minOut: scaledMinAmountOut.toString(),
      deadline,
    });

    // STEP 6: Create transaction
    const swapTx = new Transaction();

    // STEP 7: Fetch coins with better error handling
    console.log(
      `Fetching ${token0.symbol} coins for address: ${account.address}`
    );
    let coins;
    try {
      coins = await suiClient.getCoins({
        owner: account.address,
        coinType: token0.coinType,
      });
      console.log(`Found ${coins.data.length} coins of type ${token0.symbol}`);
    } catch (error: any) {
      console.error("Failed to fetch coins:", error);
      throw new Error(`Failed to fetch coins: ${error.message}`);
    }

    // Find optimal coins with validation
    const coinsToUse = findOptimalCoins(coins.data, scaledAmountIn.toString());

    if (!coinsToUse || coinsToUse.length === 0) {
      console.error("No suitable coins found for the swap amount");
      throw new Error(`Insufficient balance of ${token0.symbol} for this swap`);
    }

    console.log(`Using ${coinsToUse.length} coins for the swap`);

    // STEP 8: Prepare input coin(s) with better handling
    let inputCoin;

    if (coinsToUse.length === 1) {
      // Single coin case
      const coinToUse = coinsToUse[0];
      const isSUI = token0.coinType === "0x2::sui::SUI";
      const coinBalance = BigInt(coinToUse.balance);

      console.log(`Using single coin with balance: ${coinBalance.toString()}`);

      if (coinBalance > scaledAmountIn) {
        // Need to split the coin when balance > needed amount
        console.log(
          `Splitting coin - need ${scaledAmountIn.toString()} from ${coinBalance.toString()}`
        );
        const coinObj = isSUI
          ? swapTx.gas
          : swapTx.object(coinToUse.coinObjectId);

        [inputCoin] = swapTx.splitCoins(coinObj, [
          swapTx.pure.u64(scaledAmountIn.toString()),
        ]);
      } else {
        // Use whole coin when balance = needed amount
        console.log(`Using entire coin with exact balance needed`);
        inputCoin = isSUI ? swapTx.gas : swapTx.object(coinToUse.coinObjectId);
      }
    } else {
      // Multiple coins case (need to merge first)
      console.log(`Using multiple coins (${coinsToUse.length})`);
      const primaryCoin = swapTx.object(coinsToUse[0].coinObjectId);
      const otherCoins = coinsToUse
        .slice(1)
        .map((coin) => swapTx.object(coin.coinObjectId));

      // Merge coins first
      console.log(`Merging ${otherCoins.length} coins into primary coin`);
      swapTx.mergeCoins(primaryCoin, otherCoins);

      // Now split if needed
      const totalBalance = coinsToUse.reduce(
        (sum, coin) => sum + BigInt(coin.balance),
        BigInt(0)
      );

      console.log(`Total balance after merge: ${totalBalance.toString()}`);

      if (totalBalance > scaledAmountIn) {
        console.log(
          `Splitting merged coin - need ${scaledAmountIn.toString()} from ${totalBalance.toString()}`
        );
        [inputCoin] = swapTx.splitCoins(primaryCoin, [
          swapTx.pure.u64(scaledAmountIn.toString()),
        ]);
      } else {
        console.log(
          `Using entire merged coin with balance: ${totalBalance.toString()}`
        );
        inputCoin = primaryCoin;
      }
    }

    // STEP 9: Verify constants before making the move call
    console.log("Verifying constants for Move call:", {
      PACKAGE_ID: CONSTANTS.PACKAGE_ID,
      ROUTER_ID: CONSTANTS.ROUTER_ID,
      FACTORY_ID: CONSTANTS.FACTORY_ID,
    });

    if (
      !CONSTANTS.PACKAGE_ID ||
      !CONSTANTS.ROUTER_ID ||
      !CONSTANTS.FACTORY_ID
    ) {
      throw new Error("Missing required constants for swap");
    }

    // STEP 10: Add the swap call with extra validation
    console.log("Creating Move call with transaction arguments");
    try {
      swapTx.moveCall({
        target: `${CONSTANTS.PACKAGE_ID}::router::${swapFunction}`,
        typeArguments: [pairToken0, pairToken1], // Use pair's original token ordering
        arguments: [
          swapTx.object(CONSTANTS.ROUTER_ID),
          swapTx.object(CONSTANTS.FACTORY_ID),
          swapTx.object(pairId),
          inputCoin,
          swapTx.pure.u256(scaledMinAmountOut.toString()),
          swapTx.pure.u64(deadline),
        ],
      });
    } catch (error: any) {
      console.error("Failed to create Move call:", error);
      throw new Error(`Failed to create swap transaction: ${error.message}`);
    }

    console.log("Direct swap transaction created successfully");
    return swapTx;
  } catch (error: any) {
    console.error("Error creating direct swap transaction:", error);
    // Rethrow with more specific error message
    if (error.message) {
      throw error; // Preserve original error with details
    } else {
      throw new Error(
        "Failed to create direct swap transaction due to an unknown error"
      );
    }
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
 * Helper function to interpret Move error codes
 * Maps error codes to user-friendly messages
 */
export function interpretMoveError(error: string): string {
  // Parse MoveAbort errors
  const moveAbortMatch = error.match(/MoveAbort\(.*?, (\d+)\)/);
  if (moveAbortMatch) {
    const errorCode = parseInt(moveAbortMatch[1]);

    // Map known error codes to messages
    switch (errorCode) {
      case 305:
        return "Insufficient liquidity or imbalanced reserves";
      case 306:
        return "Slippage too high, try increasing slippage tolerance";
      case 307:
        return "Pool reserves update failed";
      case 308:
        return "Pair already exists";
      case 309:
        return "Insufficient output amount, try increasing slippage";
      case 310:
        return "Excessive input amount";
      case 311:
        return "Transaction deadline expired";
      case 1:
        return "Insufficient balance for swap";
      case 2:
        return "Router not authorized";
      default:
        return `Transaction failed with code ${errorCode}, try again with higher slippage`;
    }
  }

  // Handle other error types
  if (error.includes("insufficient gas")) {
    return "Transaction needs more gas, try a direct swap";
  }

  if (error.includes("balance")) {
    return "Insufficient balance for swap";
  }

  if (error.includes("slippage")) {
    return "Price moved too much, try increasing slippage tolerance";
  }

  // Default message for unknown errors
  return "Swap failed, please try again";
}

/**
 * Extended simulation function with detailed error reporting
 */
export async function simulateTransaction(
  suiClient: any,
  account: { address: string },
  transaction: Transaction
): Promise<{ success: boolean; error: string | null; details?: any }> {
  try {
    const simulation = await suiClient.devInspectTransactionBlock({
      transactionBlock: transaction,
      sender: account.address,
    });

    // Check if there are any errors in the simulation
    if (simulation.effects?.status?.error) {
      return {
        success: false,
        error: interpretMoveError(simulation.effects.status.error),
        details: simulation.effects.status.error,
      };
    }

    return {
      success: true,
      error: null,
      details: simulation,
    };
  } catch (error: any) {
    return {
      success: false,
      error:
        interpretMoveError(error.message) || "Unknown error during simulation",
      details: error,
    };
  }
}

/**
 * Updated function to handle Wallet adapter errors
 */
export function handleSwapError(error: any): string {
  console.error("Detailed swap error:", error);

  let errorMessage = error.message || "Unknown error";

  // Check if it's a MoveAbort error
  if (typeof errorMessage === "string" && errorMessage.includes("MoveAbort")) {
    return interpretMoveError(errorMessage);
  }

  // Handle wallet adapter errors
  if (error.code) {
    switch (error.code) {
      case 4001:
        return "Transaction rejected by user";
      case 4100:
        return "Wallet disconnected or unauthorized";
      case 4200:
        return "Wallet request failed, please try again";
      case 4900:
        return "Network connection issue, please check your connection";
      default:
        return `Wallet error (${error.code}): ${error.message}`;
    }
  }

  // Handle network errors
  if (
    errorMessage.includes("INSUFFICIENT_RESOURCES") ||
    errorMessage.includes("Failed to fetch")
  ) {
    return "Network congestion detected. Please try again.";
  }

  // Default to a user-friendly version of the original error
  return "Swap failed: " + errorMessage;
}
