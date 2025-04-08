// tokenUtils.ts - Updated with resource-aware methods and image handling
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

// Define a list of known tokens for use across the application
const tokenList: Token[] = [
  // This is a placeholder - you should replace this with your actual token list
  // Example token format:
  {
    id: "0x2::sui::SUI",
    name: "Sui",
    symbol: "SUI",
    decimals: 9,
    coinType: "0x2::sui::SUI",
    metadata: {
      name: "Sui",
      symbol: "SUI",
      decimals: 9,
      image: DEFAULT_TOKEN_IMAGE,
    },
  },
  // Add more tokens as needed
];

/**
 * Get all available tokens in the system
 * @returns Array of Token objects
 */
export function getAllTokens(): Token[] {
  return tokenList;
}

/**
 * Normalizes a token object to ensure it has all required properties
 * particularly focusing on the image URL in metadata
 */
export function normalizeToken(token: Token): Token {
  if (!token) return token;

  // Create a proper metadata object if it doesn't exist
  const metadata = token.metadata || {
    name: token.name || "",
    symbol: token.symbol || "",
    decimals: token.decimals || 9,
    image: DEFAULT_TOKEN_IMAGE,
  };

  // Ensure the image property exists
  if (!metadata.image) {
    metadata.image = DEFAULT_TOKEN_IMAGE;
  }

  // Return a new token object with all properties properly set
  return {
    ...token,
    name: token.name || metadata.name || "",
    symbol: token.symbol || metadata.symbol || "",
    decimals: token.decimals || metadata.decimals || 9,
    metadata,
  };
}

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
  return compareBytes(bytes0, bytes1) ? [type0, type1] : [type1, type0];
}

const compareBytes = (a: any, b: any) => {
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) {
      return a[i] < b[i];
    }
  }
  return a.length < b.length;
};

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

/**
 * Find a token by its id
 * @param tokenId The id of the token to find
 * @returns The token or null if not found
 */
export function findTokenById(tokenId: string): Token | null {
  if (!tokenId) return null;

  const foundToken = tokenList.find(
    (token) => token.id && token.id.toLowerCase() === tokenId.toLowerCase()
  );

  // If found, ensure it has proper image
  return foundToken ? normalizeToken(foundToken) : null;
}

/**
 * Dynamically finds an object ID for a given coin type
 * @param {string} coinType - The coin type (e.g. "0x2::sui::SUI")
 * @param {Object} suiClient - The SUI client instance
 * @param {string} address - User's wallet address
 * @returns {Promise<string|null>} - Object ID or null if not found
 */
export const getTokenObjectId = async (
  coinType: any,
  suiClient: any,
  address: any
) => {
  if (!coinType || !address) return null;

  try {
    console.log(
      `[getTokenObjectId] Fetching object ID for coin type: ${coinType}`
    );

    // Normalize the coin type format
    const normalizedCoinType = normalizeCoinType(coinType);
    console.log(
      `[getTokenObjectId] Normalized coin type: ${normalizedCoinType}`
    );

    // Get all coins of the given type
    const coinsResponse = await suiClient.getCoins({
      owner: address,
      coinType: normalizedCoinType,
    });

    if (coinsResponse.data && coinsResponse.data.length > 0) {
      // Return the ID of the first coin found
      const objectId = coinsResponse.data[0].coinObjectId;
      console.log(
        `[getTokenObjectId] Found object ID ${objectId} for type ${normalizedCoinType}`
      );
      return objectId;
    }

    console.warn(
      `[getTokenObjectId] No coins found for type: ${normalizedCoinType}`
    );
    return null;
  } catch (error) {
    console.error(
      `[getTokenObjectId] Error finding object ID for ${coinType}:`,
      error
    );
    return null;
  }
};

/**
 * Ensures coin type is in the proper format
 * @param {string} coinType - The coin type to normalize
 * @returns {string} - The normalized coin type
 */
export const normalizeCoinType = (coinType: any) => {
  if (!coinType) return "";

  // If it's already properly formatted, return as is
  if (coinType.startsWith("0x")) {
    return coinType;
  }

  // Handle special case for SUI
  if (coinType.toLowerCase().includes("sui::sui")) {
    return "0x2::sui::SUI";
  }

  // Add '0x' prefix if it's a full type without it
  if (coinType.includes("::")) {
    const parts = coinType.split("::");
    if (parts.length >= 3 && !parts[0].startsWith("0x")) {
      parts[0] = `0x${parts[0]}`;
      return parts.join("::");
    }
  }

  return coinType;
};
