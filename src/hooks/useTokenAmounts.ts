/**
 * Custom hook for managing token amounts in swap and liquidity forms
 */
import { useState, useEffect, useCallback } from "react";
import { Token } from "../utils/tokenUtils";
import { PairReserves } from "../utils/pairUtils";
import {
  calculateSuggestedLiquidityAmount,
  calculateEstimatedOutput,
} from "../utils/pairUtils";

export function useTokenAmounts(
  token0: Token | null,
  token1: Token | null,
  reserves: PairReserves,
  pairExists: boolean,
  mode: "swap" | "liquidity" = "swap"
) {
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [priceRate0, setPriceRate0] = useState<string | null>(null);
  const [priceRate1, setPriceRate1] = useState<string | null>(null);
  const [suggestedAmount1, setSuggestedAmount1] = useState<string | null>(null);
  const [estimatedOutput, setEstimatedOutput] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle user input for token0 amount
  const handleAmount0Change = useCallback(
    (value: string) => {
      setAmount0(value);

      if (mode === "swap") {
        // For swap mode, calculate estimated output
        if (value && pairExists && token0 && token1) {
          const result = calculateEstimatedOutput(
            value,
            reserves,
            token0,
            token1,
            pairExists
          );

          setEstimatedOutput(result.estimatedOutput);
          setError(result.error);

          if (result.estimatedOutput !== null) {
            setAmount1(result.estimatedOutput.toFixed(6));
          } else {
            setAmount1("");
          }
        } else {
          setEstimatedOutput(null);
          setError(null);
          setAmount1("");
        }
      } else {
        // For liquidity mode, calculate suggested amount based on reserves ratio
        if (value && pairExists && token0 && token1) {
          const suggestedAmount = calculateSuggestedLiquidityAmount(
            value,
            token0,
            token1,
            reserves,
            pairExists
          );

          if (suggestedAmount) {
            setSuggestedAmount1(suggestedAmount);
            setAmount1(suggestedAmount);
          } else {
            setSuggestedAmount1(null);
          }
        } else {
          setSuggestedAmount1(null);
        }
      }
    },
    [mode, pairExists, reserves, token0, token1]
  );

  // Handle user input for token1 amount
  const handleAmount1Change = useCallback((value: string) => {
    setAmount1(value);
    // For liquidity mode, we allow direct editing of both inputs
    // For swap mode, amount1 is calculated based on amount0
  }, []);

  // Reset amounts when tokens change
  useEffect(() => {
    setAmount0("");
    setAmount1("");
    setEstimatedOutput(null);
    setError(null);
    setSuggestedAmount1(null);
  }, [token0, token1]);

  // Calculate price rates when reserves change
  useEffect(() => {
    if (
      reserves.reserve0 === "0" ||
      reserves.reserve1 === "0" ||
      !token0 ||
      !token1
    ) {
      setPriceRate0(null);
      setPriceRate1(null);
      return;
    }

    try {
      // Convert reserves to their actual values considering decimals
      const reserve0Actual =
        Number(reserves.reserve0) / Math.pow(10, token0.decimals);
      const reserve1Actual =
        Number(reserves.reserve1) / Math.pow(10, token1.decimals);

      // Calculate price rates (1 token0 = X token1 and vice versa)
      const rate0 = (reserve1Actual / reserve0Actual).toFixed(6);
      const rate1 = (reserve0Actual / reserve1Actual).toFixed(6);

      setPriceRate0(rate0);
      setPriceRate1(rate1);
    } catch (error) {
      console.error("Error calculating price rates:", error);
      setPriceRate0(null);
      setPriceRate1(null);
    }
  }, [reserves, token0, token1]);

  // Calculate suggested amount when amount0 or price rate changes
  useEffect(() => {
    if (amount0 && priceRate0 && reserves.reserve0 !== "0") {
      const suggested = (Number(amount0) * Number(priceRate0)).toFixed(6);
      setSuggestedAmount1(suggested);
    } else {
      setSuggestedAmount1(null);
    }
  }, [amount0, priceRate0, reserves.reserve0]);

  return {
    amount0,
    amount1,
    priceRate0,
    priceRate1,
    suggestedAmount1,
    estimatedOutput,
    error,
    setAmount0: handleAmount0Change,
    setAmount1: handleAmount1Change,
    resetAmounts: () => {
      setAmount0("");
      setAmount1("");
      setEstimatedOutput(null);
      setError(null);
    },
  };
}
