/**
 * Shared utilities for token handling
 */

// Shared interfaces
export interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  coinType?: string;
  allObjectIds?: string[];
  metadata?: {
    name: string;
    symbol: string;
    image?: string;
    decimals: number;
  };
}

export interface TokenInfo {
  id: string;
  type: string;
  coinType?: string;
  metadata?: {
    name: string;
    symbol: string;
    image?: string;
    decimals: number;
  };
  balance: string;
  allObjectIds?: string[];
}

export const DEFAULT_TOKEN_IMAGE =
  "https://assets.crypto.ro/logos/sui-sui-logo.png";

/**
 * Fetch all coins of a specific type owned by an address
 * This handles pagination to ensure all coins are fetched
 */
export async function fetchAllCoins(
  suiClient: any,
  address: string,
  coinType: string
) {
  try {
    let allCoins: any[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    // Handle pagination to get ALL coin objects
    while (hasNextPage) {
      const response: any = await suiClient.getCoins({
        owner: address,
        coinType: coinType,
        cursor,
        limit: 50, // Fetch in batches of 50
      });

      allCoins = [...allCoins, ...response.data];
      hasNextPage = response.hasNextPage;
      cursor = response.nextCursor;
    }

    return { data: allCoins };
  } catch (error) {
    console.error(`Error fetching all coins for ${coinType}:`, error);
    return { data: [] };
  }
}

/**
 * Calculate total balance across all coin objects
 * This is critical for Sui's UTXO model where value can be split across objects
 */
export function calculateTotalBalance(coins: { data: any[] }) {
  try {
    if (!coins.data || !Array.isArray(coins.data)) {
      return "0";
    }

    // Use BigInt for safe integer operations with large coin values
    let total = BigInt(0);

    for (const coin of coins.data) {
      // Add each coin's balance to the running total
      total += BigInt(coin.balance || 0);
    }

    return total.toString();
  } catch (error) {
    console.error("Error calculating total balance:", error);
    return "0";
  }
}

/**
 * Get base type from a coin type string
 */
export const getBaseType = (coinType: string): string => {
  try {
    const match = coinType.match(/<(.+)>/);
    return match ? match[1] : coinType;
  } catch (error) {
    console.error("Error getting base type:", error);
    return coinType;
  }
};

/**
 * Sort token types lexicographically for consistent order in pairs
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
 * Find optimal coins to use for a transaction
 */
export function findOptimalCoins(coins: any[], requiredAmount: string) {
  try {
    if (!coins || !coins.length) return null;

    const targetAmount = BigInt(requiredAmount);

    // Edge case: If any single coin is exactly the amount needed
    const exactCoin = coins.find(
      (coin) => BigInt(coin.balance) === targetAmount
    );
    if (exactCoin) return [exactCoin];

    // Find a single coin that has enough balance
    const suitableCoin = coins.find(
      (coin) => BigInt(coin.balance) >= targetAmount
    );
    if (suitableCoin) return [suitableCoin];

    // Otherwise, we need to combine multiple coins
    // Sort coins by balance (descending)
    const sortedCoins = [...coins].sort((a, b) =>
      BigInt(b.balance) > BigInt(a.balance) ? 1 : -1
    );

    let totalBalance = BigInt(0);
    const selectedCoins = [];

    for (const coin of sortedCoins) {
      selectedCoins.push(coin);
      totalBalance += BigInt(coin.balance);

      if (totalBalance >= targetAmount) {
        return selectedCoins;
      }
    }

    // If we get here, it means we don't have enough balance
    return null;
  } catch (error) {
    console.error("Error finding optimal coins:", error);
    return null;
  }
}

/**
 * Clean token name by removing module prefix and trailing '>' character
 */
export const cleanTokenName = (name: string): string => {
  if (!name) return "";
  return name.split("::")?.pop()?.replace(/>$/, "") || "";
};
