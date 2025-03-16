/**
 * Custom hook for managing pair information
 */
import { useState, useEffect, useCallback } from "react";
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
  const [loadingPair, setLoadingPair] = useState<boolean>(true); // Track loading state// NEW: Track loading
  const { account, signAndExecuteTransactionBlock } = useWallet();

  

  // Reset pair state helper
  const resetPairState = useCallback(() => {
   
    setPairExists(false);
    setCurrentPairId("");
    setReserves(initialReserves);
  }, []);

  // Check if pair exists and fetch pair data
  const checkPairExistence = useCallback(
    debounce( async () => {
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

      console.log("the hash is",tx);
      tx.moveCall({
        target: `${CONSTANTS.PACKAGE_ID}::factory::get_pair`,
        typeArguments: [baseType0, baseType1],
        arguments: [tx.object(CONSTANTS.FACTORY_ID)],
      });

      const response = await suiClient.devInspectTransactionBlock({
        transactionBlock: tx,
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
      setIsRefreshingPair(false);
      setLoadingPair(false); // Stop loading
    }
  }, 300), [token0, token1, account?.address, suiClient, resetPairState]);

  // Fetch events for a pair
  const fetchPairEvents = useCallback(async (pairId: string) => {
    if (!account?.address || !pairId) return;
  
    try {
      console.log("Fetching LP events for pair:", pairId);
  
      // Get events for this pair
      const recentTxs = await suiClient.queryEvents({
        query: { MoveEventType: `${CONSTANTS.PACKAGE_ID}::pair::LPMint` },
        order: "descending",
        limit: 20,
      });
  
      const processedEvents: LPEvent[] = [];
  
      for (const event of recentTxs.data) {
        try {
          const parsed = event.parsedJson as any;
  
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
          const token0TypeName = extractTypeName(parsed.token0_type || parsed.token0Type);
          const token1TypeName = extractTypeName(parsed.token1_type || parsed.token1Type);
  
          const lpCoinId = parsed.lp_coin_id || parsed.lpCoinId || "";
          const amount0 = parsed.amount0 || "0";
          const amount1 = parsed.amount1 || "0";
          const totalSupply = parsed.total_supply || parsed.totalSupply || "0";
          const timestamp = event.timestampMs ? Number(event.timestampMs) : undefined;
  
          processedEvents.push({
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
          });
        } catch (err) {
          console.error("Error processing event:", err, event);
        }
      }
  
      const validEvents = processedEvents.filter(event => event.amount0 !== "0" && event.liquidity !== "0");
      console.log("Processed LP events:", validEvents);
      setEvents(validEvents);
    } catch (error) {
      console.error("Error fetching LP events:", error);
    }
  }, [account?.address, suiClient]);
  

  // Process LP events after transaction
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
                  : parsed.token0_type?.name || "Unknown Token";
  
              const token1TypeName =
                typeof parsed.token1_type === "string"
                  ? parsed.token1_type
                  : parsed.token1_type?.name || "Unknown Token";
  
              // Ensure timestamp is a number or undefined
              const timestamp = event.timestampMs
                ? Number(event.timestampMs)
                : undefined;
  
              return {
                type: event.type,
                sender: parsed.sender || "",
                lpCoinId,
                token0Type: { name: token0TypeName },
                token1Type: { name: token1TypeName },
                amount0: parsed.amount0 || "0",
                amount1: parsed.amount1 || "0",
                liquidity: parsed.liquidity || "0",
                totalSupply: parsed.total_supply || parsed.totalSupply || "0",
                pairId: currentPairId,
                packageId: parsed.packageId || CONSTANTS.PACKAGE_ID,
                timestamp,
                transactionHash: txDigest, // Add transaction hash
              };
            } catch (err) {
              console.error("Error processing LP event:", err, event);
              return null;
            }
          })
          .filter((event) => event !== null) as LPEvent[]; // Filter out null values
  
        if (lpEvents.length > 0) {
          setEvents((prev) => [...lpEvents, ...prev]);
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
    [currentPairId, fetchPairEvents, suiClient]
  );
  

  // Update pair data when tokens change
  useEffect(() => {
    if (token0 && token1) {
      checkPairExistence();
    } else {
      resetPairState();
    }
  }, [token0, token1, checkPairExistence, resetPairState]);

  return {
    loadingPair, 
    pairExists,
    currentPairId,
    reserves,
    events,
    isRefreshingPair,
    checkPairExistence,
    fetchPairEvents,
    processLPEvent,
    resetPairState,
    
  };
}
