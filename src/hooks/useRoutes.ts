import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { Token } from "../utils/tokenUtils";
import {
  normalizeTokenType,
  matchTokenTypes,
  sortTokenTypes,
  scaleAmount,
  calculateAmountOut,
  calculatePriceImpact,
} from "../utils/routeUtils";
import { CONSTANTS } from "../constants/addresses";

// Define types for event data
interface PairCreatedEvent {
  token0: string | { name: string; [key: string]: any };
  token1: string | { name: string; [key: string]: any };
  pair: string;
  pair_address?: string;
  [key: string]: any;
}

// Define pair cache object type
interface PairCache {
  pairId: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  reserve0: string;
  reserve1: string;
  lastUpdated: number;
}

export interface RouteInfo {
  path: string[]; // Array of token addresses in the path
  pathSymbols: string[]; // Array of token symbols for display
  pairs: Array<{
    // Information about each pair in the route
    pairId: string;
    reserves: {
      token0: string;
      token1: string;
      reserve0: string;
      reserve1: string;
    };
  }>;
  hops: number; // Number of hops in the route
  estimatedOutput: string; // Estimated output amount
  priceImpact: number; // Price impact percentage
  type: "direct" | "multi"; // Route type
}

// Cache TTL in milliseconds
const PAIR_CACHE_TTL = 60 * 1000; // 1 minute
const ROUTE_CACHE_TTL = 30 * 1000; // 30 seconds
const MAX_ROUTE_CACHE_ITEMS = 20; // Maximum number of cached routes

/**
 * Custom hook to find and evaluate swap routes
 */
export function useRoutes(
  suiClient: any,
  token0: Token | null,
  token1: Token | null,
  amount0: string,
  pairExists: boolean,
  currentPairId: string | null,
  reserves: any
) {
  // State for routes and ui
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteInfo | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [allPairs, setAllPairs] = useState<PairCache[]>([]);
  const [lastRouteUpdate, setLastRouteUpdate] = useState<number>(0);
  const [lastAmountForRoute, setLastAmountForRoute] = useState<string>("");

  // Refs to avoid excessive re-renders
  const routesRef = useRef<RouteInfo[]>([]);
  const pairsLoadedRef = useRef<boolean>(false);
  const pairLoadingRef = useRef<boolean>(false);
  const routesLoadingRef = useRef<boolean>(false);
  const lastTokenPairRef = useRef<string>("");
  const routeCacheRef = useRef<
    Map<string, { routes: RouteInfo[]; timestamp: number }>
  >(new Map());
  const findRoutesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { account } = useWallet();

  // Safe string extractor for various token formats
  const safeExtractString = (value: any): string => {
    if (typeof value === "string") return value;
    if (typeof value === "object" && value !== null) {
      if ("name" in value && typeof value.name === "string") return value.name;
      return JSON.stringify(value);
    }
    return String(value || "");
  };

  // Get token symbol from type
  const getTokenSymbol = useCallback((tokenType: string): string => {
    if (!tokenType) return "Token";

    try {
      const parts = tokenType.split("::");
      // Return last part, removing any trailing angle brackets
      return (parts[parts.length - 1] || "Token").replace(/>$/, "");
    } catch (err) {
      return "Token";
    }
  }, []);

  /**
   * Fetch all trading pairs from the DEX
   */
  const fetchAllPairs = useCallback(async () => {
    if (!account?.address || pairsLoadedRef.current || pairLoadingRef.current)
      return;

    pairLoadingRef.current = true;
    console.log("🔍 Fetching all trading pairs...");

    try {
      // Check cache first
      const cachedPairs = localStorage.getItem("dex_all_pairs");
      const cachedTimestamp = localStorage.getItem("dex_all_pairs_timestamp");

      if (cachedPairs && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp);
        const now = Date.now();

        // Use cache if it's fresh (less than 5 minutes old)
        if (now - timestamp < 5 * 60 * 1000) {
          console.log("Using cached pairs data");
          const parsedPairs = JSON.parse(cachedPairs);
          setAllPairs(parsedPairs);
          pairsLoadedRef.current = true;
          pairLoadingRef.current = false;
          return;
        }
      }

      // Fetch factory events for pair creation
      const factoryEvents = await suiClient.queryEvents({
        query: {
          MoveEventType: `${CONSTANTS.PACKAGE_ID}::factory::PairCreated`,
        },
        limit: 100,
      });

      // Process all pairs
      const processedPairs: PairCache[] = [];
      const now = Date.now();

      for (const event of factoryEvents.data) {
        try {
          // Type assertion for parsedJson
          const eventData = event.parsedJson as PairCreatedEvent;

          // Extract token addresses with proper object handling
          const token0Type = safeExtractString(eventData.token0);
          const token1Type = safeExtractString(eventData.token1);

          // Extract pair ID
          const pairId = eventData.pair || eventData.pair_address || "";

          if (!token0Type || !token1Type || !pairId) continue;

          // Get reserves
          const pairObj = await suiClient.getObject({
            id: pairId,
            options: { showContent: true },
          });

          // Type guard for content
          if (!pairObj.data?.content) continue;

          // Safe type assertion for content fields
          const content = pairObj.data.content;
          if (!("fields" in content)) continue;

          const fields = content.fields as any;
          const reserve0 = fields.reserve0 || "0";
          const reserve1 = fields.reserve1 || "0";

          // Skip pairs with no liquidity
          if (reserve0 === "0" || reserve1 === "0") continue;

          // Normalize token types
          const normalizedToken0 = normalizeTokenType(token0Type);
          const normalizedToken1 = normalizeTokenType(token1Type);

          const token0Symbol = getTokenSymbol(normalizedToken0);
          const token1Symbol = getTokenSymbol(normalizedToken1);

          processedPairs.push({
            pairId,
            token0: normalizedToken0,
            token1: normalizedToken1,
            token0Symbol,
            token1Symbol,
            reserve0,
            reserve1,
            lastUpdated: now,
          });
        } catch (error) {
          // Skip invalid pairs
          console.warn("Skipping invalid pair:", error);
          continue;
        }
      }

      if (processedPairs.length > 0) {
        console.log(`Found ${processedPairs.length} active liquidity pairs`);
        setAllPairs(processedPairs);

        // Update cache
        localStorage.setItem("dex_all_pairs", JSON.stringify(processedPairs));
        localStorage.setItem("dex_all_pairs_timestamp", now.toString());

        pairsLoadedRef.current = true;
      } else {
        console.warn("No liquidity pairs found");
      }
    } catch (error) {
      console.error("Error fetching all pairs:", error);
    } finally {
      pairLoadingRef.current = false;
    }
  }, [account?.address, suiClient, getTokenSymbol]);

  /**
   * Update reserves for a specific pair
   */
  const updatePairReserves = useCallback(
    async (pairId: string): Promise<void> => {
      try {
        // Get reserves
        const pairObj = await suiClient.getObject({
          id: pairId,
          options: { showContent: true },
        });

        // Type guard for content
        if (!pairObj.data?.content || !("fields" in pairObj.data.content))
          return;

        const fields = pairObj.data.content.fields as any;
        const reserve0 = fields.reserve0 || "0";
        const reserve1 = fields.reserve1 || "0";

        // Update the pair's reserves in the allPairs state
        setAllPairs((prevPairs) =>
          prevPairs.map((pair) =>
            pair.pairId === pairId
              ? { ...pair, reserve0, reserve1, lastUpdated: Date.now() }
              : pair
          )
        );
      } catch (error) {
        // Just log error, don't stop execution
        console.error(`Error updating reserves for pair ${pairId}:`, error);
      }
    },
    [suiClient]
  );

  /**
   * Find pairs that include a specific token
   */
  const findPairsWithToken = useCallback(
    (tokenType: string | undefined): PairCache[] => {
      if (!tokenType) return [];

      const normalizedType = normalizeTokenType(tokenType);

      return allPairs.filter(
        (pair) =>
          matchTokenTypes(pair.token0, normalizedType) ||
          matchTokenTypes(pair.token1, normalizedType)
      );
    },
    [allPairs]
  );

  /**
   * Find all possible routes between token0 and token1
   */
  const findRoutes = useCallback(async () => {
    if (!token0 || !token1 || routesLoadingRef.current) {
      return;
    }

    // Check route cache
    const tokenPairKey = `${token0.id}-${token1.id}`;
    const now = Date.now();

    // Check if amount is significantly different (>5% change)
    const amountChanged =
      amount0 &&
      lastAmountForRoute &&
      Math.abs(parseFloat(amount0) - parseFloat(lastAmountForRoute)) /
        parseFloat(lastAmountForRoute) >
        0.05;

    // Check cache for recent routes
    const cacheEntry = routeCacheRef.current.get(tokenPairKey);
    if (
      cacheEntry &&
      now - cacheEntry.timestamp < ROUTE_CACHE_TTL &&
      !amountChanged &&
      cacheEntry.routes.length > 0
    ) {
      console.log("Using cached routes");
      setRoutes(cacheEntry.routes);
      setSelectedRoute(cacheEntry.routes[0]);
      return;
    }

    setIsLoadingRoutes(true);
    routesLoadingRef.current = true;
    lastTokenPairRef.current = tokenPairKey;
    console.log("🔍 Finding routes between tokens...");

    const defaultAmount = "0.1"; // Use a small default amount if none provided
    const effectiveAmount =
      !amount0 || parseFloat(amount0) <= 0 ? defaultAmount : amount0;

    try {
      const discoveredRoutes: RouteInfo[] = [];

      // Step 1: Check direct route if pair exists
      if (pairExists && currentPairId) {
        console.log("Checking direct route");
        const isToken0In = matchTokenTypes(
          reserves.token0,
          token0.coinType || ""
        );

        const reserveIn = isToken0In ? reserves.reserve0 : reserves.reserve1;
        const reserveOut = isToken0In ? reserves.reserve1 : reserves.reserve0;

        const scaledAmountIn = scaleAmount(effectiveAmount, token0.decimals);
        const rawOutput = calculateAmountOut(
          scaledAmountIn.toString(),
          reserveIn,
          reserveOut
        );

        const scaledOutput = Number(rawOutput) / Math.pow(10, token1.decimals);
        const priceImpact = calculatePriceImpact(
          scaledAmountIn,
          BigInt(reserveIn),
          BigInt(reserveOut)
        );

        const directRoute: RouteInfo = {
          path: [token0.coinType || "", token1.coinType || ""],
          pathSymbols: [token0.symbol || "", token1.symbol || ""],
          pairs: [
            {
              pairId: currentPairId,
              reserves: {
                token0: reserves.token0,
                token1: reserves.token1,
                reserve0: reserves.reserve0,
                reserve1: reserves.reserve1,
              },
            },
          ],
          hops: 1,
          estimatedOutput: scaledOutput.toString(),
          priceImpact,
          type: "direct",
        };

        discoveredRoutes.push(directRoute);
      }

      // Step 2: Find multi-hop routes (efficiently)
      await fetchAllPairs(); // Ensure pairs are loaded

      // Find pairs with input token
      const pairsWithInput = findPairsWithToken(token0?.coinType);
      console.log(`Found ${pairsWithInput.length} pairs with input token`);

      // Refresh reserves for stale pairs
      await Promise.all(
        pairsWithInput
          .filter((pair) => now - pair.lastUpdated > PAIR_CACHE_TTL)
          .slice(0, 5) // Limit to 5 concurrent updates to avoid rate limiting
          .map((pair) => updatePairReserves(pair.pairId))
      );

      // Find pairs with output token
      const pairsWithOutput = findPairsWithToken(token1?.coinType);
      console.log(`Found ${pairsWithOutput.length} pairs with output token`);

      // Refresh reserves for stale pairs
      await Promise.all(
        pairsWithOutput
          .filter((pair) => now - pair.lastUpdated > PAIR_CACHE_TTL)
          .slice(0, 5) // Limit to 5 concurrent updates to avoid rate limiting
          .map((pair) => updatePairReserves(pair.pairId))
      );

      // For each pair with input token, find paths to output token
      for (const pairIn of pairsWithInput) {
        // Find the intermediate token in the first pair
        const isToken0Input = matchTokenTypes(
          pairIn.token0,
          token0.coinType || ""
        );
        const intermediateToken = isToken0Input ? pairIn.token1 : pairIn.token0;
        const intermediateSymbol = isToken0Input
          ? pairIn.token1Symbol
          : pairIn.token0Symbol;

        // Skip if intermediate token is the same as output token (direct path already handled)
        if (matchTokenTypes(intermediateToken, token1.coinType || "")) {
          continue;
        }

        // Find pairs that connect the intermediate token to the output token
        const connectedPairs = pairsWithOutput.filter(
          (pairOut) =>
            matchTokenTypes(pairOut.token0, intermediateToken) ||
            matchTokenTypes(pairOut.token1, intermediateToken)
        );

        for (const pairOut of connectedPairs) {
          try {
            // Calculate first hop: tokenIn -> intermediate
            const isToken0InFirst = matchTokenTypes(
              pairIn.token0,
              token0.coinType || ""
            );
            const reserveInFirst = isToken0InFirst
              ? pairIn.reserve0
              : pairIn.reserve1;
            const reserveOutFirst = isToken0InFirst
              ? pairIn.reserve1
              : pairIn.reserve0;

            // Calculate second hop: intermediate -> tokenOut
            const isIntermediateToken0InSecond = matchTokenTypes(
              pairOut.token0,
              intermediateToken
            );
            const reserveInSecond = isIntermediateToken0InSecond
              ? pairOut.reserve0
              : pairOut.reserve1;
            const reserveOutSecond = isIntermediateToken0InSecond
              ? pairOut.reserve1
              : pairOut.reserve0;

            // First hop calculation
            const scaledAmountIn = scaleAmount(
              effectiveAmount,
              token0.decimals
            );
            const firstHopOutput = calculateAmountOut(
              scaledAmountIn.toString(),
              reserveInFirst,
              reserveOutFirst
            );

            // Second hop calculation
            const secondHopOutput = calculateAmountOut(
              firstHopOutput,
              reserveInSecond,
              reserveOutSecond
            );

            // Calculate price impact
            const impact1 = calculatePriceImpact(
              scaledAmountIn,
              BigInt(reserveInFirst),
              BigInt(reserveOutFirst)
            );

            const impact2 = calculatePriceImpact(
              BigInt(firstHopOutput),
              BigInt(reserveInSecond),
              BigInt(reserveOutSecond)
            );

            const totalImpact = impact1 + impact2;

            // Scale output to display units
            const scaledOutput =
              Number(secondHopOutput) / Math.pow(10, token1.decimals);

            const multiHopRoute: RouteInfo = {
              path: [
                token0.coinType || "",
                intermediateToken,
                token1.coinType || "",
              ],
              pathSymbols: [
                token0.symbol || "",
                intermediateSymbol,
                token1.symbol || "",
              ],
              pairs: [
                {
                  pairId: pairIn.pairId,
                  reserves: {
                    token0: pairIn.token0,
                    token1: pairIn.token1,
                    reserve0: pairIn.reserve0,
                    reserve1: pairIn.reserve1,
                  },
                },
                {
                  pairId: pairOut.pairId,
                  reserves: {
                    token0: pairOut.token0,
                    token1: pairOut.token1,
                    reserve0: pairOut.reserve0,
                    reserve1: pairOut.reserve1,
                  },
                },
              ],
              hops: 2,
              estimatedOutput: scaledOutput.toString(),
              priceImpact: totalImpact,
              type: "multi",
            };

            discoveredRoutes.push(multiHopRoute);
          } catch (error) {
            // Skip this route if calculation fails
            console.warn("Failed to calculate multi-hop route:", error);
            continue;
          }
        }
      }

      // Prioritize routes - direct first, then by output amount
      const directRoutes = discoveredRoutes.filter(
        (route) => route.type === "direct"
      );

      const multiHopRoutes = discoveredRoutes.filter(
        (route) => route.type === "multi"
      );

      // Sort each category by output amount
      directRoutes.sort(
        (a, b) => parseFloat(b.estimatedOutput) - parseFloat(a.estimatedOutput)
      );

      multiHopRoutes.sort(
        (a, b) => parseFloat(b.estimatedOutput) - parseFloat(a.estimatedOutput)
      );

      // Combine routes with direct routes first, then best multi-hop routes (limit to top 3)
      const sortedRoutes = [...directRoutes, ...multiHopRoutes.slice(0, 3)];

      if (sortedRoutes.length > 0) {
        console.log(`Found ${sortedRoutes.length} viable routes`);

        // Update state
        setRoutes(sortedRoutes);
        routesRef.current = sortedRoutes;
        setSelectedRoute(sortedRoutes[0]); // Select best route
        setLastRouteUpdate(now);
        setLastAmountForRoute(effectiveAmount);

        // Update cache
        routeCacheRef.current.set(tokenPairKey, {
          routes: sortedRoutes,
          timestamp: now,
        });

        // Prune cache if it gets too large
        if (routeCacheRef.current.size > MAX_ROUTE_CACHE_ITEMS) {
          // Remove oldest entry
          const oldestKey = [...routeCacheRef.current.entries()].sort(
            (a, b) => a[1].timestamp - b[1].timestamp
          )[0][0];
          routeCacheRef.current.delete(oldestKey);
        }
      } else {
        console.log("No viable routes found");
        setRoutes([]);
        routesRef.current = [];
        setSelectedRoute(null);
      }
    } catch (error) {
      console.error("Error finding routes:", error);
    } finally {
      setIsLoadingRoutes(false);
      routesLoadingRef.current = false;
    }
  }, [
    token0,
    token1,
    amount0,
    pairExists,
    currentPairId,
    reserves,
    lastAmountForRoute,
    fetchAllPairs,
    findPairsWithToken,
    updatePairReserves,
  ]);

  // Initial route finding when tokens change
  useEffect(() => {
    if (token0 && token1) {
      // Clear previous routes first
      setRoutes([]);
      setSelectedRoute(null);

      // Clear any existing timeout
      if (findRoutesTimeoutRef.current) {
        clearTimeout(findRoutesTimeoutRef.current);
      }

      // Throttle route finding to avoid excessive calls
      findRoutesTimeoutRef.current = setTimeout(() => {
        findRoutes();
        findRoutesTimeoutRef.current = null;
      }, 300);

      return () => {
        if (findRoutesTimeoutRef.current) {
          clearTimeout(findRoutesTimeoutRef.current);
          findRoutesTimeoutRef.current = null;
        }
      };
    }
  }, [token0, token1, findRoutes]);

  // Update routes when amount changes significantly
  useEffect(() => {
    if (token0 && token1 && amount0 && parseFloat(amount0) > 0) {
      const prevAmount = parseFloat(lastAmountForRoute || "0");
      const currentAmount = parseFloat(amount0);

      // Only update if amount changes by more than 5%
      if (
        Math.abs(currentAmount - prevAmount) / Math.max(prevAmount, 0.0001) >
        0.05
      ) {
        // Clear any existing timeout
        if (findRoutesTimeoutRef.current) {
          clearTimeout(findRoutesTimeoutRef.current);
        }

        // Throttle to avoid excessive updates
        findRoutesTimeoutRef.current = setTimeout(() => {
          findRoutes();
          findRoutesTimeoutRef.current = null;
        }, 500);

        return () => {
          if (findRoutesTimeoutRef.current) {
            clearTimeout(findRoutesTimeoutRef.current);
            findRoutesTimeoutRef.current = null;
          }
        };
      }
    }
  }, [amount0, findRoutes, lastAmountForRoute]);

  return {
    routes,
    selectedRoute,
    setSelectedRoute,
    isLoadingRoutes,
    findRoutes,
  };
}
