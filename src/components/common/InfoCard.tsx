import React from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Activity } from "lucide-react";
import { Token } from "../../utils/tokenUtils";
import { formatTokenAmount } from "../../utils/formatUtils";
import { PairReserves } from "../../utils/pairUtils";
import { usePair } from "../../hooks/usePair";

interface InfoCardProps {
  token0: Token | null;
  token1: Token | null;
  pairExists: boolean;
  currentPairId: string | null;
  reserves: PairReserves;
  priceRate0: string | null;
  priceRate1: string | null;
  isRefreshing?: boolean;
  variant?: "swap" | "liquidity";
  className?: string;
  showPriceInfo?: boolean;
  estimatedOutput?: number | null;
  slippage?: number;
}



const InfoCard: React.FC<InfoCardProps> = ({
  token0,
  token1,
  pairExists,
  currentPairId,
  reserves,
  priceRate0,
  priceRate1,
  isRefreshing = false,
  variant = "swap",
  className = "",
  showPriceInfo = true,
  estimatedOutput = null,
  slippage = 0.5,
}) => {
  if (!token0 || !token1) return null;

  

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-4 rounded-xl mb-5 border ${
        pairExists
          ? "bg-indigo-900/20 border-indigo-500/40"
          : "bg-yellow-900/20 border-yellow-500/30"
      } ${className}`}
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
            {pairExists ? "✓" : "⚠"}
          </span>
          <div>
            <p className="text-sm font-medium">
              {pairExists
                ? variant === "swap"
                  ? "Trading Pair Active"
                  : "Pool Information"
                : "New Trading Pair"}
            </p>
            {currentPairId && (
              <p className="text-xs text-gray-500">
                ID: {currentPairId.slice(0, 8)}...
                {currentPairId.slice(-6)}
              </p>
            )}
          </div>
        </div>

        {pairExists && reserves.reserve0 !== "0" && (
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Pool Reserves</p>
            <p className="text-sm font-medium">
              {token0
                ? formatTokenAmount(reserves.reserve0, token0.decimals)
                : "0"}{" "}
              {token0?.symbol} /{" "}
              {token1
                ? formatTokenAmount(reserves.reserve1, token1.decimals)
                : "0"}{" "}
              {token1?.symbol}
            </p>
          </div>
        )}
      </div>

      {/* Exchange Rates & Price Info */}
      {pairExists && showPriceInfo && (
        <div>
          {priceRate0 && priceRate1 && (
            <div className="mt-3 pt-3 border-t border-indigo-500/20 text-xs text-gray-400 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  1 {token0?.symbol} = {parseFloat(priceRate0).toFixed(4)}{" "}
                  {token1?.symbol}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  1 {token1?.symbol} = {parseFloat(priceRate1).toFixed(4)}{" "}
                  {token0?.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Swap-specific additional info */}
          {variant === "swap" && estimatedOutput !== null && (
            <div className="mt-3 pt-3 border-t border-indigo-500/20 space-y-2">
              <div className="flex justify-between text-sm text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Price Impact:
                </span>
                <span className="text-green-400">
                  {(0.003 * 100).toFixed(2)}%
                </span>
              </div>

              <div className="flex justify-between text-sm text-gray-300">
                <span>Minimum received after slippage:</span>
                <span className="font-medium text-white">
                  {(estimatedOutput * (1 - slippage / 100)).toFixed(6)}{" "}
                  <span className="text-indigo-300">{token1?.symbol}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default InfoCard;
