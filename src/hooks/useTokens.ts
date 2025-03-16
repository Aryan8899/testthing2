/**
 * Custom hook for fetching and managing tokens with improved error handling
 */
import { useState, useEffect, useCallback,useMemo  } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { toast } from "react-toastify";
import {
  TokenInfo,
  DEFAULT_TOKEN_IMAGE,
  getBaseType,
} from "../utils/tokenUtils";
import { SuiClient } from "@mysten/sui.js/client";


export function useTokens() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const suiClient = useMemo(
    () => new SuiClient({ url: "https://fullnode.devnet.sui.io/" }),
    []
  );
  const { account } = useWallet(); // Suiet wallet hook

  // Cache for metadata to avoid repeated API calls
  const metadataCache = new Map<string, any>();

  // Function to fetch metadata with retry and fallback
  const fetchMetadataWithRetry = async (
    coinType: string,
    retries = 3
  ): Promise<any> => {
    // Check cache first
    if (metadataCache.has(coinType)) {
      return metadataCache.get(coinType);
    }

    // Attempt to fetch metadata with retries
    let attempt = 0;
    let lastError;

    while (attempt < retries) {
      try {
        attempt++;
        const metadata = await suiClient.getCoinMetadata({ coinType });

        if (metadata) {
          // Successfully got metadata, update cache
          metadataCache.set(coinType, metadata);
          return metadata;
        }
      } catch (error: any) {
        console.warn(
          `Attempt ${attempt} failed to fetch metadata for ${coinType}:`,
          error
        );
        lastError = error;

        // Add slight delay between retries to avoid overwhelming the node
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    // If we get here, all retries failed
    console.error(
      `Failed to fetch metadata for ${coinType} after ${retries} attempts:`,
      lastError
    );

    // Create fallback metadata using the coinType information
    const fallbackMetadata = {
      name: coinType.split("::").pop() || "Unknown",
      symbol: coinType.split("::").pop() || "Unknown",
      iconUrl: DEFAULT_TOKEN_IMAGE,
      decimals: 9,
    };

    // Cache the fallback metadata
    metadataCache.set(coinType, fallbackMetadata);
    return fallbackMetadata;
  };

  // Fetch tokens from the connected wallet
  const fetchTokens = useCallback(async () => {
    if (!account?.address) return;

    setIsLoading(true);

    try {

      // Step 1: First get all object types to categorize them
      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        options: {
          showType: true,
          showContent: true,
        },
        limit: 50,
      });

      // Group tokens by coin type (not object ID)
      const coinTypeMap = new Map<
        string,
        {
          balance: bigint;
          objectIds: string[];
          firstObjectId: string;
          type: string;
        }
      >();

      // Process all objects and group by coin type
      for (const obj of objects.data) {
        if (!obj.data?.type || !obj.data.type.includes("::coin::")) continue;

        const typeString = obj.data.type;
        const coinTypeMatch = typeString.match(/<(.+)>/);
        if (!coinTypeMatch) continue;

        const coinType = coinTypeMatch[1];

        // Skip LP tokens
        if (typeString.includes("LPCoin") || coinType.includes("LPCoin")) {
          continue;
        }

        // Extract balance
        let rawBalance = "0";
        if (
          obj.data?.content &&
          typeof obj.data.content === "object" &&
          "fields" in obj.data.content &&
          obj.data.content.fields &&
          typeof obj.data.content.fields === "object" &&
          "balance" in obj.data.content.fields
        ) {
          rawBalance = obj.data.content.fields.balance as string;
        }

        const balance = BigInt(rawBalance || "0");

        // Only include tokens with non-zero balance
        if (balance <= BigInt(0)) continue;

        // Update or initialize the coin type entry
        if (coinTypeMap.has(coinType)) {
          const existing = coinTypeMap.get(coinType)!;
          existing.balance += balance;
          existing.objectIds.push(obj.data.objectId);
        } else {
          coinTypeMap.set(coinType, {
            balance,
            objectIds: [obj.data.objectId],
            firstObjectId: obj.data.objectId,
            type: typeString,
          });
        }
      }

      // Step 2: Fetch metadata for all unique coin types in parallel
      const tokenInfos: TokenInfo[] = [];

      // Create a batch of promises for metadata fetching with concurrency limit
      const coinTypes = Array.from(coinTypeMap.keys());
      const batchSize = 5; // Limit concurrent requests
      let completedCount = 0;

      for (let i = 0; i < coinTypes.length; i += batchSize) {
        const batch = coinTypes.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (coinType) => {
            try {
              const entry = coinTypeMap.get(coinType);
              if (!entry) return null;

              // Fetch metadata with retry and fallback
              const metadata = await fetchMetadataWithRetry(coinType);

              // Create token info with metadata
              const tokenInfo: TokenInfo = {
                id: entry.firstObjectId,
                type: entry.type,
                coinType: coinType,
                metadata: {
                  name:
                    metadata?.name || coinType.split("::").pop() || "Unknown",
                  symbol:
                    metadata?.symbol || coinType.split("::").pop() || "Unknown",
                  image: metadata?.iconUrl || DEFAULT_TOKEN_IMAGE,
                  decimals: metadata?.decimals || 9,
                },
                balance: entry.balance.toString(),
                allObjectIds: entry.objectIds,
              };

              tokenInfos.push(tokenInfo);
              completedCount++;
            } catch (error) {
              console.error(`Error processing token ${coinType}:`, error);
            }
          })
        );
      }

      // Sort tokens by balance (highest first)
      tokenInfos.sort((a, b) => {
        const balanceA = BigInt(a.balance);
        const balanceB = BigInt(b.balance);
        return balanceB > balanceA ? 1 : -1;
      });

      console.log("Loaded tokens:", tokenInfos);

      setTokens(tokenInfos);
      setFilteredTokens(tokenInfos);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      toast.error("Failed to load tokens. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, suiClient]);

  // Filter tokens based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTokens(tokens);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = tokens.filter((token) => {
      const name = token.metadata?.name?.toLowerCase() || "";
      const symbol = token.metadata?.symbol?.toLowerCase() || "";
      return name.includes(query) || symbol.includes(query);
    });

    setFilteredTokens(filtered);
  }, [searchQuery, tokens]);

  // Initial fetch
  useEffect(() => {
    if (account?.address) {
      fetchTokens();
    }
  }, [account?.address, fetchTokens]);

  return {
    tokens,
    filteredTokens,
    isLoading,
    searchQuery,
    setSearchQuery,
    fetchTokens,
  };
}
