"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@suiet/wallet-kit"; 

import { Transaction } from "@mysten/sui/transactions";
import toast, { StyledToastContainer } from "../utils/CustomToast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Activity,
  AlertCircle,
  Info,
  ArrowDownUp,
  Droplet,
  Clock,
  Link,
  Wallet,
} from "lucide-react";

// Import shared components
import TokenSelector from "../components/common/TokenSelector";
import InfoCard from "../components/common/InfoCard";
import SettingsPanel from "../components/common/SettingsPanel";
import { useTokenBalances } from "../hooks/useTokenBalance";
import { suiClient } from "../utils/suiClient";
// Import shared hooks
// Import shared hooks
import { usePair } from "../hooks/usePair";
import { useTokenBalance } from "../hooks/useTokenBalance";

// Import shared utilities
import { Token, getBaseType, sortTokenTypes } from "../utils/tokenUtils";
import {
  formatLargeNumber,
  formatTokenAmount,
  formatHash,
} from "../utils/formatUtils";
import { getTokenTypeName } from "../utils/pairUtils";
import { CONSTANTS } from "../constants/addresses";

interface HistoryData {
  sender: string;
  lpCoinId: string;
  pairId: string;
  transactionHash: string;
  token0Type: { name: string };
  token1Type: { name: string };
  amount0: string;
  amount1: string;
  liquidity: string;
  totalSupply: string;
  timestamp: string;
  type: string;
}

export default function RemoveLiquidityPage() {
  // State management
  const [selectedPercentage, setSelectedPercentage] = useState<number>(100);
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [lpBalances, setLpBalances] = useState<any[]>([]);
  const [selectedLpBalance, setSelectedLpBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [expectedAmounts, setExpectedAmounts] = useState({
    amount0: "0",
    amount1: "0",
  });
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyView, setHistoryView] = useState(false);

  // Hooks
  const { account, connected } = useWallet();

  //const suiClient = useSuiClient();
  const { signAndExecuteTransactionBlock } = useWallet();


  // Get pair information
  const { pairExists, currentPairId, reserves, checkPairExistence,loadingPair: isPairLoading } = usePair(
    token0,
    token1
  );

  

  // Token change handlers
  const handleToken0Change = useCallback((newToken: Token | null) => {
    setToken0(newToken);
    resetState();
  }, []);

  const handleToken1Change = useCallback((newToken: Token | null) => {
    setToken1(newToken);
    resetState();
  }, []);

  const resetState = () => {
    setLpBalances([]);
    setSelectedLpBalance("0");
    setExpectedAmounts({
      amount0: "0",
      amount1: "0",
    });
  };

  // Function to swap token positions
  const handleSwapTokens = () => {
    const tempToken = token0;
    handleToken0Change(token1);
    handleToken1Change(tempToken);
  };

  // Get token balances
  const { balance0, balance1, fetchBalances } = useTokenBalances(
    token0,
    token1
  );

  // Refresh balances
  useEffect(() => {
    fetchBalances();
  }, [token0, token1]);
  
  // Fetch transaction history
  useEffect(() => {
    if (!currentPairId) return;

    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const response = await fetch(
          `https://dexback-mu.vercel.app/api/lpcoin/pair/${currentPairId}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch history");
        }

        const data = await response.json();
        setHistoryData(Array.isArray(data) ? data : data.data || []);
      } catch (error) {
        console.error("Error fetching history:", error);
        setHistoryData([]);
      } finally {
        setIsHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [currentPairId]);

  // Calculate expected amounts based on percentage
  useEffect(() => {
    if (!pairExists || !token0 || !token1 || selectedLpBalance === "0") return;

    try {
      const lpBalance = BigInt(selectedLpBalance);
      const percentage = BigInt(selectedPercentage);
      const selectedLp = (lpBalance * percentage) / 100n;

      if (selectedLp === 0n) {
        setExpectedAmounts({ amount0: "0", amount1: "0" });
        return;
      }

      const reserve0 = BigInt(reserves.reserve0);
      const reserve1 = BigInt(reserves.reserve1);

      // For this simplified calculation we assume the LP token supply is proportional
      // to the reserves. In a real implementation, you might need the actual total supply.
      const estimatedAmount0 = (selectedLp * reserve0) / lpBalance;
      const estimatedAmount1 = (selectedLp * reserve1) / lpBalance;

      setExpectedAmounts({
        amount0: formatTokenAmount(
          estimatedAmount0.toString(),
          token0.decimals
        ),
        amount1: formatTokenAmount(
          estimatedAmount1.toString(),
          token1.decimals
        ),
      });
    } catch (error) {
      console.error("Error calculating expected amounts:", error);
      setExpectedAmounts({ amount0: "0", amount1: "0" });
    }
  }, [
    selectedPercentage,
    reserves,
    selectedLpBalance,
    token0,
    token1,
    pairExists,
  ]);

  // Function to find LP tokens
  const findLPTokens = async () => {
    if (!token0 || !token1 || !account?.address) return;
    setIsLoading(true);
    console.log("\n--- Starting LP Token Search ---");

    try {
      const [token0Obj, token1Obj] = await Promise.all([
        suiClient.getObject({ id: token0.id, options: { showType: true } }),
        suiClient.getObject({ id: token1.id, options: { showType: true } }),
      ]);

      const token0Type = token0Obj.data?.type
        ? getBaseType(token0Obj.data.type)
        : "";
      const token1Type = token1Obj.data?.type
        ? getBaseType(token1Obj.data.type)
        : "";

      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        options: {
          showType: true,
          showContent: true,
          showDisplay: true,
        },
      });

      const lpTokens = objects.data
        .filter((obj) => {
          // First check if it's from our package
          if (
            !obj.data?.type ||
            !obj.data.type.includes(CONSTANTS.PACKAGE_ID)
          ) {
            return false;
          }

          // Then check if it's an LP token
          if (!obj.data.type.includes("::pair::LPCoin<")) {
            return false;
          }

          const typeString = obj.data.type;
          const lpTokenTypes = typeString?.match(/LPCoin<(.+),\s*(.+)>/) || [];
          if (!lpTokenTypes) {
            console.log("No LP token types found in string");
            return false;
          }

          const [, lpType0, lpType1] = lpTokenTypes;
          const normalizedLpType0 = getBaseType(lpType0.trim());
          const normalizedLpType1 = getBaseType(
            lpType1.trim().replace(">", "")
          );

          // Match with token types
          return (
            (normalizedLpType0 === token0Type &&
              normalizedLpType1 === token1Type) ||
            (normalizedLpType0 === token1Type &&
              normalizedLpType1 === token0Type)
          );
        })
        .map((obj) => {
          if (!obj.data?.type || !obj.data?.objectId) return null;

          let balance = "0";
          if (
            obj.data?.content &&
            typeof obj.data.content === "object" &&
            "fields" in obj.data.content &&
            obj.data.content.fields &&
            typeof obj.data.content.fields === "object" &&
            "balance" in obj.data.content.fields
          ) {
            balance = obj.data.content.fields.balance as string;
          }

          return {
            id: obj.data.objectId,
            type: obj.data.type,
            metadata: {
              name: "LPCoin",
              symbol: "LP",
            },
            balance,
          };
        })
        .filter(Boolean);

      const totalBalance = lpTokens
        .filter((token) => token !== null)
        .reduce((sum, token) => sum + BigInt(token.balance || 0), 0n);

      setLpBalances(lpTokens);
      setSelectedLpBalance(totalBalance.toString());

      if (lpTokens.length > 0) {
        await checkPairExistence();
      }
    } catch (error) {
      console.error("Error finding LP tokens:", error);
      toast.error("Error loading LP tokens");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    findLPTokens();
  }, [token0, token1, account?.address, suiClient]);

  const handleRemoveLiquidity = async () => {
    if (!account?.address || lpBalances.length === 0) {
      toast.error("Please select a pair with LP tokens");
      return;
    }
  
    setIsLoading(true);
    const toastId = toast.loading("Processing transaction...");
  
    try {
      // Filter for LP tokens from our program
      const latestProgramLP = lpBalances.filter((coin) =>
        coin.type.includes(CONSTANTS.PACKAGE_ID)
      );
  
      if (latestProgramLP.length === 0) {
        throw new Error("No LP tokens found for this program");
      }
  
      // Sort coins by balance (largest first)
      const sortedCoins = [...latestProgramLP].sort((a, b) => {
        return Number(BigInt(b.balance || "0") - BigInt(a.balance || "0"));
      });
  
      // Calculate total available LP
      const totalAvailableLp = latestProgramLP.reduce(
        (sum, coin) => sum + BigInt(coin.balance || "0"),
        0n
      );
  
      // Calculate target LP burn amount
      let targetAmount: bigint =
        selectedPercentage === 100
          ? totalAvailableLp
          : (totalAvailableLp * BigInt(selectedPercentage)) / 100n;
  
      if (targetAmount === 0n || targetAmount > totalAvailableLp) {
        toast.error("Invalid amount to remove");
        return;
      }
  
      const tx = new Transaction();
      const biggestCoin = sortedCoins[0];
      const biggestCoinBalance = BigInt(biggestCoin.balance || "0");
  
      console.log("Initial LP Details:", {
        totalAvailable: totalAvailableLp.toString(),
        targetAmount: targetAmount.toString(),
        selectedPercentage,
        biggestCoinBalance: biggestCoinBalance.toString(),
      });
  
      let coinToUse;
      let burnAmount;
  
      // Handle single LP token or merge multiple
      if (biggestCoinBalance >= targetAmount) {
        console.log("Using single coin strategy");
        const primaryCoinObject = tx.object(biggestCoin.id);
  
        coinToUse =
          selectedPercentage === 100
            ? primaryCoinObject
            : tx.splitCoins(primaryCoinObject, [
                tx.pure.u64(targetAmount.toString()),
              ]);
  
        burnAmount = targetAmount;
      } else {
        console.log("Using merge strategy");
        let remainingTarget = targetAmount;
        const coinsNeeded = [];
  
        for (const coin of sortedCoins) {
          if (remainingTarget <= 0n) break;
          const coinBalance = BigInt(coin.balance || "0");
          coinsNeeded.push(coin.id);
          remainingTarget -= coinBalance;
        }
  
        if (remainingTarget > 0n) {
          throw new Error("Not enough LP tokens to reach target amount");
        }
  
        const primaryCoin = tx.object(coinsNeeded[0]);
        if (coinsNeeded.length > 1) {
          const otherCoins = coinsNeeded.slice(1).map((id) => tx.object(id));
          tx.mergeCoins(primaryCoin, otherCoins);
        }
        coinToUse = primaryCoin;
        burnAmount = targetAmount;
      }
  
      const vectorArg = tx.makeMoveVec({
        elements: [coinToUse],
      });
  
      if (!currentPairId) {
        throw new Error("No valid liquidity pair found.");
      }
  
      // Get LP token types first - we'll use this to get the correct order
      const response = await suiClient.getObject({
        id: biggestCoin.id,
        options: { showType: true },
      });
  
      if (!response?.data?.type) {
        throw new Error("Failed to retrieve LP token type.");
      }
  
      const lpTokenTypes = response.data.type.match(/LPCoin<(.+),\s*(.+)>/);
      if (!lpTokenTypes) {
        throw new Error("Invalid LP token format.");
      }
  
      let [, type0, type1] = lpTokenTypes;
      type0 = getBaseType(type0.trim());
      type1 = getBaseType(type1.trim().replace(">", ""));
  
      // Set min amounts to zero to prevent ERR_INSUFFICIENT_B_AMOUNT (303)
      const minAmount0 = "0";
      const minAmount1 = "0";
  
      // Set deadline in milliseconds
      const currentTimestamp = Date.now();
      const deadline = currentTimestamp + 10 * 60 * 1000; // 10 minutes
  
      console.log("Transaction params:", {
        currentTimestampMs: currentTimestamp,
        deadlineMs: deadline,
        burnAmount: burnAmount.toString(),
        minAmount0,
        minAmount1,
        type0,
        type1,
      });
  
      tx.moveCall({
        target: `${CONSTANTS.PACKAGE_ID}::${CONSTANTS.MODULES.ROUTER}::remove_liquidity`,
        typeArguments: [type0, type1],
        arguments: [
          tx.object(CONSTANTS.ROUTER_ID),
          tx.object(CONSTANTS.FACTORY_ID),
          tx.object(currentPairId),
          vectorArg,
          tx.pure.u256(burnAmount.toString()),
          tx.pure.u256(minAmount0),
          tx.pure.u256(minAmount1),
          tx.pure.u64(deadline),
        ],
      });
  
      // Execute transaction with a single wallet approval
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: tx as any,
        requestType: "WaitForLocalExecution",
        options: {
          showEffects: true,
        },
      });
  
      console.log("Transaction result:", result);
      
      // Check for errors in the result
      if (result.effects?.status?.error) {
        throw new Error(`Transaction failed: ${result.effects.status.error}`);
      }
  
      toast.update(toastId, {
        render: "LP removed successfully!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });
  
      // Refresh LP balances
      await findLPTokens();
    } catch (error: any) {
      console.error("Handler Error:", error);
      toast.update(toastId, {
        render: error.message,
        type: "error", 
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setIsLoading(false);
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
    <>
      <StyledToastContainer />
      <div className="min-h-screen w-full flex flex-col items-center py-8">
        <motion.div
          className="w-[95%] max-w-xl mb-8"
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
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 pointer-events-none"></div>

            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-gray-800/30">
              <div className="flex justify-between items-center">
                <motion.h1
                  className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent"
                  variants={itemVariants}
                >
                  Remove Liquidity
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
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 rounded-xl mb-5 border ${
                      pairExists
                        ? "bg-indigo-900/20 border-indigo-500/40"
                        : "bg-yellow-900/20 border-yellow-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex items-center justify-center w-6 h-6 rounded-full ${
                            pairExists
                              ? "bg-green-500/20 text-green-500"
                              : "bg-yellow-500/20 text-yellow-500"
                          }`}
                        >
  {isPairLoading ? "⏳" : pairExists ? "✓" : "⚠"}
                        </span>
                        <div>
                        {isPairLoading ? (
            <p className="text-sm font-medium text-green-400">Checking LP Pair...</p>
        ) : (
            <p className="text-sm font-medium">
                {pairExists ? "LP Tokens Found" : "No LP Tokens"}
            </p>
        )}
        {currentPairId && !isPairLoading && (
            <p className="text-xs text-gray-500">
                ID: {currentPairId?.slice(0, 8)}...{currentPairId?.slice(-6)}
            </p>
        )}
                        </div>
                      </div>
                      {pairExists && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500 mb-1">
                            LP Balance
                          </p>
                          <p className="text-sm font-medium text-cyan-400">
                            {formatTokenAmount(selectedLpBalance, 9)}
                          </p>
                        </div>
                      )}
                    </div>

                    {pairExists && reserves.reserve0 !== "0" && (
                      <div className="mt-3 pt-3 border-t border-indigo-500/20">
                        <p className="text-xs text-gray-500 mb-2">
                          Pool Reserves
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs">
                              {token0?.symbol?.charAt(0) || "T"}
                            </div>
                            <span className="text-sm">
                              {token0 &&
                                formatTokenAmount(
                                  reserves.reserve0,
                                  token0.decimals
                                )}{" "}
                              {token0?.symbol || ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs">
                              {token1?.symbol?.charAt(0) || "T"}
                            </div>
                            <span className="text-sm">
                              {token1 &&
                                formatTokenAmount(
                                  reserves.reserve1,
                                  token1.decimals
                                )}{" "}
                              {token1?.symbol || ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Token Selection */}
              <motion.div variants={itemVariants} className="mb-6">
                <div className="flex flex-col">
                  {/* First Token */}
                  <div className="flex-1 min-h-[120px] flex flex-col justify-between">
                    <label className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                      <span>First Token</span>
                    </label>
                    <div className="py-2">
                      <TokenSelector
                        selectedToken={token0}
                        label="Token 0"
                        onSelect={handleToken0Change}
                        amount=""
                        onAmountChange={() => {}}
                        balance={balance0}
                        showInput={false}
                      />
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={handleSwapTokens}
                      className="p-3 rounded-full border border-indigo-500/30 bg-indigo-800/30 hover:bg-indigo-700/40 transition-all duration-200 transform hover:scale-110 shadow-lg shadow-indigo-500/20"
                    >
                      <ArrowDownUp className="w-5 h-5 text-indigo-300" />
                    </button>
                  </div>

                  {/* Second Token */}
                  <div className="flex-1 min-h-[120px] flex flex-col justify-between">
                    <label className="text-sm font-medium text-gray-400 flex items-center">
                      <span>Second Token</span>
                    </label>
                    <div className="py-2">
                      <TokenSelector
                        selectedToken={token1}
                        label="Token 1"
                        onSelect={handleToken1Change}
                        amount=""
                        onAmountChange={() => {}}
                        balance={balance1}
                        showInput={false}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Percentage Selector */}
              {pairExists && (
                <motion.div
                  variants={itemVariants}
                  className="mb-6 bg-gray-900/40 backdrop-blur-sm p-6 rounded-2xl border border-indigo-500/20"
                >
                  <div className="text-center mb-6">
                    <span className="text-gray-400 text-sm">
                      Amount to Remove
                    </span>
                    <div className="text-white text-5xl font-bold mt-2">
                      {selectedPercentage}%
                    </div>
                  </div>

                  <div className="mb-6">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={selectedPercentage}
                      onChange={(e) =>
                        setSelectedPercentage(Number(e.target.value))
                      }
                      className="w-full appearance-none bg-transparent cursor-pointer 
                      [&::-webkit-slider-runnable-track]:h-2 
                      [&::-webkit-slider-runnable-track]:rounded-full 
                      [&::-webkit-slider-thumb]:appearance-none 
                      [&::-webkit-slider-thumb]:-mt-2.5 
                      [&::-webkit-slider-thumb]:h-6 
                      [&::-webkit-slider-thumb]:w-6 
                      [&::-webkit-slider-thumb]:rounded-full 
                      [&::-webkit-slider-thumb]:bg-indigo-500"
                      style={{
                        background: `linear-gradient(to right, rgb(99, 102, 241) 0%, rgb(99, 102, 241) ${selectedPercentage}%, rgb(55, 65, 81) ${selectedPercentage}%, rgb(55, 65, 81) 100%)`,
                        borderRadius: "9999px",
                      }}
                    />
                  </div>

                  <div className="flex justify-center mb-6">
                    <div className="relative w-1/2 max-w-[150px]">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={selectedPercentage}
                        onChange={(e) => {
                          const value =
                            e.target.value === "" ? 1 : Number(e.target.value);
                          if (value >= 1 && value <= 100) {
                            setSelectedPercentage(value);
                          }
                        }}
                        className="w-full px-4 py-2 bg-gray-800/60 text-white rounded-lg border border-indigo-500/30 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none text-center"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[25, 50, 75, 100].map((value) => (
                      <button
                        key={value}
                        onClick={() => setSelectedPercentage(value)}
                        className={`py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          selectedPercentage === value
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-gray-800/60 text-gray-300 hover:bg-indigo-700/40"
                        }`}
                      >
                        {value === 100 ? "Max" : `${value}%`}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Expected Amounts */}
              {pairExists && selectedPercentage > 0 && (
                <motion.div
                  variants={itemVariants}
                  className="mb-6 p-4 bg-indigo-900/20 rounded-xl border border-indigo-500/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-medium text-gray-300">
                      Expected Output
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs">
                          {token0?.symbol?.charAt(0) || "T"}
                        </div>
                        <span className="text-gray-300 text-sm">
                          {token0?.symbol || "Token 0"}
                        </span>
                      </div>
                      <span className="font-medium text-white">
                        {expectedAmounts.amount0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs">
                          {token1?.symbol?.charAt(0) || "T"}
                        </div>
                        <span className="text-gray-300 text-sm">
                          {token1?.symbol || "Token 1"}
                        </span>
                      </div>
                      <span className="font-medium text-white">
                        {expectedAmounts.amount1}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-indigo-500/20 text-xs text-gray-400">
                      <div className="flex justify-between items-center">
                        <span>Minimum received (after slippage):</span>
                        <span>
                          {(
                            parseFloat(expectedAmounts.amount0) *
                            (1 - slippage / 100)
                          ).toFixed(6)}{" "}
                          {token0?.symbol || ""} /{" "}
                          {(
                            parseFloat(expectedAmounts.amount1) *
                            (1 - slippage / 100)
                          ).toFixed(6)}{" "}
                          {token1?.symbol || ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Remove Liquidity Button */}
              <motion.div variants={itemVariants}>
                <button
                  onClick={handleRemoveLiquidity}
                  disabled={
                    isLoading || !pairExists || selectedPercentage === 0
                  }
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100 disabled:cursor-not-allowed shadow-lg hover:shadow-indigo-500/30 disabled:shadow-none"
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
                      Removing Liquidity...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <Droplet className="w-5 h-5" />
                      Remove Liquidity
                    </div>
                  )}
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Transaction History Panel */}
        {currentPairId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-[95%] max-w-4xl mb-8"
          >
            <div className="bg-gray-900/30 backdrop-blur-xl rounded-2xl shadow-xl border border-indigo-500/20 overflow-hidden">
              <div className="p-4 border-b border-gray-800/50 flex justify-between items-center">
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent">
                  Transaction History
                </h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setHistoryView(false)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      !historyView
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800/70 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    Recent
                  </button>
                  <button
                    onClick={() => setHistoryView(true)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      historyView
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800/70 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {isHistoryLoading ? (
                <div className="p-8 flex justify-center items-center">
                  <div className="flex items-center space-x-4">
                    <svg
                      className="animate-spin h-8 w-8 text-indigo-500"
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
                    <span className="text-indigo-300 text-lg">
                      Loading transaction history...
                    </span>
                  </div>
                </div>
              ) : historyData.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-900/30 mb-4">
                    <Info className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">
                    No transaction history found
                  </h3>
                  <p className="text-gray-400">
                    This trading pair doesn't have any transaction records yet.
                  </p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-800/50 sticky top-0 z-10">
                      <tr className="text-center text-sm text-indigo-300">
                        <th className="p-4">Type</th>
                        <th className="p-4">LP Coin ID</th>
                        <th className="p-4">Tx Digest</th>
                        <th className="p-4">Token0</th>
                        <th className="p-4">Token1</th>
                        <th className="p-4">Amount0</th>
                        <th className="p-4">Amount1</th>
                        {historyView && (
                          <>
                            <th className="p-4">Liquidity</th>
                            <th className="p-4">Total Supply</th>
                            <th className="p-4">Sender</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((entry, index) => {
                        // Determine token decimals (using 9 as default if not available)
                        const token0Decimals = token0?.decimals || 9;
                        const token1Decimals = token1?.decimals || 9;

                        // Function to get clean token name
                        const cleanTokenName = (name: string): string => {
                          if (!name) return "N/A";
                          return name.includes("::")
                            ? name.split("::").pop()?.replace(/>$/, "") || "N/A"
                            : name;
                        };

                        return (
                          <tr
                            key={index}
                            className="border-t border-gray-800/40 hover:bg-indigo-900/10 transition-colors"
                          >
                            <td className="p-4">
                              <span
                                className={`px-2 py-1 rounded-full text-xs ${
                                  entry.type?.includes("AddLiquidity")
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-purple-500/20 text-purple-400"
                                }`}
                              >
                                {cleanTokenName(entry.type)}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-xs text-gray-300">
                              {entry.lpCoinId ? (
                                <div className="flex items-center">
                                  <Link className="w-4 h-4 text-cyan-400 mr-2" />
                                  <a
                                    href={`https://suiscan.xyz/object/${entry.lpCoinId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:underline"
                                  >
                                    {formatHash(entry.lpCoinId)}
                                  </a>
                                </div>
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="p-4 font-mono text-xs text-gray-300">
                              {entry.transactionHash ? (
                                <div className="flex items-center">
                                  <Link className="w-4 h-4 text-cyan-400 mr-2" />
                                  <a
                                    href={`https://suiscan.xyz/transaction/${entry.transactionHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-400 hover:underline"
                                  >
                                    {formatHash(entry.transactionHash)}
                                  </a>
                                </div>
                              ) : (
                                "N/A"
                              )}
                            </td>
                            <td className="p-4 text-sm">
                              {cleanTokenName(entry.token0Type?.name)}
                            </td>
                            <td className="p-4 text-sm">
                              {cleanTokenName(entry.token1Type?.name)}
                            </td>
                            <td className="p-4 text-sm text-center">
                              {formatLargeNumber(entry.amount0)}
                            </td>
                            <td className="p-4 text-sm text-center">
                              {formatLargeNumber(entry.amount1)}
                            </td>
                            {historyView && (
                              <>
                                <td className="p-4 text-sm text-right">
                                  {formatLargeNumber(entry.liquidity)}
                                </td>
                                <td className="p-4 text-sm text-right">
                                  {formatLargeNumber(entry.totalSupply)}
                                </td>
                                <td className="p-4 font-mono text-xs text-gray-300">
                                  {entry.sender ? (
                                    <div className="flex items-center">
                                      <Wallet className="w-4 h-4 text-cyan-400 mr-2" />
                                      <a
                                        href={`https://suiscan.xyz/address/${entry.sender}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-cyan-400 hover:underline"
                                      >
                                        {formatHash(entry.sender)}
                                      </a>
                                    </div>
                                  ) : (
                                    "N/A"
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </>
  );
}
