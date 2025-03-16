// @ts-nocheck

"use client";
import React from "react";
import { useState, useCallback,useEffect } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";

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

// Import shared hooks
import { usePair } from "../hooks/usePair";
import { useTokenAmounts } from "../hooks/useTokenAmounts";
import { useTokenBalances } from "../hooks/useTokenBalance";
import { suiClient } from "../utils/suiClient";
// Import shared utilities
import { Token } from "../utils/tokenUtils";
import { formatLargeNumber } from "../utils/formatUtils";
import { LPEvent, getTokenTypeName } from "../utils/pairUtils";
import {
  createPairTransaction,
  createAddLiquidityTransaction,
  simulateTransaction,
} from "../utils/transactionUtils";

const LiquidityPage = () => {
  // State management
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New state to control when events are re-rendered
const [renderedEvents, setRenderedEvents] = useState<LPEvent[]>([]);

  // Hooks
  const { account } = useWallet();

  
   const { signAndExecuteTransactionBlock } = useWallet();


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
  const { balance0, balance1, fetchBalances } = useTokenBalances(
    token0,
    token1
  );

  // Token change handlers
  const handleToken0Change = useCallback(
    (newToken: Token | null) => {
      if (!newToken || newToken.id === token0?.id) return;
  
      setToken0(newToken);
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
  
      setToken1(newToken);
      resetAmounts();
  
      // Only proceed when both tokens are selected
      if (token0) {
        checkPairExistence();
      }
    },
    [token0, token1, resetAmounts, checkPairExistence]
  );
  
  
  

  // Create pair handler
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

      // Simulate first
      const simulation = await simulateTransaction(suiClient, account, tx);
      if (!simulation.success) {
        throw new Error(simulation.error || "Simulation failed");
      }

      // Execute the transaction
      // Then in your handler function:
try {
  // Create the pair transaction
  const tx = createPairTransaction(token0, token1);

  // Simulate first
  const simulation = await simulateTransaction(suiClient, account, tx);
  if (!simulation.success) {
    throw new Error(simulation.error || "Simulation failed");
  }

  // Execute the transaction using Suiet Wallet
  const result = await signAndExecuteTransactionBlock({
    transactionBlock: tx as any,
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  // Handle success
  if (result?.digest) {
    toast.update(toastId, {
      render: "Pair Created Successfully!",
      type: "success",
      isLoading: false,
      autoClose: 5000,
    });

    // Check for pair existence after successful creation
    await checkPairExistence();
  } else {
    throw new Error("Transaction failed: No digest returned");
  }
} catch (error) {
  // Handle errors
  console.error("Transaction Error:", error);
  let errorMessage = error.message || "Unknown error";

  if (errorMessage.includes("308")) {
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

      if (errorMessage.includes("308")) {
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
      setIsLoading(false);
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
          return !renderedEvents[index] || 
                 renderedEvents[index].lpCoinId !== event.lpCoinId ||
                 renderedEvents[index].sender !== event.sender ||
                 renderedEvents[index].liquidity !== event.liquidity;
        });
      
      if (eventsChanged) {
        setRenderedEvents(events);
      }
    } else if (renderedEvents.length > 0 && events.length === 0) {
      // Clear rendered events if actual events are empty
      setRenderedEvents([]);
    }
  }, [events, currentPairId]);


  
  

  // Add liquidity handler
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
        suiClient,
        account,
        token0,
        token1,
        amount0,
        amount1,
        currentPairId
      );

      // Simulate first
      const simulation = await simulateTransaction(
        suiClient,
        account,
        addLiquidityTx
      );
      if (!simulation.success) {
        throw new Error(simulation.error || "Simulation failed");
      }

      // Execute transaction
      try {
        // Execute transaction using Suiet Wallet
        const result = await signAndExecuteTransactionBlock({
          transactionBlock: addLiquidityTx as any,
          options: {
            showEffects: true,
            showEvents: true,
          },
        });
        
        if (result?.digest) {
          try {
            // Process LP events
            await processLPEvent(result.digest);
            
            // Refresh balances
            fetchBalances();
            
            // Clear inputs and show success message
            resetAmounts();
            
            toast.update(toastId, {
              render: "Liquidity Added Successfully! 🎉",
              type: "success",
              isLoading: false,
              autoClose: 5000,
            });
          } catch (error) {
            console.error("Error processing LP events:", error);
            
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
        
        toast.update(toastId, {
          render: `Transaction failed: ${error.message}`,
          type: "error",
          isLoading: false,
          autoClose: 5000,
        });
      }
    } catch (error: any) {
      console.error("Transaction failed:", error);
      let errorMessage = error.message || "Unknown error";

      if (errorMessage.includes("Insufficient balance")) {
        errorMessage = "Insufficient balance to complete the transaction";
      }

      toast.update(toastId, {
        render: `Failed to add liquidity: ${errorMessage}`,
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Component for events display
// Component for displaying events (Without Animation)
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
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">Amount 0</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">Amount 1</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">Liquidity</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">LP Token ID</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">Provider</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">Token Types</th>
            <th className="px-3 py-3 text-left text-xs font-medium text-indigo-300">Event Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-indigo-500/20 bg-indigo-900/10">
          {events.map((event, idx) => (
            <tr key={`${event.lpCoinId || idx}-${event.sender || idx}`} className="hover:bg-indigo-900/20 transition-colors">
              <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                {event.amount0 ? <span className="font-mono">{formatLargeNumber(event.amount0)}</span> : "N/A"}
              </td>
              <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                {event.amount1 ? <span className="font-mono">{formatLargeNumber(event.amount1)}</span> : "N/A"}
              </td>
              <td className="px-3 py-3 text-xs text-indigo-400 whitespace-nowrap font-medium">
                {event.liquidity ? <span className="font-mono">{formatLargeNumber(event.liquidity)}</span> : "N/A"}
              </td>
              <td className="px-3 py-3 text-xs text-indigo-500 whitespace-nowrap">
                {event.lpCoinId ? (
                  <a
                    href={`https://suiscan.xyz/object/${event.lpCoinId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {`${event.lpCoinId.slice(0, 6)}...${event.lpCoinId.slice(-4)}`}
                  </a>
                ) : (
                  "N/A"
                )}
              </td>
              <td className="px-3 py-3 text-xs text-gray-300 whitespace-nowrap">
                {event.sender ? (
                  <a
                    href={`https://suiscan.xyz/address/${event.sender}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {`${event.sender.slice(0, 6)}...${event.sender.slice(-4)}`}
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});


// Events Section (Without Animation)
<div className="mt-8 bg-gray-900/30 backdrop-blur-xl rounded-3xl border border-indigo-500/20 shadow-lg p-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl text-white font-semibold flex items-center gap-2">
      <BarChart3 className="w-5 h-5 text-indigo-400" />
      <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-blue-300 bg-clip-text text-transparent">
        Recent Liquidity Events
      </span>
    </h2>
    <button
      onClick={() => fetchPairEvents(currentPairId || "")}
      disabled={!currentPairId}
      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-800/30 text-indigo-300 hover:bg-indigo-700/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
    >
      <RefreshCcw className="w-3.5 h-3.5" />
      Refresh
    </button>
  </div>
  <EventsDisplay events={events} />
</div>;


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
                      <RefreshCcw className="w-4 h-4 animate-spin" />
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
                      !token0 ||
                      !token1 ||
                      (pairExists ? !amount0 || !amount1 : false)
                    }
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/30 disabled:shadow-none"
                  >
                    {isLoading ? (
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
                        {pairExists
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
                onClick={() => fetchPairEvents(currentPairId || "")}
                disabled={!currentPairId}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-800/30 text-indigo-300 hover:bg-indigo-700/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            <EventsDisplay events={events} />
          </motion.div>
        </motion.div>
      </div>
    </>
  );
};

export default LiquidityPage;
