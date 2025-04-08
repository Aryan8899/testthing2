// @ts-nocheck

"use client";
import React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useWallet } from "@suiet/wallet-kit";

import { motion, AnimatePresence } from "framer-motion";
import {
  PlusIcon,
  BarChart3,
  Binary,
  RefreshCcw,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import toast, { StyledToastContainer } from "../utils/CustomToast";

// Import shared components
import TokenSelector from "../components/common/TokenSelector";
import InfoCard from "../components/common/InfoCard";
import NetworkStatusBar from "../components/NetworkStatus";

// Import shared hooks
import { usePair } from "../hooks/usePair";
import { useTokenAmounts } from "../hooks/useTokenAmounts";
import { useTokenBalances } from "../hooks/useTokenBalance";

// Import advanced client instead of regular suiClient
import { advancedSuiClient } from "../utils/advancedSuiClient";

// Import shared utilities
import {
  Token,
  getAllTokens,
  findTokenById,
  getCoinType,
  getCoinMetadata,
  DEFAULT_TOKEN_IMAGE,
  normalizeToken,
  getTokenObjectId,
  normalizeCoinType,
  extractTokenTypesFromLP,
} from "../utils/tokenUtils";
import { formatLargeNumber } from "../utils/formatUtils";
import { LPEvent, getTokenTypeName } from "../utils/pairUtils";
import {
  createPairTransaction,
  createAddLiquidityTransaction,
  simulateTransaction,
} from "../utils/transactionUtils";

const LiquidityPage = () => {
  // Get search params from URL
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // State management
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [hasRetried, setHasRetried] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [isUpdatingBackend, setIsUpdatingBackend] = useState(false);

  // New state to control when events are re-rendered
  const [renderedEvents, setRenderedEvents] = useState<LPEvent[]>([]);

  // Ref to track component mount state
  const isMounted = useRef(true);

  // Hooks
  const { account } = useWallet();
  const { signAndExecuteTransaction } = useWallet();

  // Get pair information
  const {
    pairExists,
    currentPairId,
    reserves,
    events,
    isRefreshingPair,
    checkPairExistence,
    fetchPairEvents,
    processLPEvent,
    refreshReserves,
  } = usePair(token0, token1);

  // Get token amounts and related calculations
  const {
    amount0,
    amount1,
    priceRate0,
    priceRate1,
    suggestedAmount1,
    setAmount0,
    setAmount1,
    resetAmounts,
  } = useTokenAmounts(token0, token1, reserves, pairExists, "liquidity");

  // Get token balances
  const {
    balance0,
    balance1,
    fetchBalances,
    error: balanceError,
  } = useTokenBalances(token0, token1);

  // Update mount status on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Enhanced fetchTokenData function
  const fetchTokenData = useCallback(
    async (tokenId: string): Promise<Token | null> => {
      if (!tokenId) return null;

      try {
        console.log(
          `[LiquidityPage] Fetching data for token ID/type: ${tokenId}`
        );

        // Check if it's a type string (contains ::)
        const isTypeString = tokenId.includes("::");

        // First try to find the token in our predefined list
        const token = findTokenById(tokenId);
        if (token) {
          console.log(`[LiquidityPage] Token ${tokenId} found in local list`);
          return normalizeToken(token);
        }

        setLoadingTokens(true);

        // If it's a type string, try to get an object ID for it
        if (isTypeString && account?.address) {
          console.log(`[LiquidityPage] Handling as coin type: ${tokenId}`);

          // Normalize coin type
          const normalizedType = normalizeCoinType(tokenId);

          try {
            // Try to get metadata directly
            const metadata = await getCoinMetadata(normalizedType);

            // Try to get an object ID for this type
            const objectId = await getTokenObjectId(
              normalizedType,
              advancedSuiClient,
              account.address
            );

            if (metadata || objectId) {
              const constructedToken: Token = {
                id: objectId || tokenId, // Use object ID if found, otherwise fallback to type
                name:
                  metadata?.name ||
                  normalizedType.split("::").pop() ||
                  "Unknown",
                symbol:
                  metadata?.symbol ||
                  normalizedType.split("::").pop() ||
                  "UNKNOWN",
                decimals: metadata?.decimals || 9,
                coinType: normalizedType,
                metadata: {
                  name:
                    metadata?.name ||
                    normalizedType.split("::").pop() ||
                    "Unknown",
                  symbol:
                    metadata?.symbol ||
                    normalizedType.split("::").pop() ||
                    "UNKNOWN",
                  decimals: metadata?.decimals || 9,
                  image: metadata?.image || DEFAULT_TOKEN_IMAGE,
                },
              };

              console.log(
                `[LiquidityPage] Successfully created token from type:`,
                constructedToken
              );
              return normalizeToken(constructedToken);
            }
          } catch (error) {
            console.warn(`[LiquidityPage] Error handling coin type: ${error}`);
            // Continue to try as object ID
          }
        }

        // Handle as object ID - get the object data
        try {
          console.log(`[LiquidityPage] Handling as object ID: ${tokenId}`);
          const objectData = await advancedSuiClient.getObject({
            id: tokenId,
            options: { showType: true, showContent: true, showDisplay: true },
          });

          if (!objectData?.data) {
            console.error(
              `[LiquidityPage] Failed to fetch token data for ${tokenId}`
            );
            return null;
          }

          // Extract information from the object
          const objectType = objectData.data.type || "";
          const display = objectData.data.display?.data || {};

          // Try to get coin type from the object
          let coinType = null;
          const typeMatch = objectType.match(/Coin<([^>]+)>/);
          if (typeMatch) {
            coinType = typeMatch[1];
          } else {
            coinType = await getCoinType(tokenId);
          }

          // Try to get metadata if we have a coin type
          let metadata = null;
          if (coinType) {
            metadata = await getCoinMetadata(coinType);
          }

          // Make sure we have an image URL - check multiple sources
          const imageUrl =
            metadata?.image ||
            metadata?.iconUrl ||
            display.image_url ||
            display.image ||
            display.icon_url ||
            DEFAULT_TOKEN_IMAGE;

          // Construct a token object with guaranteed image
          const constructedToken: Token = {
            id: tokenId,
            name:
              metadata?.name ||
              display.name ||
              objectType.split("::").pop() ||
              "Unknown Token",
            symbol:
              metadata?.symbol ||
              display.symbol ||
              objectType.split("::").pop() ||
              "UNKNOWN",
            decimals: metadata?.decimals || 9,
            coinType: coinType || objectType,
            metadata: {
              name: metadata?.name || display.name || "Unknown Token",
              symbol: metadata?.symbol || display.symbol || "UNKNOWN",
              decimals: metadata?.decimals || 9,
              image: imageUrl, // Ensure image is always set
            },
          };

          console.log(
            `[LiquidityPage] Constructed token from object:`,
            constructedToken
          );
          return normalizeToken(constructedToken);
        } catch (error) {
          console.error(`[LiquidityPage] Error fetching object data:`, error);
          return null;
        }
      } catch (error) {
        console.error(`[LiquidityPage] Error in fetchTokenData:`, error);
        return null;
      } finally {
        if (isMounted.current) {
          setLoadingTokens(false);
        }
      }
    },
    [account?.address]
  );

  // Updated useEffect for handling URL parameters
  useEffect(() => {
    const handleUrlTokenParams = async () => {
      const token0Id = searchParams.get("token0");
      const token1Id = searchParams.get("token1");

      if (!token0Id && !token1Id) return;

      console.log("[LiquidityPage] URL parameters received:", {
        token0Id,
        token1Id,
      });

      // Set loading state
      setLoadingTokens(true);

      try {
        let token0Data = null;
        let token1Data = null;

        // Process token0 if provided
        if (token0Id) {
          console.log(`[LiquidityPage] Fetching token0 data for: ${token0Id}`);
          token0Data = await fetchTokenData(token0Id);
          if (token0Data) {
            console.log("[LiquidityPage] Setting token0:", token0Data);
            setToken0(token0Data);
          } else {
            console.warn(
              `[LiquidityPage] Could not find or fetch token0: ${token0Id}`
            );
          }
        }

        // Process token1 if provided
        if (token1Id) {
          console.log(`[LiquidityPage] Fetching token1 data for: ${token1Id}`);
          token1Data = await fetchTokenData(token1Id);
          if (token1Data) {
            console.log("[LiquidityPage] Setting token1:", token1Data);
            setToken1(token1Data);
          } else {
            console.warn(
              `[LiquidityPage] Could not find or fetch token1: ${token1Id}`
            );
          }
        }

        // If both tokens were successfully set, check pair existence
        if (token0Data && token1Data) {
          console.log(
            "[LiquidityPage] Both tokens set from URL, checking pair existence"
          );
          setTimeout(() => {
            if (isMounted.current) {
              checkPairExistence();
            }
          }, 500);
        }
      } catch (error) {
        console.error("[LiquidityPage] Error handling URL parameters:", error);
      } finally {
        if (isMounted.current) {
          setLoadingTokens(false);
        }
      }
    };

    // Execute the handler when the component mounts or URL changes
    handleUrlTokenParams();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Update token selection handlers to use normalizeToken:

  const handleToken0Change = useCallback(
    (newToken: Token | null) => {
      if (!newToken || newToken.id === token0?.id) return;

      setToken0(normalizeToken(newToken));
      resetAmounts();

      // Only proceed when both tokens are selected
      if (token1) {
        checkPairExistence();
      }
    },
    [token0, token1, resetAmounts, checkPairExistence]
  );

  const handleToken1Change = useCallback(
    (newToken: Token | null) => {
      if (!newToken || newToken.id === token1?.id) return;

      setToken1(normalizeToken(newToken));
      resetAmounts();

      // Only proceed when both tokens are selected
      if (token0) {
        checkPairExistence();
      }
    },
    [token0, token1, resetAmounts, checkPairExistence]
  );

  // Ensures tokens are properly loaded by retrying the existence check
  const ensureTokensLoaded = useCallback(() => {
    if (token0 && token1 && !pairExists && !isRefreshingPair) {
      console.log("Ensuring tokens are loaded and pair is checked...");
      // Small delay to ensure state is updated
      setTimeout(() => {
        if (isMounted.current) {
          checkPairExistence();
        }
      }, 300);
    }
  }, [token0, token1, pairExists, isRefreshingPair, checkPairExistence]);

  // Add effect to periodically check if tokens are loaded
  useEffect(() => {
    if (loadingTokens || !token0 || !token1) return;

    // One-time check after loading is complete
    const timer = setTimeout(() => {
      ensureTokensLoaded();
    }, 500);

    return () => clearTimeout(timer);
  }, [loadingTokens, token0, token1, ensureTokensLoaded]);

  // Handle network errors from balance fetching
  useEffect(() => {
    if (balanceError) {
      // Only show if the error is network-related
      if (
        balanceError.includes("INSUFFICIENT_RESOURCES") ||
        balanceError.includes("Failed to fetch") ||
        balanceError.includes("Network")
      ) {
        setNetworkError(balanceError);
      }
    } else {
      setNetworkError(null);
    }
  }, [balanceError]);

  /**
   * Waits for transaction to be finalized on chain before proceeding
   * This helps ensure that pool data queries return the latest state
   */
  const waitForTransactionFinality = async (
    txDigest: string,
    maxAttempts = 10
  ): Promise<boolean> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Check transaction status
        const txStatus = await advancedSuiClient.getTransactionBlock({
          digest: txDigest,
          options: {
            showEffects: true,
          },
        });

        if (txStatus.effects?.status?.status === "success") {
          console.log(
            `Transaction ${txDigest.slice(0, 8)}... confirmed after ${
              attempts + 1
            } attempts`
          );
          return true;
        }

        // If still processing, wait with exponential backoff
        attempts++;
        const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000);
        console.log(
          `Waiting ${
            delay / 1000
          }s for transaction finality (attempt ${attempts}/${maxAttempts})...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        console.warn(
          `Error checking transaction status (attempt ${
            attempts + 1
          }/${maxAttempts}):`,
          error
        );
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.warn(
      `Transaction finality check timed out after ${maxAttempts} attempts`
    );
    return false;
  };

  /**
   * New function to save liquidity event to backend
   */
  const saveEventToBackend = async (eventData: any, txDigest: string) => {
    if (!account?.address || !token0 || !token1 || !currentPairId) {
      console.warn("Missing required data for backend update");
      return false;
    }

    setIsUpdatingBackend(true);

    try {
      // Get transaction details if not provided
      let txDetails = eventData;

      if (!txDetails) {
        const txData = await advancedSuiClient.getTransactionBlock({
          digest: txDigest,
          options: {
            showEvents: true,
            showEffects: true,
          },
        });

        // Extract relevant LP event from transaction
        const lpEvent = txData.events?.find(
          (event) =>
            event.type.includes("::dex::LiquidityEvent") ||
            event.type.includes("::liquidity::") ||
            event.type.includes("::pool::")
        );

        if (!lpEvent) {
          console.warn("No LP event found in transaction");
          return false;
        }

        txDetails = lpEvent.parsedJson || {};
      }

      // Prepare data to send to backend
      const eventToSave = {
        sender: account.address,
        lpCoinId: txDetails.lpCoinId || "",
        pairId: currentPairId,
        transactionHash: txDigest,
        token0Type: { name: token0.coinType || token0.name },
        token1Type: { name: token1.coinType || token1.name },
        amount0: amount0 || txDetails.amount0 || "0",
        amount1: amount1 || txDetails.amount1 || "0",
        liquidity: txDetails.liquidity || "0",
        totalSupply: txDetails.totalSupply || "0",
        timestamp: new Date().toISOString(),
        type: txDetails.type || "AddLiquidity",
      };

      // Call backend API
      const response = await fetch(
        "https://dexback-mu.vercel.app/api/lpcoin/save",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventToSave),
        }
      );

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      console.log("Successfully saved liquidity event to backend");
      return true;
    } catch (error) {
      console.error("Failed to save event to backend:", error);
      return false;
    } finally {
      setIsUpdatingBackend(false);
    }
  };

  /**
   * Also save the position to backend
   */
  const savePositionToBackend = async (lpCoinId: string, txDigest: string) => {
    if (!account?.address || !token0 || !token1 || !currentPairId) {
      console.warn("Missing required data for position update");
      return false;
    }

    try {
      // Get LP coin details if possible
      let lpDetails = {};
      try {
        const lpObject = await advancedSuiClient.getObject({
          id: lpCoinId,
          options: { showContent: true },
        });

        if (lpObject?.data?.content) {
          lpDetails = lpObject.data.content;
        }
      } catch (err) {
        console.warn("Could not fetch LP coin details:", err);
      }

      // Prepare position data
      const positionData = {
        id: lpCoinId,
        pairId: currentPairId,
        owner: account.address,
        token0: {
          name: token0.symbol || token0.name,
          amount: amount0 || "0",
          decimals: token0.decimals || 9,
          coinType: token0.coinType || "",
        },
        token1: {
          name: token1.symbol || token1.name,
          amount: amount1 || "0",
          decimals: token1.decimals || 9,
          coinType: token1.coinType || "",
        },
        liquidity: lpDetails.balance || "0",
        feeTier: "0.03%", // Default value, replace with actual if available
        apr: "0%", // Default value, would be calculated
        createdAt: new Date().toISOString(),
        transactionHash: txDigest,
      };

      // Call backend API
      const response = await fetch(
        "https://dexback-mu.vercel.app/api/positions/save",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(positionData),
        }
      );

      if (!response.ok) {
        throw new Error(`Backend responded with status: ${response.status}`);
      }

      console.log("Successfully saved position to backend");
      return true;
    } catch (error) {
      console.error("Failed to save position to backend:", error);
      return false;
    }
  };

  /**
   * Refreshes all data after a successful transaction
   * with staggered timing to avoid overwhelming the network
   */
  const refreshAfterTransaction = useCallback(async () => {
    if (!isMounted.current) return;

    // First, reset any error states
    setNetworkError(null);
    setHasRetried(false);

    // Step 1: Check pair existence (most important)
    try {
      await checkPairExistence();
    } catch (err) {
      console.error("Error checking pair existence during refresh:", err);
    }

    // Step 2: After a small delay, refresh reserves specifically
    setTimeout(async () => {
      if (!isMounted.current) return;
      try {
        await refreshReserves();
      } catch (err) {
        console.error("Error refreshing reserves during refresh:", err);
      }

      // Step 3: Then, after another delay, fetch LP events
      setTimeout(async () => {
        if (!isMounted.current || !currentPairId) return;
        try {
          await fetchPairEvents(currentPairId);
        } catch (err) {
          console.error("Error fetching events during refresh:", err);
        }

        // Step 4: Finally, refresh token balances
        setTimeout(() => {
          if (isMounted.current) {
            fetchBalances();
          }
        }, 1000);
      }, 1000);
    }, 1000);
  }, [
    checkPairExistence,
    refreshReserves,
    fetchPairEvents,
    currentPairId,
    fetchBalances,
  ]);

  // Create pair handler with retry logic
  const handleCreatePair = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!token0 || !token1) {
      toast.error("Please select both tokens");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Creating new pair...");

    try {
      // Create the pair transaction
      const tx = createPairTransaction(token0, token1);

      // Use the advanced client for transaction simulation
      try {
        // Simulate first with resource management
        const simulation = await advancedSuiClient.devInspectTransactionBlock({
          transactionBlock: tx,
          sender: account.address,
        });

        if (simulation.effects?.status?.error) {
          throw new Error(simulation.effects.status.error);
        }

        // Execute the transaction using Suiet Wallet
        const result = await signAndExecuteTransaction({
          transaction: tx as any,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });

        // Handle success
        if (result?.digest) {
          toast.update(toastId, {
            render: "Pair Created! Waiting for confirmation...",
            type: "info",
            isLoading: true,
            autoClose: false,
          });

          // Wait for transaction finality before refreshing data
          await waitForTransactionFinality(result.digest);

          // Reset network error if successful
          setNetworkError(null);
          setHasRetried(false);

          // Use comprehensive refresh function
          refreshAfterTransaction();

          // Extract pool event and update backend
          try {
            // Get the transaction details to find the pool creation event
            const txData = await advancedSuiClient.getTransactionBlock({
              digest: result.digest,
              options: {
                showEvents: true,
              },
            });

            // Find the pool creation event
            const poolEvent = txData.events?.find((event) =>
              event.type.includes("::PoolCreatedEvent")
            );

            if (poolEvent?.parsedJson) {
              // We should update the backend with the new pool information
              const poolData = {
                pairId: poolEvent.parsedJson.poolId || "",
                token0Type: token0.coinType || token0.name,
                token1Type: token1.coinType || token1.name,
                creator: account.address,
                createdAt: new Date().toISOString(),
                transactionHash: result.digest,
              };

              // Call backend API to save the pool
              fetch("https://dexback-mu.vercel.app/api/pools/save", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(poolData),
              }).catch((err) => {
                console.error("Error updating backend with pool data:", err);
              });
            }
          } catch (error) {
            console.error("Error updating backend after pair creation:", error);
          }

          toast.update(toastId, {
            render: "Pair Created Successfully!",
            type: "success",
            isLoading: false,
            autoClose: 5000,
          });
        } else {
          throw new Error("Transaction failed: No digest returned");
        }
      } catch (error) {
        // Handle errors
        console.error("Transaction Error:", error);
        let errorMessage = error.message || "Unknown error";

        // Check if it's a network resource error
        if (
          errorMessage.includes("INSUFFICIENT_RESOURCES") ||
          errorMessage.includes("Failed to fetch")
        ) {
          setNetworkError("Network resource limitations detected");

          // Reset circuit breaker on first retry
          if (!hasRetried) {
            advancedSuiClient.resetCircuitBreaker();
            setHasRetried(true);
          }

          errorMessage = "Network congestion detected. Please try again.";
        } else if (errorMessage.includes("308")) {
          errorMessage = "This pair already exists";
          checkPairExistence();
        }

        toast.update(toastId, {
          render: `Failed to create pair: ${errorMessage}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
      }
    } catch (error: any) {
      console.error("Pair creation failed:", error);
      let errorMessage = error.message || "Unknown error";

      // Check if it's a network resource error
      if (
        errorMessage.includes("INSUFFICIENT_RESOURCES") ||
        errorMessage.includes("Failed to fetch")
      ) {
        setNetworkError("Network resource limitations detected");
        errorMessage = "Network congestion detected. Please try again.";
      } else if (errorMessage.includes("308")) {
        errorMessage = "Trading pair already exists";
        // Try to find the pair
        checkPairExistence();
      }

      toast.update(toastId, {
        render: errorMessage,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Add liquidity handler with improved error handling and backend integration
  const handleAddLiquidity = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!token0 || !token1 || !amount0 || !amount1 || !currentPairId) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading("Adding liquidity...");

    try {
      // Create transaction for adding liquidity
      const addLiquidityTx = await createAddLiquidityTransaction(
        advancedSuiClient, // Use advanced client instead
        account,
        token0,
        token1,
        amount0,
        amount1,
        currentPairId
      );

      try {
        // Simulate with improved error handling
        const simulation = await advancedSuiClient.devInspectTransactionBlock({
          transactionBlock: addLiquidityTx,
          sender: account.address,
        });

        if (simulation.effects?.status?.error) {
          throw new Error(simulation.effects.status.error);
        }

        // Execute transaction using Suiet Wallet
        const result = await signAndExecuteTransaction({
          transaction: addLiquidityTx as any,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });

        if (result?.digest) {
          try {
            // Reset network error if successful
            setNetworkError(null);
            setHasRetried(false);

            toast.update(toastId, {
              render: "Liquidity Added! Waiting for confirmation...",
              type: "info",
              isLoading: true,
              autoClose: false,
            });

            // Wait for transaction finality before refreshing data
            await waitForTransactionFinality(result.digest);

            // Process LP events
            const lpEvent = await processLPEvent(result.digest);

            // Update backend with the new liquidity event
            const backendUpdatePromise = saveEventToBackend(
              lpEvent,
              result.digest
            );

            // Update backend with the new position if we have LP coin ID
            let positionUpdatePromise = Promise.resolve(false);
            if (lpEvent && lpEvent.lpCoinId) {
              positionUpdatePromise = savePositionToBackend(
                lpEvent.lpCoinId,
                result.digest
              );
            }

            // Use the comprehensive refresh function only after finality is confirmed
            refreshAfterTransaction();

            // Wait for backend updates to complete
            const [backendUpdated, positionUpdated] = await Promise.allSettled([
              backendUpdatePromise,
              positionUpdatePromise,
            ]);

            // Clear inputs and show success message
            resetAmounts();

            if (backendUpdated.status === "fulfilled" && backendUpdated.value) {
              toast.update(toastId, {
                render: "Liquidity Added Successfully! 🎉",
                type: "success",
                isLoading: false,
                autoClose: 5000,
              });
            } else {
              console.warn(
                "Backend update failed but transaction was successful"
              );
              toast.update(toastId, {
                render: "Liquidity added successfully (backend sync pending)",
                type: "success",
                isLoading: false,
                autoClose: 5000,
              });
            }
          } catch (error) {
            console.error("Error processing LP events:", error);

            // Still try to refresh even if event processing fails
            refreshAfterTransaction();

            // Try to update backend with basic information
            try {
              await saveEventToBackend(null, result.digest);
            } catch (backendError) {
              console.error("Error updating backend:", backendError);
            }

            toast.update(toastId, {
              render: "Liquidity added successfully",
              type: "success",
              isLoading: false,
              autoClose: 5000,
            });
          }
        } else {
          throw new Error("Transaction failed: No digest returned");
        }
      } catch (error) {
        console.error("Transaction error:", error);
        let errorMessage = error.message || "Unknown error";

        // Check if it's a network resource error
        if (
          errorMessage.includes("INSUFFICIENT_RESOURCES") ||
          errorMessage.includes("Failed to fetch")
        ) {
          setNetworkError("Network resource limitations detected");

          // Reset circuit breaker on first retry
          if (!hasRetried) {
            advancedSuiClient.resetCircuitBreaker();
            setHasRetried(true);
          }

          errorMessage = "Network congestion detected. Please try again.";
        }

        toast.update(toastId, {
          render: `Transaction failed: ${errorMessage}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
      }
    } catch (error: any) {
      console.error("Transaction failed:", error);
      let errorMessage = error.message || "Unknown error";

      // Check if it's a network resource error
      if (
        errorMessage.includes("INSUFFICIENT_RESOURCES") ||
        errorMessage.includes("Failed to fetch")
      ) {
        setNetworkError("Network resource limitations detected");
        errorMessage = "Network congestion detected. Please try again.";
      } else if (errorMessage.includes("Insufficient balance")) {
        errorMessage = "Insufficient balance to complete the transaction";
      }

      toast.update(toastId, {
        render: `Failed to add liquidity: ${errorMessage}`,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  // Update rendered events only when events actually change
  useEffect(() => {
    // Only update rendered events when the events array changes or when currentPairId changes
    if (events && events.length > 0) {
      // Use a more robust comparison - check if arrays are different
      const eventsChanged =
        renderedEvents.length !== events.length ||
        events.some((event, index) => {
          // Compare critical properties instead of full JSON stringification
          return (
            !renderedEvents[index] ||
            renderedEvents[index].lpCoinId !== event.lpCoinId ||
            renderedEvents[index].sender !== event.sender ||
            renderedEvents[index].liquidity !== event.liquidity
          );
        });

      if (eventsChanged) {
        setRenderedEvents(events);
      }
    } else if (renderedEvents.length > 0 && events.length === 0) {
      // Clear rendered events if actual events are empty
      setRenderedEvents([]);
    }
  }, [events, currentPairId]);

  // Function to handle network retry
  const handleNetworkRetry = useCallback(() => {
    // Reset circuit breaker
    advancedSuiClient.resetCircuitBreaker();

    // Retry fetching balances
    fetchBalances();

    // Clear network error state
    setNetworkError(null);

    // Reset retry flag
    setHasRetried(false);

    toast.info("Retrying connection to the network...", {
      autoClose: 3000,
    });
  }, [fetchBalances]);

  // Function to manually force refresh of all data
  const forceDataRefresh = useCallback(async () => {
    console.log("Forcing manual data refresh...");

    if (!currentPairId || !token0 || !token1) {
      console.log("Cannot refresh: missing pair ID or tokens");
      return;
    }

    try {
      console.log("1. Clearing circuit breaker...");
      advancedSuiClient.resetCircuitBreaker();

      console.log("2. Checking pair existence...");
      await checkPairExistence();

      console.log("3. Refreshing reserves...");
      await refreshReserves();

      console.log("4. Fetching pair events...");
      await fetchPairEvents(currentPairId);

      console.log("5. Refreshing token balances...");
      await fetchBalances();

      console.log("Manual refresh completed successfully");
      toast.success("Pool information refreshed successfully");
    } catch (error) {
      console.error("Error during manual refresh:", error);
      toast.error("Failed to refresh pool information");
    }
  }, [
    currentPairId,
    token0,
    token1,
    checkPairExistence,
    refreshReserves,
    fetchPairEvents,
    fetchBalances,
  ]);

  // Add effect to log when reserves change
  useEffect(() => {
    console.log("Reserves updated:", {
      reserve0: reserves.reserve0,
      reserve1: reserves.reserve1,
      timestamp: reserves.timestamp,
      token0: token0?.symbol,
      token1: token1?.symbol,
    });
  }, [reserves, token0, token1]);

  // Auto-refresh reserves periodically to keep pool information up-to-date
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (pairExists && currentPairId) {
      // Initial refresh
      refreshReserves();

      // Then set up interval with jitter to prevent network spikes
      const jitter = Math.floor(Math.random() * 3000); // 0-3s random delay
      intervalId = setInterval(() => {
        if (isMounted.current) {
          refreshReserves();
        }
      }, 20000 + jitter); // 20-23s interval with jitter
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [pairExists, currentPairId, refreshReserves]);

  // Component for events display
  const EventsDisplay = React.memo(({ events }: { events: LPEvent[] }) => {
    const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

    // Store the scroll position before updating the table
    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const prevScrollLeft = scrollContainer.scrollLeft;

      // Delay restoring scroll position after rendering
      setTimeout(() => {
        if (scrollContainer) {
          scrollContainer.scrollLeft = prevScrollLeft;
        }
      }, 0);
    }, [events]); // Runs every time the events array updates

    if (!events?.length) {
      return (
        <div className="text-center text-gray-400 mt-4 bg-indigo-900/20 p-6 rounded-xl border border-indigo-500/30">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-indigo-300" />
          <p>No liquidity events found for this pair</p>
        </div>
      );
    }

    return (
      <div
        className="mt-6 overflow-x-auto rounded-xl border border-indigo-500/30 bg-indigo-900/20 backdrop-blur-sm"
        ref={scrollContainerRef} // Attach ref to the scroll container
      >
        <table className="min-w-full divide-y divide-indigo-500/20">
          <thead className="bg-indigo-900/30">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Amount 0
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Amount 1
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Liquidity
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                LP Token ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Provider
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Token Types
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Event Type
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">
                Time
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-500/20 bg-indigo-900/10">
            {events.map((event, idx) => (
              <tr
                key={`${event.lpCoinId || idx}-${event.sender || idx}`}
                className="hover:bg-indigo-900/20 transition-colors"
              >
                <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                  {event.amount0 ? (
                    <span className="font-mono">
                      {formatLargeNumber(event.amount0)}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                  {event.amount1 ? (
                    <span className="font-mono">
                      {formatLargeNumber(event.amount1)}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-indigo-400 whitespace-nowrap font-medium">
                  {event.liquidity ? (
                    <span className="font-mono">
                      {formatLargeNumber(event.liquidity)}
                    </span>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-indigo-500 whitespace-nowrap">
                  {event.lpCoinId ? (
                    <a
                      href={`https://suiscan.xyz/devnet/object/${event.lpCoinId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {`${event.lpCoinId.slice(0, 6)}...${event.lpCoinId.slice(
                        -4
                      )}`}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                  {event.sender ? (
                    <a
                      href={`https://suiscan.xyz/devnet/address/${event.sender}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {`${event.sender.slice(0, 6)}...${event.sender.slice(
                        -4
                      )}`}
                    </a>
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span>{getTokenTypeName(event.token0Type) || "N/A"}</span>
                    <span>{getTokenTypeName(event.token1Type) || "N/A"}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                  <span className="px-2 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs">
                    {event.type ? event.type.split("::").pop() || "N/A" : "N/A"}
                  </span>
                </td>
                <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                  {event.timestamp
                    ? new Date(event.timestamp).toLocaleString()
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  return (
    <>
      <StyledToastContainer />

      <div className="min-h-screen w-full flex flex-col items-center justify-center">
        {/* Add Network Status Bar at the top of the component */}
        <div className="w-[95%] max-w-xl mb-2">
          <NetworkStatusBar onRetry={handleNetworkRetry} />
        </div>

        {/* Display custom network error message if needed */}
        {networkError && (
          <div className="w-[95%] max-w-xl mb-2">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-300">{networkError}</p>
                <p className="text-xs text-gray-400 mt-1">
                  The application will automatically retry connections.
                </p>
              </div>
              <button
                onClick={handleNetworkRetry}
                className="px-3 py-1.5 rounded-lg text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
              >
                Retry Now
              </button>
            </motion.div>
          </div>
        )}

        {/* Show backend sync status if active */}
        {isUpdatingBackend && (
          <div className="w-[95%] max-w-xl mb-2">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-blue-900/20 border border-blue-500/30 flex items-start gap-3"
            >
              <RefreshCcw className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
              <div className="flex-1">
                <p className="text-sm text-blue-300">
                  Syncing data with backend...
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Your transaction is being processed and stored.
                </p>
              </div>
            </motion.div>
          </div>
        )}

        <motion.div
          className="relative w-[95%] max-w-xl"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <motion.div
            variants={itemVariants}
            className="bg-gray-900/30 backdrop-blur-xl rounded-3xl shadow-2xl border border-indigo-500/20 overflow-hidden"
            style={{
              boxShadow: "0 10px 40px -5px rgba(99, 102, 241, 0.3)",
            }}
          >
            {/* Glassmorphism card overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-blue-500/10 pointer-events-none"></div>

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-gray-800/30">
              <div className="flex justify-between items-center">
                <motion.h1
                  className="text-3xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-blue-300 bg-clip-text text-transparent"
                  variants={itemVariants}
                >
                  Liquidity Pool
                </motion.h1>

                {token0 && token1 && (
                  <motion.div
                    variants={itemVariants}
                    className={`px-3 py-2 rounded-lg text-sm ${
                      pairExists
                        ? "bg-green-500/10 text-green-500 border border-green-500/20"
                        : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                    }`}
                  >
                    {isRefreshingPair ? (
                      <RefreshCcw className="w-4 h-4 animate-spin cursor-pointer" />
                    ) : pairExists ? (
                      <span>✓ Trading Pair Active</span>
                    ) : (
                      <span>⚠ New Trading Pair</span>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            <div className="p-6">
              {/* Token Loading Indicator */}
              {loadingTokens && (
                <motion.div
                  variants={itemVariants}
                  className="mt-3 mb-4 p-4 bg-indigo-900/20 rounded-xl border border-indigo-500/20"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCcw className="w-5 h-5 text-indigo-400 animate-spin" />
                    <p className="text-sm text-indigo-300">
                      Loading token information...
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Pair Info Card */}
              <AnimatePresence>
                {token0 && token1 && pairExists && (
                  <InfoCard
                    token0={token0}
                    token1={token1}
                    pairExists={pairExists}
                    currentPairId={currentPairId}
                    reserves={reserves}
                    priceRate0={priceRate0}
                    priceRate1={priceRate1}
                    variant="liquidity"
                  />
                )}
              </AnimatePresence>

              {/* Token Selection - centered when creating pair */}
              <div className="space-y-4 relative">
                <motion.div
                  variants={itemVariants}
                  className={pairExists ? "" : "flex justify-center"}
                >
                  <div className={pairExists ? "w-full" : "w-full sm:w-4/5"}>
                    <TokenSelector
                      selectedToken={token0}
                      label="First Token"
                      onSelect={handleToken0Change}
                      amount={amount0}
                      onAmountChange={setAmount0}
                      showInput={pairExists}
                      balance={balance0}
                      isInput={true}
                      centerButton={true}
                      isLoading={loadingTokens}
                    />
                  </div>
                </motion.div>

                <motion.div
                  variants={itemVariants}
                  className={pairExists ? "" : "flex justify-center"}
                >
                  <div className={pairExists ? "w-full" : "w-full sm:w-4/5"}>
                    <TokenSelector
                      selectedToken={token1}
                      label="Second Token"
                      onSelect={handleToken1Change}
                      amount={amount1}
                      onAmountChange={setAmount1}
                      showInput={pairExists}
                      balance={balance1}
                      isInput={true}
                      centerButton={true}
                      isLoading={loadingTokens}
                    />
                  </div>
                </motion.div>

                {/* Display suggested amount and warning in liquidity mode */}
                <AnimatePresence>
                  {pairExists && suggestedAmount1 && amount0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-4 bg-indigo-900/20 rounded-xl space-y-3 border border-indigo-500/20"
                    >
                      <div className="flex items-start gap-2">
                        <Lightbulb className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-300">
                            Suggested amount based on pool ratio:
                            <span className="ml-1 text-indigo-400 font-medium">
                              {parseFloat(suggestedAmount1).toFixed(6)}{" "}
                              {token1?.symbol}
                            </span>
                          </p>

                          {suggestedAmount1 &&
                            amount1 &&
                            Math.abs(
                              Number(amount1) - Number(suggestedAmount1)
                            ) /
                              Number(suggestedAmount1) >
                              0.01 && (
                              <p className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Current amount differs from the suggested
                                amount. This may result in sub-optimal liquidity
                                provision.
                              </p>
                            )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Action Button */}
                <motion.div variants={itemVariants} className="mt-6">
                  <button
                    onClick={pairExists ? handleAddLiquidity : handleCreatePair}
                    disabled={
                      isLoading ||
                      loadingTokens ||
                      !token0 ||
                      !token1 ||
                      (pairExists ? !amount0 || !amount1 : false)
                    }
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/30 disabled:shadow-none"
                  >
                    {isLoading || loadingTokens ? (
                      <div className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        {loadingTokens
                          ? "Loading Tokens..."
                          : pairExists
                          ? "Adding Liquidity..."
                          : "Creating Pair..."}
                      </div>
                    ) : pairExists ? (
                      <div className="flex items-center justify-center gap-2">
                        <PlusIcon className="w-5 h-5" />
                        Add Liquidity
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <Binary className="w-5 h-5" />
                        Create Trading Pair
                      </div>
                    )}
                  </button>
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Events Section */}
          <motion.div
            variants={itemVariants}
            className="mt-8 bg-gray-900/30 backdrop-blur-xl rounded-3xl border border-indigo-500/20 shadow-lg p-6"
            style={{
              boxShadow: "0 10px 40px -5px rgba(99, 102, 241, 0.3)",
            }}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl text-white font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-blue-300 bg-clip-text text-transparent">
                  Recent Liquidity Events
                </span>
              </h2>

              <button
                onClick={() => {
                  // Reset circuit breaker before fetching events to ensure clean state
                  advancedSuiClient.resetCircuitBreaker();
                  // Refresh both events and reserves
                  fetchPairEvents(currentPairId || "");
                  refreshReserves();
                }}
                disabled={!currentPairId || isRefreshingPair}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-800/30 text-indigo-300 hover:bg-indigo-700/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <RefreshCcw
                  className={`w-3.5 h-3.5 ${
                    isRefreshingPair ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>
            </div>

            <EventsDisplay events={renderedEvents} />
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default LiquidityPage;
