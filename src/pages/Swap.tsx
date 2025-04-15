"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useWallet } from "@suiet/wallet-kit";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Settings,
  Zap,
  AlertCircle,
  RefreshCw,
  History,
  Clock,
  Link,
  ExternalLink,
  ArrowRightLeft,
  PlusCircle,
} from "lucide-react";
import toast, { StyledToastContainer } from "../utils/CustomToast";

// Import shared components
import SwapTokenSelector from "../components/common/SwapTokenSelector";
import InfoCard from "../components/common/InfoCard";
import SettingsPanel from "../components/common/SettingsPanel";
import RouteDisplay from "../components/common/RouteDisplay";
import NetworkStatusBar from "../components/NetworkStatus";

// Import SUI client
import { suiClient } from "../utils/suiClient";

// Import shared hooks
import { usePair } from "../hooks/usePair";
import { useTokenAmounts } from "../hooks/useTokenAmounts";
import { useRoutes } from "../hooks/useRoutes";

// Import shared utilities
import { Token } from "../utils/tokenUtils";
import {
  createSwapTransactionWithRoute,
  estimateGasBudget,
  validateRoute,
  simulateTransaction,
  handleSwapError,
  interpretMoveError,
} from "../utils/transactionUtils-multihop";
import {
  scaleAmount,
  normalizeTokenType,
  matchTokenTypes,
} from "../utils/routeUtils";

// Define interface for transaction history items
interface SwapHistoryItem {
  txId: string;
  timestamp: number;
  fromToken: {
    symbol: string;
    amount: string;
  };
  toToken: {
    symbol: string;
    amount: string;
  };
  route: string[];
  type: "direct" | "multi";
  status: "completed" | "pending" | "failed";
}

/**
 * Enhanced Swap Page Component
 * Supports both direct and multi-hop swaps
 */
const EnhancedSwapPage = () => {
  // React Router navigation
  const navigate = useNavigate();

  // State management
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapLoading, setIsSwapLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>("");
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [hasRetried, setHasRetried] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<
    SwapHistoryItem[]
  >([]);

  // Use refs to track component mount state and prevent unnecessary rerenders
  const isMounted = useRef(true);
  const lastSwapTimeRef = useRef<number>(0);
  const lastFindRoutesRequestRef = useRef<number>(0);
  const findRoutesTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { account } = useWallet();
  const { signAndExecuteTransactionBlock } = useWallet();

  // Get pair information
  const {
    pairExists,
    currentPairId,
    reserves,
    isRefreshingPair,
    checkPairExistence,
    loadingPair,
  } = usePair(token0, token1);

  // Get token amounts and related calculations
  const {
    amount0,
    amount1,
    priceRate0,
    priceRate1,
    estimatedOutput,
    error,
    setAmount0,
    setAmount1,
    resetAmounts,
  } = useTokenAmounts(token0, token1, reserves, pairExists, "swap");

  // Get routing information
  const {
    routes,
    selectedRoute,
    setSelectedRoute,
    isLoadingRoutes,
    findRoutes,
  } = useRoutes(
    suiClient,
    token0,
    token1,
    amount0,
    pairExists,
    currentPairId,
    reserves
  );

  // Debug effect to track button state
  useEffect(() => {
    console.log("Swap button state:", {
      isSwapLoading,
      loadingPair,
      isLoadingRoutes,
      hasToken0: !!token0,
      hasToken1: !!token1,
      hasAmount: !!(amount0 && parseFloat(amount0) > 0),
      hasSelectedRoute: !!selectedRoute,
      routesCount: routes.length,
    });
  }, [
    isSwapLoading,
    loadingPair,
    isLoadingRoutes,
    token0,
    token1,
    amount0,
    selectedRoute,
    routes.length,
  ]);

  // Force selected route when routes are found
  useEffect(() => {
    if (routes.length > 0 && !selectedRoute) {
      console.log(
        "Routes available but no selectedRoute - forcing selection:",
        routes[0]
      );
      setSelectedRoute(routes[0]);
    }
  }, [routes, selectedRoute, setSelectedRoute]);

  // Enhanced route finding trigger
  useEffect(() => {
    if (
      token0 &&
      token1 &&
      amount0 &&
      parseFloat(amount0) > 0 &&
      !isLoadingRoutes &&
      pairExists
    ) {
      console.log("All conditions met, triggering route finding");
      debouncedFindRoutes();
    }
  }, [token0, token1, amount0, pairExists, reserves, isLoadingRoutes]);

  // Handle redirect to Add Liquidity page
  const handleAddLiquidityRedirect = useCallback(() => {
    // Create query parameters if needed
    const params = new URLSearchParams();

    if (token0 && token0.id) {
      console.log(`Adding token0 parameter: ${token0.id}`);
      params.append("token0", token0.id);
    }

    if (token1 && token1.id) {
      console.log(`Adding token1 parameter: ${token1.id}`);
      params.append("token1", token1.id);
    }

    const queryString = params.toString();
    const targetUrl = `/addliquidity${queryString ? `?${queryString}` : ""}`;

    console.log(`Redirecting to: ${targetUrl}`);
    navigate(targetUrl);
  }, [navigate, token0, token1]);

  // Check if both tokens are selected and no routes are available
  const shouldShowAddLiquidity = useMemo(() => {
    return (
      token0 !== null &&
      token1 !== null &&
      // Show when no routes exist regardless of amount
      ((!isLoadingRoutes && routes.length === 0 && !pairExists) ||
        // Or when an amount is entered but no routes
        (amount0 &&
          parseFloat(amount0) > 0 &&
          !isLoadingRoutes &&
          routes.length === 0 &&
          !pairExists))
    );
  }, [token0, token1, amount0, isLoadingRoutes, routes.length, pairExists]);

  // Update mount status on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Clear any timeouts on unmount
      if (findRoutesTimeoutRef.current) {
        clearTimeout(findRoutesTimeoutRef.current);
      }
    };
  }, []);

  // Update amount1 when a route is selected with proper dependency tracking
  useEffect(() => {
    // Only update amount1 when a route is selected and amount0 has changed
    // This prevents premature updates to amount1
    if (selectedRoute && amount0 && parseFloat(amount0) > 0) {
      setAmount1(selectedRoute.estimatedOutput);
    }
  }, [selectedRoute, amount0, setAmount1]);

  // Load transaction history from localStorage on mount
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("swap_history");
      if (storedHistory) {
        setTransactionHistory(JSON.parse(storedHistory));
      }
    } catch (error) {
      console.error("Failed to load transaction history:", error);
    }
  }, []);

  // Improved debounced route finding to prevent excessive API calls
  const debouncedFindRoutes = useCallback(() => {
    // Always clear any existing timeout first
    if (findRoutesTimeoutRef.current) {
      clearTimeout(findRoutesTimeoutRef.current);
    }

    // Only proceed if we have both tokens and a valid amount
    if (!token0 || !token1 || !amount0 || parseFloat(amount0) <= 0) {
      return;
    }

    console.log("Finding routes for tokens:", {
      token0Symbol: token0?.symbol,
      token1Symbol: token1?.symbol,
      amount: amount0,
      pairExists,
    });

    // Call findRoutes immediately instead of debouncing in some cases
    if (pairExists && currentPairId && reserves) {
      console.log("Direct pair exists, finding routes immediately");
      lastFindRoutesRequestRef.current = Date.now();
      findRoutes();
    } else {
      // Standard debounced behavior
      const now = Date.now();
      const timeSinceLastRequest = now - lastFindRoutesRequestRef.current;

      // If enough time has passed, find routes immediately
      if (timeSinceLastRequest > 500) {
        lastFindRoutesRequestRef.current = now;
        findRoutes();
      } else {
        // Otherwise schedule for later
        findRoutesTimeoutRef.current = setTimeout(() => {
          lastFindRoutesRequestRef.current = Date.now();
          findRoutes();
          findRoutesTimeoutRef.current = null;
        }, 500 - timeSinceLastRequest);
      }
    }
  }, [
    findRoutes,
    token0,
    token1,
    amount0,
    pairExists,
    currentPairId,
    reserves,
  ]);

  // Function to wait for transaction finality
  const waitForTransactionFinality = async (
    txDigest: string,
    maxAttempts = 10
  ): Promise<boolean> => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        // Check transaction status
        const txStatus = await suiClient.getTransactionBlock({
          digest: txDigest,
          options: {
            showEffects: true,
          },
        });

        if (txStatus.effects?.status?.status === "success") {
          return true;
        }

        // If still processing, wait with exponential backoff
        attempts++;
        const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (error) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return false;
  };

  // Function to handle network retry
  const handleNetworkRetry = useCallback(() => {
    // Clear network error state
    setNetworkError(null);

    // Reset retry flag
    setHasRetried(false);

    // Retry route finding
    debouncedFindRoutes();

    toast.info("Retrying connection to the network...", {
      autoClose: 3000,
    });
  }, [debouncedFindRoutes]);

  // Token change handlers
  const handleToken0Change = useCallback(
    (newToken: Token | null) => {
      setToken0(newToken);
      resetAmounts();
    },
    [resetAmounts]
  );

  const handleToken1Change = useCallback(
    (newToken: Token | null) => {
      setToken1(newToken);
      resetAmounts();
    },
    [resetAmounts]
  );

  // Swap tokens positions
  const handleSwapTokens = useCallback(() => {
    const tempToken = token0;
    const tempAmount = amount0;
    handleToken0Change(token1);
    setAmount0(amount1);
    handleToken1Change(tempToken);
    setAmount1(tempAmount);
  }, [
    token0,
    token1,
    amount0,
    amount1,
    handleToken0Change,
    handleToken1Change,
  ]);

  // Debounce swap execution to prevent accidental double-swaps
  const canExecuteSwap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastSwap = now - lastSwapTimeRef.current;

    if (timeSinceLastSwap < 3000) {
      // 3 seconds cooldown
      return false;
    }

    lastSwapTimeRef.current = now;
    return true;
  }, []);

  // Add to transaction history
  const addToTransactionHistory = useCallback(
    (historyItem: SwapHistoryItem) => {
      setTransactionHistory((prev) => {
        const updatedHistory = [historyItem, ...prev].slice(0, 10);

        // Save to localStorage
        try {
          localStorage.setItem("swap_history", JSON.stringify(updatedHistory));
        } catch (error) {
          console.error("Failed to save transaction history:", error);
        }

        return updatedHistory;
      });
    },
    []
  );

  // Improved handleSwap function with better error handling and debugging
  const handleSwap = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!token0 || !token1) {
      toast.error("Please select tokens for the swap");
      return;
    }

    if (!amount0 || parseFloat(amount0) <= 0) {
      toast.error("Please enter an amount to swap");
      return;
    }

    if (!selectedRoute) {
      toast.error("No valid route found for this swap");
      return;
    }

    // Validate route before proceeding
    if (!validateRoute(selectedRoute)) {
      toast.error(
        "Invalid swap route. Please try again or select a different route."
      );
      return;
    }

    // Prevent accidental double-swaps
    if (!canExecuteSwap()) {
      toast.info("Please wait a moment before trying again");
      return;
    }

    // setIsLoading(true);
    setNetworkError(null);
    const toastId = toast.loading("Preparing swap transaction...");

    try {
      // Log the swap attempt details for debugging
      console.log("selectedRoute", selectedRoute);
      console.log("Starting swap with route:", {
        routeType: selectedRoute.type,
        inputToken: token0.symbol,
        outputToken: token1.symbol,
        amount: amount0,
        pairId: selectedRoute.pairs[0].pairId,
        reserves: selectedRoute.pairs[0].reserves,
      });

      // Calculate effective slippage (add small buffer for multi-hop swaps)
      const effectiveSlippage =
        selectedRoute.type === "multi"
          ? slippage + 0.5 // Add a small buffer for multi-hop swaps
          : slippage;

      // Minimum amount out with slippage applied
      const minAmountOut = (
        parseFloat(selectedRoute.estimatedOutput) *
        (1 - effectiveSlippage / 100)
      ).toFixed(6);

      console.log("Slippage settings:", {
        originalAmount: selectedRoute.estimatedOutput,
        effectiveSlippage: `${effectiveSlippage}%`,
        minAmountOut,
      });

      // Set deadline (20 minutes from now)
      const deadline = Math.floor(Date.now() + 1200000);

      // Update processing step based on route type
      setProcessingStep(
        selectedRoute.type === "direct"
          ? "Creating direct swap transaction..."
          : "Creating multi-hop swap transaction..."
      );

      // Add pending transaction to history
      const pendingTx: SwapHistoryItem = {
        txId: "pending-" + Date.now(),
        timestamp: Date.now(),
        fromToken: {
          symbol: token0.symbol || "Unknown",
          amount: amount0,
        },
        toToken: {
          symbol: token1.symbol || "Unknown",
          amount: selectedRoute.estimatedOutput,
        },
        route: selectedRoute.pathSymbols,
        type: selectedRoute.type,
        status: "pending",
      };

      addToTransactionHistory(pendingTx);

      // Create transaction using the selected route
      console.log("Creating swap transaction...");
      console.log("token0::::::::::", token0);
      console.log("token1::::::::::", token1);
      const swapTx = await createSwapTransactionWithRoute(
        suiClient,
        account,
        token0,
        token1,
        amount0,
        minAmountOut,
        selectedRoute,
        deadline
      );

      // Update toast
      toast.update(toastId, {
        render: "Simulating transaction...",
        type: "info",
        isLoading: true,
      });

      setProcessingStep("Simulating transaction...");

      // Simulate transaction first with enhanced error reporting
      console.log("Simulating transaction before execution...");
      const simulation = await simulateTransaction(suiClient, account, swapTx);

      // Log detailed simulation results for debugging
      console.log("Transaction simulation result:", simulation);

      if (!simulation.success) {
        console.error(
          "Simulation failed:",
          simulation.error,
          simulation.details
        );
        throw new Error(simulation.error || "Simulation failed");
      }

      // Estimate gas budget for transaction with a buffer for safety
      const estimatedGas = estimateGasBudget(selectedRoute);
      const gasBudget = Math.floor(estimatedGas * 1.2); // Add 20% buffer

      // Set gas budget explicitly
      console.log(`Setting gas budget to ${gasBudget}`);
      swapTx.setGasBudget(gasBudget);

      // Update toast
      toast.update(toastId, {
        render:
          selectedRoute.type === "direct"
            ? "Executing swap..."
            : `Executing ${selectedRoute.hops}-hop swap...`,
        type: "info",
        isLoading: true,
      });

      setProcessingStep(
        selectedRoute.type === "direct"
          ? "Executing swap..."
          : `Executing ${selectedRoute.hops}-hop swap...`
      );

      // Execute the transaction with additional options
      console.log("Executing transaction via wallet...");
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: swapTx as any,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
          showBalanceChanges: true,
          showInput: true,
        },
      });

      console.log("Transaction response:", result);

      // Check for errors in transaction effects
      if (result.effects?.status?.error) {
        console.error(
          "Transaction execution error:",
          result.effects.status.error
        );
        throw new Error(
          interpretMoveError(result.effects.status.error) ||
            "Transaction failed during execution"
        );
      }

      // Wait for transaction finality
      toast.update(toastId, {
        render: "Waiting for confirmation...",
        type: "info",
        isLoading: true,
      });

      console.log("Waiting for transaction finality...");
      await waitForTransactionFinality(result.digest);

      // Update toast with success message
      const successMessage =
        selectedRoute.type === "direct"
          ? "Swap completed successfully!"
          : `${selectedRoute.hops}-hop swap completed successfully!`;

      toast.update(toastId, {
        render: successMessage,
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

      // Add to transaction history
      const historyItem: SwapHistoryItem = {
        txId: result.digest,
        timestamp: Date.now(),
        fromToken: {
          symbol: token0.symbol || "Unknown",
          amount: amount0,
        },
        toToken: {
          symbol: token1.symbol || "Unknown",
          amount: selectedRoute.estimatedOutput,
        },
        route: selectedRoute.pathSymbols,
        type: selectedRoute.type,
        status: "completed",
      };

      addToTransactionHistory(historyItem);

      // Reset the form
      resetAmounts();
      setSelectedRoute(null);

      // Force refresh pair data
      await checkPairExistence();
      debouncedFindRoutes();
    } catch (error: any) {
      console.error("Swap error details:", {
        error,
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      });

      // Capture the original error message
      const originalErrorMessage = error.message || "Unknown error";
      console.error(`Original error message: "${originalErrorMessage}"`);

      // Use the enhanced error handler
      const userMessage = handleSwapError(error);
      console.log(`User-friendly error message: "${userMessage}"`);

      // Update history with failed transaction
      setTransactionHistory((prev: any) => {
        const updatedHistory = prev.map((item: any) =>
          item.status === "pending" && !item.txId.startsWith("0x")
            ? { ...item, status: "failed" }
            : item
        );

        // Save to localStorage
        localStorage.setItem("swap_history", JSON.stringify(updatedHistory));

        return updatedHistory;
      });

      // Check if it's a network resource error
      if (
        originalErrorMessage.includes("INSUFFICIENT_RESOURCES") ||
        originalErrorMessage.includes("Failed to fetch")
      ) {
        setNetworkError("Network resource limitations detected");

        // Retry logic on first error
        if (!hasRetried) {
          setHasRetried(true);
        }
      }

      // Show detailed error information in toast
      toast.update(toastId, {
        render: userMessage,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      if (isMounted.current) {
        // setIsLoading(false);
        setProcessingStep("");
      }
    }
  };

  // Format transaction date for history display
  const formatTransactionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const historyVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: {
      opacity: 1,
      height: "auto",
      transition: {
        duration: 0.3,
        ease: "easeInOut",
      },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: {
        duration: 0.2,
        ease: "easeInOut",
      },
    },
  };

  // Should we show the Routes panel?
  const showRoutesPanel = routes.length >= 1 || isLoadingRoutes;

  // Animation for Add Liquidity button
  const addLiquidityVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 500,
        damping: 30,
        delay: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: 10,
      transition: {
        duration: 0.2,
      },
    },
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center py-10">
      <StyledToastContainer />
      <motion.div
        className="relative w-[95%] max-w-xl"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Network Status Bar */}
        <div className="mb-2">
          <NetworkStatusBar onRetry={handleNetworkRetry} />
        </div>

        {/* Display custom network error message if needed */}
        {networkError && (
          <div className="w-full mb-2">
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

        {/* History toggle button */}
        {transactionHistory.length > 0 && (
          <div className="w-full flex justify-end mb-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-sm py-1.5 px-3 rounded-lg bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 transition-colors"
            >
              <History className="w-4 h-4" />
              <span>Swap History</span>
            </button>
          </div>
        )}

        {/* Transaction History Panel */}
        <AnimatePresence>
          {showHistory && transactionHistory.length > 0 && (
            <motion.div
              variants={historyVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="w-full mb-4 bg-gray-900/30 backdrop-blur-xl rounded-xl border border-indigo-500/20 overflow-hidden"
            >
              <div className="p-4 border-b border-indigo-500/20">
                <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                  Recent Transactions
                </h3>
              </div>

              <div className="max-h-60 overflow-y-auto p-2">
                {transactionHistory.map((tx, index) => (
                  <div
                    key={tx.txId || index}
                    className="p-3 mb-2 rounded-lg bg-indigo-900/20 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-sm font-medium text-white">
                            {tx.fromToken.symbol} → {tx.toToken.symbol}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              tx.type === "direct"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-indigo-500/20 text-indigo-400"
                            }`}
                          >
                            {tx.type === "direct" ? "Direct" : "Multi-hop"}
                          </span>
                        </div>

                        <div className="text-xs text-gray-400">
                          {tx.fromToken.amount} {tx.fromToken.symbol} →{" "}
                          {tx.toToken.amount} {tx.toToken.symbol}
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            tx.status === "completed"
                              ? "bg-green-500/20 text-green-400"
                              : tx.status === "pending"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {tx.status === "completed"
                            ? "Completed"
                            : tx.status === "pending"
                            ? "Pending"
                            : "Failed"}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          {formatTransactionDate(tx.timestamp)}
                        </span>
                      </div>
                    </div>

                    {tx.txId && tx.txId.startsWith("0x") && (
                      <div className="mt-2 pt-2 border-t border-indigo-500/10 flex justify-between items-center">
                        <div className="text-xs text-gray-400 truncate max-w-[220px]">
                          {tx.txId}
                        </div>
                        <a
                          href={`https://suiscan.xyz/transaction/${tx.txId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                Swap Tokens
              </motion.h1>
              <motion.div
                className="flex items-center space-x-3"
                variants={itemVariants}
              >
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg bg-indigo-800/30 hover:bg-indigo-700/40 transition-colors duration-200"
                >
                  <Settings className="w-5 h-5 text-indigo-300 cursor-pointer" />
                </button>
                <div className="text-sm bg-indigo-900/30 px-3 py-1.5 rounded-full border border-indigo-500/30">
                  <span className="text-gray-300">Slippage: </span>
                  <span className="font-semibold text-indigo-300">
                    {slippage}%
                  </span>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="p-6">
            <AnimatePresence>
              {showSettings && (
                <SettingsPanel
                  slippage={slippage}
                  setSlippage={setSlippage}
                  onClose={() => setShowSettings(false)}
                />
              )}
            </AnimatePresence>

            {/* Pair Info Card */}
            <AnimatePresence>
              {token0 && token1 && (
                <InfoCard
                  token0={token0}
                  token1={token1}
                  pairExists={pairExists || false}
                  currentPairId={currentPairId}
                  reserves={reserves}
                  priceRate0={priceRate0}
                  priceRate1={priceRate1}
                  variant="swap"
                  estimatedOutput={estimatedOutput}
                  slippage={slippage}
                  isRefreshing={loadingPair || false}
                />
              )}
            </AnimatePresence>

            {/* Token Selector Section */}
            <motion.div className="space-y-2" variants={itemVariants}>
              <SwapTokenSelector
                token0={token0}
                token1={token1}
                amount0={amount0}
                amount1={amount1}
                onSwapTokens={handleSwapTokens}
                onAmount0Change={setAmount0}
                onAmount1Change={setAmount1}
                onToken0Select={handleToken0Change}
                onToken1Select={handleToken1Change}
                showInput={true} // Always show input when tokens are selected
                pairExists={!!pairExists}
              />

              {/* Route Finding Status */}
              {isLoadingRoutes && token0 && token1 && amount0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex items-center justify-center"
                >
                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin mr-2" />
                  <span className="text-sm text-gray-300">
                    Finding best routes...
                  </span>
                </motion.div>
              )}

              {/* Error display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-xl mt-3"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Routes Panel */}
            <AnimatePresence>
              {showRoutesPanel && (
                <RouteDisplay
                  routes={routes}
                  selectedRoute={selectedRoute}
                  onRouteSelect={setSelectedRoute}
                  isLoadingRoutes={isLoadingRoutes}
                  refreshRoutes={debouncedFindRoutes}
                />
              )}
            </AnimatePresence>

            {/* Add Liquidity Button - Shown when both tokens are selected but no route exists */}
            <AnimatePresence>
              {shouldShowAddLiquidity && (
                <motion.div
                  variants={addLiquidityVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-500/30"
                >
                  <div className="text-center mb-3">
                    <h4 className="text-lg font-semibold text-indigo-200">
                      No Liquidity Found
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">
                      There's no existing liquidity pool for this token pair.
                      Create the first pool to enable swaps!
                    </p>
                  </div>
                  <button
                    onClick={handleAddLiquidityRedirect}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <PlusCircle className="w-5 h-5" />
                    <span>Add Liquidity</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Swap Button */}
            <motion.div variants={itemVariants} className="mt-6">
              <button
                onClick={handleSwap}
                disabled={
                  isSwapLoading ||
                  (!!loadingPair && !selectedRoute) || // Only consider loadingPair if we don't have a route
                  (isLoadingRoutes && !selectedRoute) || // Only consider loadingRoutes if we don't have a route
                  !token0 ||
                  !token1 ||
                  !amount0 ||
                  parseFloat(amount0) <= 0 ||
                  !selectedRoute
                }
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/30 disabled:shadow-none"
              >
                {isSwapLoading ? (
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
                    <span>{processingStep || "Processing Swap..."}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    {!token0 || !token1
                      ? "Select Tokens"
                      : !amount0 || parseFloat(amount0) <= 0
                      ? "Enter Amount"
                      : isLoadingRoutes && !selectedRoute
                      ? "Finding Routes..."
                      : loadingPair && !selectedRoute
                      ? "Loading Pair..."
                      : !selectedRoute
                      ? "No Route Available"
                      : selectedRoute.type === "multi"
                      ? `Swap via ${selectedRoute.hops} Pools`
                      : "Swap Tokens"}
                  </div>
                )}
              </button>

              {/* Debug info - you can remove this in production if desired */}
              {/* {token0 &&
                token1 &&
                amount0 &&
                parseFloat(amount0) > 0 &&
                !selectedRoute && (
                  <div className="mt-2 text-xs text-red-400 bg-red-900/20 p-2 rounded border border-red-500/20">
                    <div className="font-bold">Debug info:</div>
                    <div>Pair exists: {pairExists ? "Yes" : "No"}</div>
                    <div>Loading pair: {loadingPair ? "Yes" : "No"}</div>
                    <div>Loading routes: {isLoadingRoutes ? "Yes" : "No"}</div>
                    <div>Routes found: {routes.length}</div>
                    <div>Current pair ID: {currentPairId || "None"}</div>
                  </div>
                )} */}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default EnhancedSwapPage;
