/**
 * Custom hook for managing pair information
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Token, getBaseType } from "../utils/tokenUtils";
import { PairReserves, PairInfo, LPEvent } from "../utils/pairUtils";
import { CONSTANTS } from "../constants/addresses";
import { suiClient } from "../utils/suiClient";
import { debounce } from "lodash";

// Initial reserves state
const initialReserves: PairReserves = {
  reserve0: "0",
  reserve1: "0",
  timestamp: 0,
};

export function usePair(token0: Token | null, token1: Token | null) {
  const [pairExists, setPairExists] = useState(false);
  const [currentPairId, setCurrentPairId] = useState<string | null>(null);
  const [reserves, setReserves] = useState<PairReserves>(initialReserves);
  const [events, setEvents] = useState<LPEvent[]>([]);
  const [isRefreshingPair, setIsRefreshingPair] = useState(false);
  const [loadingPair, setLoadingPair] = useState<boolean>(true); // Track loading state
  const { account, signAndExecuteTransactionBlock } = useWallet();

  // Add a ref to cache events by pairId - this persists across renders
  const eventsCache = useRef<Record<string, LPEvent[]>>({});

  // Track if component is mounted
  const isMounted = useRef(true);

  // Set up cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Reset pair state helper
  const resetPairState = useCallback(() => {
    setPairExists(false);
    setCurrentPairId("");
    setReserves(initialReserves);
  }, []);

  // Check if pair exists and fetch pair data
  const checkPairExistence = useCallback(
    debounce(async () => {
      if (!token0 || !token1 || !account?.address) {
        resetPairState();
        return;
      }

      setIsRefreshingPair(true);
      setLoadingPair(true); // Start loading

      try {
        const token0Id = token0.id;
        const token1Id = token1.id;

        const [token0Obj, token1Obj] = await Promise.all([
          suiClient.getObject({ id: token0Id, options: { showType: true } }),
          suiClient.getObject({ id: token1Id, options: { showType: true } }),
        ]);

        const baseType0 = token0Obj.data?.type
          ? getBaseType(token0Obj.data.type)
          : "";
        const baseType1 = token1Obj.data?.type
          ? getBaseType(token1Obj.data.type)
          : "";

        if (!baseType0 || !baseType1) {
          resetPairState();
          return;
        }

        const tx = new TransactionBlock();

        console.log("the hash is", tx);
        tx.moveCall({
          target: `${CONSTANTS.PACKAGE_ID}::factory::get_pair`,
          typeArguments: [baseType0, baseType1],
          arguments: [tx.object(CONSTANTS.FACTORY_ID)],
        });

        const response = await suiClient.devInspectTransactionBlock({
          transactionBlock: tx as any,
          sender: account.address,
        });

        if (response?.results?.[0]?.returnValues) {
          const optionValue = response.results[0].returnValues[0];
          if (Array.isArray(optionValue) && optionValue.length > 0) {
            const addressBytes = optionValue[0];
            if (Array.isArray(addressBytes) && addressBytes.length > 1) {
              const hexString = addressBytes
                .slice(1)
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
              const pairId = `0x${hexString}`;

              const pairObject = await suiClient.getObject({
                id: pairId,
                options: {
                  showContent: true,
                  showType: true,
                },
              });

              if (
                pairObject.data?.content &&
                "fields" in pairObject.data.content &&
                typeof pairObject.data.content.fields === "object" &&
                pairObject.data.content.fields &&
                "reserve0" in pairObject.data.content.fields &&
                "reserve1" in pairObject.data.content.fields &&
                "block_timestamp_last" in pairObject.data.content.fields
              ) {
                const fields = pairObject.data.content.fields;

                const isToken0Base = baseType0 < baseType1;
                setReserves({
                  reserve0: isToken0Base
                    ? String(fields.reserve0)
                    : String(fields.reserve1),
                  reserve1: isToken0Base
                    ? String(fields.reserve1)
                    : String(fields.reserve0),
                  timestamp: Number(fields.block_timestamp_last) || 0,
                });
              }
              setPairExists(true);
              setCurrentPairId(pairId);
              // Fetch events for this pair
              fetchPairEvents(pairId);

              // Try to restore events from localStorage for immediate rendering
              try {
                const cachedEvents = localStorage.getItem(
                  `lp_events_${pairId}`
                );
                if (cachedEvents) {
                  const parsedEvents = JSON.parse(cachedEvents) as LPEvent[];

                  // Only use cached events if we have some and component is still mounted
                  if (parsedEvents.length > 0 && isMounted.current) {
                    // Update cache ref and state
                    eventsCache.current[pairId] = parsedEvents;
                    setEvents(parsedEvents);
                  }
                }
              } catch (error) {
                console.warn(
                  "Failed to restore events from localStorage:",
                  error
                );
              }
            } else {
              resetPairState();
            }
          } else {
            resetPairState();
          }
        } else {
          resetPairState();
        }
      } catch (error) {
        console.error("Error during pair check:", error);
        resetPairState();
        setPairExists(false);
      } finally {
        if (isMounted.current) {
          setIsRefreshingPair(false);
          setLoadingPair(false); // Stop loading
        }
      }
    }, 300),
    [token0, token1, account?.address, suiClient, resetPairState]
  );

  // Fetch events for a pair with enhanced caching
  const fetchPairEvents = useCallback(
    async (pairId: string) => {
      if (!account?.address || !pairId) return;

      try {
        console.log("Fetching LP events for pair:", pairId);

        // Use cache if we have events for this pair while fetching
        if (
          eventsCache.current[pairId] &&
          eventsCache.current[pairId].length > 0
        ) {
          if (isMounted.current) {
            setEvents(eventsCache.current[pairId]);
          }
        }

        // First try to get events by event type
        const recentTxs = await suiClient.queryEvents({
          query: {
            MoveEventType: `${CONSTANTS.PACKAGE_ID}::pair::LPMint`,
          },
          order: "descending",
          limit: 50,
        });

        let eventsData = recentTxs.data;

        // Filter events by pair ID in the application code
        // Since we can't use MoveEventField directly in the query
        const filteredEvents = eventsData.filter((event) => {
          try {
            const parsed = event.parsedJson as any;
            return !parsed.pairId || parsed.pairId === pairId;
          } catch {
            return true; // Include events where we can't determine the pair ID
          }
        });

        eventsData = filteredEvents.length > 0 ? filteredEvents : eventsData;

        const processedEvents: LPEvent[] = [];

        for (const event of eventsData) {
          try {
            const parsed = event.parsedJson as any;

            // Skip events that don't match our pair
            if (parsed.pairId && parsed.pairId !== pairId) {
              continue;
            }

            // Extract token type names correctly
            const extractTypeName = (tokenType: any) => {
              if (!tokenType) return "N/A";
              if (typeof tokenType === "string") {
                return tokenType.includes("::")
                  ? tokenType.split("::").pop() || "N/A"
                  : tokenType;
              }
              if (typeof tokenType === "object" && "name" in tokenType) {
                return tokenType.name.includes("::")
                  ? tokenType.name.split("::").pop() || "N/A"
                  : tokenType.name;
              }
              return "N/A";
            };

            // Assign correctly formatted token types
            const token0TypeName = extractTypeName(
              parsed.token0_type || parsed.token0Type
            );
            const token1TypeName = extractTypeName(
              parsed.token1_type || parsed.token1Type
            );

            const lpCoinId = parsed.lp_coin_id || parsed.lpCoinId || "";
            const amount0 = parsed.amount0 || "0";
            const amount1 = parsed.amount1 || "0";
            const totalSupply =
              parsed.total_supply || parsed.totalSupply || "0";
            const timestamp = event.timestampMs
              ? Number(event.timestampMs)
              : Date.now();

            // Create event object with only properties defined in LPEvent interface
            const newEvent: LPEvent = {
              type: event.type,
              sender: parsed.sender || "",
              lpCoinId: lpCoinId,
              token0Type: { name: token0TypeName },
              token1Type: { name: token1TypeName },
              amount0: amount0,
              amount1: amount1,
              liquidity: parsed.liquidity || "0",
              totalSupply: totalSupply,
              timestamp: timestamp,
              // transactionHash: event.id.txDigest, // Assuming transactionHash is in LPEvent
            };

            processedEvents.push(newEvent);
          } catch (err) {
            console.error("Error processing event:", err, event);
          }
        }

        const validEvents = processedEvents.filter(
          (event) => event.amount0 !== "0" && event.liquidity !== "0"
        );

        console.log(`Processed ${validEvents.length} LP events`);

        // Only update state if we have events and component is still mounted
        if (validEvents.length > 0 && isMounted.current) {
          // Store in cache
          eventsCache.current[pairId] = validEvents;

          // Update state
          setEvents(validEvents);

          // Store in localStorage for persistence
          try {
            localStorage.setItem(
              `lp_events_${pairId}`,
              JSON.stringify(validEvents)
            );
          } catch (error) {
            console.warn("Failed to save events to localStorage:", error);
          }
        } else if (
          validEvents.length === 0 &&
          eventsCache.current[pairId] &&
          isMounted.current
        ) {
          // If we didn't find any events, but have cache, keep using it
          setEvents(eventsCache.current[pairId]);
        }
      } catch (error) {
        console.error("Error fetching LP events:", error);

        // Try to use cached events if available
        if (pairId && eventsCache.current[pairId] && isMounted.current) {
          setEvents(eventsCache.current[pairId]);
        }

        // Try to restore from localStorage as a last resort
        try {
          const cachedEvents = localStorage.getItem(`lp_events_${pairId}`);
          if (cachedEvents && isMounted.current) {
            const parsedEvents = JSON.parse(cachedEvents) as LPEvent[];
            setEvents(parsedEvents);
          }
        } catch (storageError) {
          console.warn(
            "Failed to restore events from localStorage:",
            storageError
          );
        }
      }
    },
    [account?.address, suiClient]
  );

  // Process LP events after transaction with improved event handling
  const processLPEvent = useCallback(
    async (txDigest: string) => {
      try {
        console.log("Processing LP events for transaction:", txDigest);

        const txData = await suiClient.getTransactionBlock({
          digest: txDigest,
          options: {
            showEvents: true,
            showEffects: true,
          },
        });

        if (!txData.events || txData.events.length === 0) {
          console.log("No events found in transaction");

          // If no events found, manually fetch all LP events again
          if (currentPairId) {
            await fetchPairEvents(currentPairId);
          }
          return [];
        }

        // Extract LP events from the transaction
        const lpEvents: LPEvent[] = txData.events
          .filter((event) => event.type.includes("::pair::LP"))
          .map((event) => {
            try {
              const parsed = event.parsedJson as any;

              // Extract LP Coin ID (fallbacks added for different structures)
              const lpCoinId = parsed.lp_coin_id || parsed.lpCoinId || "";

              // Handle token types which might be strings or objects
              const token0TypeName =
                typeof parsed.token0_type === "string"
                  ? parsed.token0_type
                  : parsed.token0_type?.name ||
                    parsed.token0Type?.name ||
                    token0?.coinType ||
                    "Unknown Token";

              const token1TypeName =
                typeof parsed.token1_type === "string"
                  ? parsed.token1_type
                  : parsed.token1_type?.name ||
                    parsed.token1Type?.name ||
                    token1?.coinType ||
                    "Unknown Token";

              // Ensure timestamp is a number or use current time
              const timestamp = event.timestampMs
                ? Number(event.timestampMs)
                : Date.now();

              // Create event object with only properties defined in LPEvent interface
              return {
                type: event.type,
                sender: parsed.sender || account?.address || "",
                lpCoinId,
                token0Type: { name: token0TypeName },
                token1Type: { name: token1TypeName },
                amount0: parsed.amount0 || "0",
                amount1: parsed.amount1 || "0",
                liquidity: parsed.liquidity || "0",
                totalSupply: parsed.total_supply || parsed.totalSupply || "0",
                timestamp,
                transactionHash: txDigest, // Assuming transactionHash is in LPEvent
              };
            } catch (err) {
              console.error("Error processing LP event:", err, event);
              return null;
            }
          })
          .filter((event) => event !== null) as LPEvent[]; // Filter out null values

        if (lpEvents.length > 0 && isMounted.current) {
          // Add the new events to the beginning of the existing events
          const newEvents = [...lpEvents, ...(events || [])];

          // Update state
          setEvents(newEvents);

          // Cache the updated events for the current pair
          if (currentPairId) {
            eventsCache.current[currentPairId] = newEvents;

            // Also update localStorage
            try {
              localStorage.setItem(
                `lp_events_${currentPairId}`,
                JSON.stringify(newEvents)
              );
            } catch (error) {
              console.warn(
                "Failed to save updated events to localStorage:",
                error
              );
            }
          }
        } else {
          // If no LP events found in this transaction, refresh the events list
          if (currentPairId) {
            await fetchPairEvents(currentPairId);
          }
        }

        // Store events in the backend
        try {
          const response = await fetch(
            "https://dexback-mu.vercel.app/api/lpcoin",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(lpEvents),
            }
          );

          if (!response.ok) {
            throw new Error("Failed to store LP events");
          }
          console.log("✅ Successfully stored LP events in database");

          // After successful backend storage, try to store in the positions endpoint too
          if (lpEvents.length > 0 && currentPairId) {
            // Store position information if available
            try {
              // Map LP events to position data format
              const positionData = lpEvents.map((event) => ({
                id: event.lpCoinId,
                owner: event.sender,
                pairId: currentPairId,
                token0: {
                  name: getTokenName(token0?.name || ""),
                  amount: event.amount0,
                  decimals: token0?.decimals || 9,
                },
                token1: {
                  name: getTokenName(token1?.name || ""),
                  amount: event.amount1,
                  decimals: token1?.decimals || 9,
                },
                liquidity: event.liquidity,
                createdAt: new Date().toISOString(),
                // transactionHash: event.transactionHash,
              }));

              // Only store if we have valid position data
              if (positionData.length > 0) {
                const positionResponse = await fetch(
                  "https://dexback-mu.vercel.app/api/positions/save",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(positionData[0]), // Send first position
                  }
                );

                if (!positionResponse.ok) {
                  console.warn("Failed to store position data in backend");
                } else {
                  console.log(
                    "✅ Successfully stored position data in database"
                  );
                }
              }
            } catch (positionError) {
              console.warn("Error storing position data:", positionError);
            }
          }
        } catch (error) {
          console.error("❌ Error storing LP events:", error);
        }

        return lpEvents;
      } catch (error) {
        console.error("❌ Error processing LP events:", error);

        // Even if there's an error, try to refresh events
        if (currentPairId) {
          await fetchPairEvents(currentPairId);
        }

        return [];
      }
    },
    [
      currentPairId,
      events,
      fetchPairEvents,
      suiClient,
      token0,
      token1,
      account?.address,
    ]
  );

  // Helper function to get token name
  const getTokenName = (fullName: string): string => {
    if (!fullName) return "N/A";
    return fullName.includes("::")
      ? fullName.split("::").pop() || fullName
      : fullName;
  };

  // Add this function to your usePair hook:
  const refreshReserves = useCallback(async () => {
    if (!currentPairId || !token0 || !token1) return;

    try {
      setIsRefreshingPair(true);

      const pairObject = await suiClient.getObject({
        id: currentPairId,
        options: {
          showContent: true,
          showType: true,
        },
      });

      if (
        pairObject.data?.content &&
        "fields" in pairObject.data.content &&
        typeof pairObject.data.content.fields === "object" &&
        pairObject.data.content.fields &&
        "reserve0" in pairObject.data.content.fields &&
        "reserve1" in pairObject.data.content.fields &&
        "block_timestamp_last" in pairObject.data.content.fields
      ) {
        const fields = pairObject.data.content.fields;

        // Get base types to ensure correct ordering
        const token0Obj = await suiClient.getObject({
          id: token0.id,
          options: { showType: true },
        });

        const token1Obj = await suiClient.getObject({
          id: token1.id,
          options: { showType: true },
        });

        const baseType0 = token0Obj.data?.type
          ? getBaseType(token0Obj.data.type)
          : "";
        const baseType1 = token1Obj.data?.type
          ? getBaseType(token1Obj.data.type)
          : "";

        if (!baseType0 || !baseType1) {
          console.error("Could not determine token base types");
          return;
        }

        // Check if tokens are in the correct order in the pair
        const isToken0Base = baseType0 < baseType1;

        if (isMounted.current) {
          setReserves({
            reserve0: isToken0Base
              ? String(fields.reserve0)
              : String(fields.reserve1),
            reserve1: isToken0Base
              ? String(fields.reserve1)
              : String(fields.reserve0),
            timestamp: Number(fields.block_timestamp_last) || 0,
          });
        }

        console.log("Reserves refreshed successfully:", {
          reserve0: isToken0Base
            ? String(fields.reserve0)
            : String(fields.reserve1),
          reserve1: isToken0Base
            ? String(fields.reserve1)
            : String(fields.reserve0),
          timestamp: Number(fields.block_timestamp_last) || 0,
        });
      }
    } catch (error) {
      console.error("Error refreshing reserves:", error);
    } finally {
      if (isMounted.current) {
        setIsRefreshingPair(false);
      }
    }
  }, [currentPairId, token0, token1, suiClient]);

  // Update pair data when tokens change
  useEffect(() => {
    if (token0 && token1) {
      checkPairExistence();
    } else {
      resetPairState();
    }
  }, [token0, token1, checkPairExistence, resetPairState]);

  // Refresh events periodically to ensure they don't disappear
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    // Only set up interval if we have a pair
    if (currentPairId) {
      // Do an initial refresh
      fetchPairEvents(currentPairId);

      // Set up polling with jitter to prevent network spikes
      const jitter = Math.floor(Math.random() * 5000); // 0-5s random delay
      intervalId = setInterval(() => {
        if (isMounted.current && currentPairId) {
          fetchPairEvents(currentPairId);
        }
      }, 30000 + jitter); // 30-35s interval with jitter
    }

    // Clean up interval on unmount or when pair changes
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentPairId, fetchPairEvents]);

  return {
    loadingPair,
    pairExists,
    currentPairId,
    reserves,
    events,
    isRefreshingPair,
    checkPairExistence,
    refreshReserves,
    fetchPairEvents,
    processLPEvent,
    resetPairState,
  };
}
