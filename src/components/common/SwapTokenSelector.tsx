import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowDownUp } from "lucide-react";
import { useWallet } from "@suiet/wallet-kit";
import { suiClient } from "../../utils/suiClient";
import {
  Token,
  getBaseType,
  fetchAllCoins,
  calculateTotalBalance,
} from "../../utils/tokenUtils";
import { formatBalance } from "../../utils/formatUtils";
import TokenSelector from "./TokenSelector";

interface SwapTokenSelectorProps {
  token0: Token | null;
  token1: Token | null;
  amount0: string;
  amount1: string;
  onSwapTokens: () => void;
  onAmount0Change: (value: string) => void;
  onAmount1Change: (value: string) => void;
  onToken0Select: (token: Token | null) => void;
  onToken1Select: (token: Token | null) => void;
  showInput?: boolean;
  pairExists?: boolean; // Add this prop
}

const SwapTokenSelector: React.FC<SwapTokenSelectorProps> = ({
  token0,
  token1,
  amount0,
  amount1,
  onSwapTokens,
  onAmount0Change,
  onAmount1Change,
  onToken0Select,
  onToken1Select,
  showInput = true,
  pairExists = false, // Added param with default value
}) => {
  const [balance0, setBalance0] = useState("0");
  const [balance1, setBalance1] = useState("0");
  const { account } = useWallet();

  

  // Memoize event handlers to prevent unnecessary re-renders
  const handleSwapTokens = useCallback(() => {
    onSwapTokens();
  }, [onSwapTokens]);

  // Enhanced token balance fetching with aggregation across all objects
  useEffect(() => {
    let isMounted = true;
    let balanceInterval: NodeJS.Timeout | null = null;

    const fetchAggregatedBalance = async (
      token: Token | null,
      setBalance: (val: string) => void
    ) => {
      if (!token?.id || !account?.address || !isMounted) return;

      try {
        // Get token type to find all objects of this type
        const tokenObj = await suiClient.getObject({
          id: token.id,
          options: { showType: true, showContent: true },
        });

        if (!isMounted) return;

        if (!tokenObj.data?.type) {
          setBalance("0.00");
          return;
        }

        const typeString = tokenObj.data.type;
        const coinTypeMatch = typeString.match(/<(.+)>/);
        if (!coinTypeMatch) {
          setBalance("0.00");
          return;
        }

        const coinType = coinTypeMatch[1];

        // Get all coins of this type and aggregate their balances
        const coins = await fetchAllCoins(suiClient, account.address, coinType);

        if (!isMounted) return;

        // Calculate total balance
        const totalBalance = calculateTotalBalance(coins);

        // Format balance with proper decimal places
        const formattedBalance = formatBalance(totalBalance, token.decimals);
        setBalance(formattedBalance);
      } catch (error) {
        console.error("Error fetching aggregated balance:", error);
        if (isMounted) setBalance("0.00");
      }
    };

    // Initial balance fetch
    const fetchInitialBalances = async () => {
      if (token0) await fetchAggregatedBalance(token0, setBalance0);
      if (token1) await fetchAggregatedBalance(token1, setBalance1);
    };

    // Small timeout to let UI render first
    const timeoutId = setTimeout(fetchInitialBalances, 100);

    // Setup polling for balance updates
    if (token0 || token1) {
      balanceInterval = setInterval(() => {
        if (token0) fetchAggregatedBalance(token0, setBalance0);
        if (token1) fetchAggregatedBalance(token1, setBalance1);
      }, 10000); // Every 10 seconds
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (balanceInterval) clearInterval(balanceInterval);
    };
  }, [token0, token1, account?.address, suiClient]);

  // Animation variants
  const swapButtonVariants = {
    hover: {
      scale: 1.1,
      rotate: 180,
      transition: { type: "spring", stiffness: 400, damping: 10 },
    },
    tap: { scale: 0.9 },
  };

  // Use memo to prevent unnecessary re-renders of stable JSX
  const memoizedSwapButton = useMemo(
    () => (
      <div className="relative h-12 flex justify-center items-center">
        <div className="absolute inset-0 flex justify-center items-center">
          <div className="border-t border-gray-700/50 w-full"></div>
        </div>
        <motion.button
          whileHover="hover"
          whileTap="tap"
          variants={swapButtonVariants}
          onClick={handleSwapTokens}
          className="relative z-10 bg-indigo-900/50 backdrop-blur-lg text-indigo-300 rounded-full p-3 border border-indigo-500/40 shadow-lg hover:shadow-indigo-500/30 hover:border-indigo-400/50 transition-colors"
          aria-label="Swap tokens"
        >
          <ArrowDownUp className="w-5 h-5" />
        </motion.button>
      </div>
    ),
    [handleSwapTokens]
  );

  return (
    <div className="space-y-2">
      {/* Input token */}
      <TokenSelector
        selectedToken={token0}
        amount={amount0}
        onAmountChange={onAmount0Change}
        onSelect={onToken0Select}
        balance={balance0}
        isInput={true}
        showInput={!!(showInput && token0 && token1 && pairExists)}
        label="You Pay"
        selectedToken1={token1}
      />

      {/* Swap button */}
      {memoizedSwapButton}

      {/* Output token */}
      <TokenSelector
        selectedToken={token1}
        amount={amount1}
        onAmountChange={onAmount1Change}
        onSelect={onToken1Select}
        balance={balance1}
        isInput={false}
        showInput={!!(showInput && token0 && token1 && pairExists)}
        label="You Receive"
      />
    </div>
  );
};

export default SwapTokenSelector;
