/**
 * Utilities for token swap routing
 */

import { SuiClient } from "@mysten/sui.js/client";

/**
 * Normalizes token type for consistent comparison
 * Handles special cases like SUI tokens
 */
export function normalizeTokenType(tokenType: string): string {
  // Handle null or undefined
  if (!tokenType) return "";

  // Normalize SUI token
  if (tokenType.includes("::sui::SUI")) return "0x2::sui::SUI";

  // Strip whitespace and remove trailing angle brackets sometimes present in types
  return tokenType.trim().replace(/>$/, "");
}

/**
 * Extracts the token symbol from its type
 */
export function getTokenSymbolFromType(tokenType: string): string {
  if (!tokenType) return "Token";

  try {
    const parts = tokenType.split("::");
    // Return last part, removing any trailing angle brackets
    return (parts[parts.length - 1] || "Token").replace(/>$/, "");
  } catch (err) {
    return "Token";
  }
}

/**
 * Compares two token types to check if they're the same token
 * Handles various edge cases for Sui blockchain
 */
export function matchTokenTypes(token1: string, token2: string): boolean {
  // Quick equality check first
  if (token1 === token2) return true;

  // Handle empty strings
  if (!token1 || !token2) return false;

  // Normalize tokens
  const norm1 = normalizeTokenType(token1);
  const norm2 = normalizeTokenType(token2);

  // Direct match after normalization
  if (norm1 === norm2) return true;

  // Check for SUI special case
  if (
    (norm1 === "0x2::sui::SUI" && norm2.includes("::sui::SUI")) ||
    (norm2 === "0x2::sui::SUI" && norm1.includes("::sui::SUI"))
  ) {
    return true;
  }

  // Match by package::module::type pattern
  const parts1 = norm1.split("::");
  const parts2 = norm2.split("::");

  // If both have at least module::type
  if (parts1.length >= 2 && parts2.length >= 2) {
    // Compare last two parts (module::type)
    const moduleType1 = `${parts1[parts1.length - 2]}::${
      parts1[parts1.length - 1]
    }`;
    const moduleType2 = `${parts2[parts2.length - 2]}::${
      parts2[parts2.length - 1]
    }`;

    if (moduleType1 === moduleType2) {
      return true;
    }
  }

  // Compare just the type name as last resort
  const type1 = parts1[parts1.length - 1];
  const type2 = parts2[parts2.length - 1];

  // Explicitly return a boolean to satisfy TypeScript
  return Boolean(type1 && type2 && type1 === type2);
}

/**
 * Sorts token types for consistent ordering in Sui transactions
 * This is critical for the DEX contract which expects tokens in a specific order
 */
export function sortTokenTypes(type0: string, type1: string): [string, string] {
  if (type0 === type1) {
    throw new Error("Cannot sort identical token types");
  }

  const bytes0 = new TextEncoder().encode(type0);
  const bytes1 = new TextEncoder().encode(type1);

  // Compare byte arrays lexicographically
  const minLen = Math.min(bytes0.length, bytes1.length);
  for (let i = 0; i < minLen; i++) {
    if (bytes0[i] !== bytes1[i]) {
      return bytes0[i] < bytes1[i] ? [type0, type1] : [type1, type0];
    }
  }

  // If all compared bytes are equal, shorter array comes first
  return bytes0.length < bytes1.length ? [type0, type1] : [type1, type0];
}

/**
 * Scales an amount to the token's decimal places
 * Handles decimal conversion precisely
 */
export function scaleAmount(amount: string, decimals: number): bigint {
  if (!amount) return BigInt(0);

  // Remove any existing decimal point and count digits after it
  const [whole = "0", fraction = ""] = amount.toString().split(".");
  const scaledWhole = BigInt(whole) * BigInt(10 ** decimals);

  // Handle the fraction part
  const scaledFraction =
    fraction.length > 0
      ? BigInt(fraction.padEnd(decimals, "0").slice(0, decimals))
      : BigInt(0);

  return scaledWhole + scaledFraction;
}

/**
 * Calculates the output amount for a swap based on reserves
 * Includes fee calculation (0.3%)
 */
export function calculateAmountOut(
  amountIn: string,
  reserveIn: string,
  reserveOut: string
): string {
  if (
    !amountIn ||
    !reserveIn ||
    !reserveOut ||
    amountIn === "0" ||
    reserveIn === "0" ||
    reserveOut === "0"
  ) {
    return "0";
  }

  try {
    const BASIS_POINTS = 10000n;
    const TOTAL_FEE = 30n; // 0.3%

    // Convert all amounts to BigInt for precise calculation
    const amountInBN = BigInt(amountIn);
    const reserveInBN = BigInt(reserveIn);
    const reserveOutBN = BigInt(reserveOut);

    // Prevent overflow/invalid states
    if (amountInBN >= reserveInBN) {
      return "0";
    }

    // Apply the fee
    const amountInWithFee = amountInBN * (BASIS_POINTS - TOTAL_FEE);
    const numerator = amountInWithFee * reserveOutBN;
    const denominator = reserveInBN * BASIS_POINTS;

    const amountOut = numerator / denominator;
    return amountOut.toString();
  } catch (error) {
    console.error("Error in calculateAmountOut:", error);
    return "0";
  }
}

/**
 * Calculates the price impact of a swap as a percentage
 */
export function calculatePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  if (
    !amountIn ||
    !reserveIn ||
    !reserveOut ||
    amountIn === 0n ||
    reserveIn === 0n ||
    reserveOut === 0n
  ) {
    return 0;
  }

  try {
    // Calculate price impact as a percentage
    // Formula: (amountIn / reserveIn) * 100
    const impact = (amountIn * 10000n) / reserveIn;
    return Number(impact) / 100;
  } catch (error) {
    console.error("Error calculating price impact:", error);
    return 0;
  }
}

/**
 * Finds optimal coins for a swap based on UTXO model
 * Returns the best combination of coins for the amount
 */
export function findOptimalCoins(coins: any[], requiredAmount: string): any[] {
  try {
    if (!coins || !coins.length) return [];

    const targetAmount = BigInt(requiredAmount);

    // Case 1: Try to find a single coin with exact amount
    const exactCoin = coins.find(
      (coin) => BigInt(coin.balance) === targetAmount
    );
    if (exactCoin) {
      return [exactCoin];
    }

    // Case 2: Find a single coin with enough balance
    const suitableCoin = coins.find(
      (coin) => BigInt(coin.balance) >= targetAmount
    );
    if (suitableCoin) {
      return [suitableCoin];
    }

    // Case 3: Collect multiple coins until we have enough
    const sortedCoins = [...coins].sort((a, b) =>
      BigInt(b.balance) > BigInt(a.balance) ? 1 : -1
    );

    let totalBalance = BigInt(0);
    const selectedCoins = [];

    for (const coin of sortedCoins) {
      if (totalBalance >= targetAmount) break;

      selectedCoins.push(coin);
      totalBalance += BigInt(coin.balance);
    }

    if (totalBalance < targetAmount) {
      return []; // Not enough balance
    }

    return selectedCoins;
  } catch (error) {
    console.error("Error finding optimal coins:", error);
    return [];
  }
}
