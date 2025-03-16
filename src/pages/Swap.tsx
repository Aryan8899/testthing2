"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@suiet/wallet-kit"; 

import { motion, AnimatePresence } from "framer-motion";
import { Settings, Zap } from "lucide-react";
import toast, { StyledToastContainer } from "../utils/CustomToast";

// Import shared components
import SwapTokenSelector from "../components/common/SwapTokenSelector";
import InfoCard from "../components/common/InfoCard";
import SettingsPanel from "../components/common/SettingsPanel";
import { suiClient } from "../utils/suiClient";
// Import shared hooks
import { usePair } from "../hooks/usePair";
import { useTokenAmounts } from "../hooks/useTokenAmounts";

// Import shared utilities
import { Token } from "../utils/tokenUtils";
import {
  createSwapTransaction,
  simulateTransaction,
} from "../utils/transactionUtils";

const SwapPage = () => {
  // State management
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [isSwapLoading, setIsSwapLoading] = useState(false);

  // Hooks
  const { account, connected } = useWallet();

  //const suiClient = useSuiClient();
  const { signAndExecuteTransactionBlock } = useWallet();

  // Get pair information
  const {
    pairExists,
    currentPairId,
    reserves,
    isRefreshingPair,
    checkPairExistence,
    loadingPair, // ✅ Make sure to use this
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

  // Handle swap transaction
  const handleSwap = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet");
      return;
    }

    if (!token0 || !token1 || !amount0 || !estimatedOutput || !currentPairId) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSwapLoading(true);
    const toastId = toast.loading("Processing swap...");

    try {
      // Minimum amount out with slippage applied
      const minAmountOut = (estimatedOutput * (1 - slippage / 100)).toFixed(6);

      // Create transaction for swapping tokens
      const deadline = Math.floor(Date.now() + 1200000); // 20 minutes
      const swapTx = await createSwapTransaction(
        suiClient,
        account,
        token0,
        token1,
        amount0,
        minAmountOut,
        currentPairId,
        deadline
      );

      // Simulate transaction first
      const simulation = await simulateTransaction(suiClient, account, swapTx);

      if (!simulation.success) {
        throw new Error(simulation.error || "Simulation failed");
      }

      // Execute the transaction
      try {
        const result = await signAndExecuteTransactionBlock({
          transactionBlock: swapTx as any,
        });
      
        console.log("Swap transaction succeeded:", result);
        toast.dismiss(toastId);
        toast.success("Swap completed successfully!");
      
        // Reset the form
        resetAmounts();
      
        // Force refresh pair data
        await checkPairExistence();
      } catch (error: any) {
        console.error("Swap transaction failed:", error);
        toast.dismiss(toastId);
        toast.error(`Swap failed: ${error.message}`);
        throw error;
      }
      
    } catch (error: any) {
      console.error("Swap error:", error);
      let errorMessage = error.message || "Unknown error";

      // Provide user-friendly error messages
      const userMessage = errorMessage.includes("Insufficient balance")
        ? "Insufficient balance for swap"
        : errorMessage.includes("slippage")
        ? "Price moved too much, try increasing slippage tolerance"
        : `Swap failed: ${errorMessage}`;

      toast.error(userMessage);
    } finally {
      toast.dismiss(toastId);
      setIsSwapLoading(false);
    }
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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center">
      <StyledToastContainer />
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
                  <Settings className="w-5 h-5 text-indigo-300" />
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
                  pairExists={pairExists}
                  currentPairId={currentPairId}
                  reserves={reserves}
                  priceRate0={priceRate0}
                  priceRate1={priceRate1}
                  variant="swap"
                  estimatedOutput={estimatedOutput}
                  slippage={slippage}
                  isRefreshing={loadingPair} // ✅ Pass loadingPair her
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
                showInput={true}
                pairExists={pairExists}
              />

              {/* Error display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded-xl mt-3"
                  >
                    <span className="text-sm text-red-400">{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Swap Button */}
            <motion.div variants={itemVariants} className="mt-6">
              <button
                onClick={pairExists ? handleSwap : checkPairExistence}
                disabled={
                  isSwapLoading || loadingPair ||
                  !token0 ||
                  !token1 ||
                  (!pairExists ? false : !amount0 || !amount1)
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
                    {pairExists ? "Processing Swap..." : "Checking Pair..."}
                  </div>
                ) : !pairExists ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Check Pair Existence
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5" />
                    Swap Tokens
                  </div>
                )}
              </button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default SwapPage;
