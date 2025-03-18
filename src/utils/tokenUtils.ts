// tokenUtils.ts - Updated with resource-aware methods
import { advancedSuiClient } from "./advancedSuiClient";

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
 * Delay promise to prevent overwhelming the network
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cache for token data to reduce redundant fetches
 */
const coinMetadataCache = new Map<string, any>();
const coinTypeCache = new Map<string, string>();

/**
 * Fetch all coins of a specific type owned by an address
 * This handles pagination to ensure all coins are fetched
 * with resource-aware methods
 */
export async function fetchAllCoins(address: string, coinType: string) {
  try {
    let allCoins: any[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;
    let retryCount = 0;
    const maxRetries = 3;

    // Log the coin fetch to help with debugging
    console.log(
      `Fetching coins for ${coinType} owned by ${address.slice(0, 6)}...`
    );

    // Handle pagination to get ALL coin objects with retry logic
    while (hasNextPage && retryCount < maxRetries) {
      try {
        const response: any = await advancedSuiClient.getCoins({
          owner: address,
          coinType: coinType,
          cursor,
          limit: 20, // Reduced batch size from 50 to 20
        });

        if (!response || !response.data) {
          console.warn(`Empty response when fetching coins for ${coinType}`);
          break;
        }

        allCoins = [...allCoins, ...response.data];
        hasNextPage = response.hasNextPage;
        cursor = response.nextCursor;

        // If we have another page to fetch, add a small delay to avoid overwhelming the node
        if (hasNextPage) {
          await delay(500);
        }

        // Reset retry count on success
        retryCount = 0;
      } catch (error) {
        retryCount++;
        console.warn(
          `Error fetching coins (attempt ${retryCount}/${maxRetries}):`,
          error
        );

        if (retryCount >= maxRetries) {
          console.error(`Failed to fetch coins after ${maxRetries} attempts`);
          break;
        }

        // Exponential backoff between retries
        await delay(1000 * Math.pow(2, retryCount));
      }
    }

    return { data: allCoins };
  } catch (error) {
    console.error(`Error fetching all coins for ${coinType}:`, error);
    // Return empty array rather than throwing, to allow partial progress
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
 * Get coin type for a token with caching
 */
export async function getCoinType(tokenId: string): Promise<string> {
  // Check cache first
  if (coinTypeCache.has(tokenId)) {
    return coinTypeCache.get(tokenId) || "";
  }

  try {
    const tokenObj = await advancedSuiClient.getObject({
      id: tokenId,
      options: { showType: true },
    });

    const fullType = tokenObj.data?.type || "";
    const coinTypeMatch = fullType.match(/<(.+)>/);
    const coinType = coinTypeMatch ? coinTypeMatch[1] : "";

    // Cache the result
    if (coinType) {
      coinTypeCache.set(tokenId, coinType);
    }

    return coinType;
  } catch (error) {
    console.error(`Error getting coin type for ${tokenId}:`, error);
    return "";
  }
}

/**
 * Get coin metadata with caching
 */
export async function getCoinMetadata(coinType: string) {
  // Check cache first
  if (coinMetadataCache.has(coinType)) {
    return coinMetadataCache.get(coinType);
  }

  try {
    const metadata = await advancedSuiClient.getCoinMetadata({ coinType });

    // Cache the result
    if (metadata) {
      coinMetadataCache.set(coinType, metadata);
    }

    return metadata;
  } catch (error) {
    console.error(`Error getting coin metadata for ${coinType}:`, error);

    // Return fallback metadata
    const fallbackMetadata = {
      name: coinType.split("::").pop() || "Unknown",
      symbol: coinType.split("::").pop() || "Unknown",
      iconUrl: DEFAULT_TOKEN_IMAGE,
      decimals: 9,
    };

    // Cache the fallback too
    coinMetadataCache.set(coinType, fallbackMetadata);

    return fallbackMetadata;
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

/**
 * Cache clear function for testing
 */
export function clearTokenCaches() {
  coinMetadataCache.clear();
  coinTypeCache.clear();
}
