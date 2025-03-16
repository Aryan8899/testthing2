/**
 * Utilities for working with trading pairs
 */
import { Token } from "./tokenUtils";

export interface PairReserves {
  reserve0: string;
  reserve1: string;
  timestamp: number;
}

export interface PairInfo {
  pairId: string | null;
  exists: boolean;
  reserves: PairReserves;
  token0Type?: string;
  token1Type?: string;
}

export interface LPEvent {
  type: string;
  sender: string;
  lpCoinId: string;
  token0Type: { name: string } | string;
  token1Type: { name: string } | string;
  amount0: string;
  amount1: string;
  liquidity: string;
  totalSupply: string;
  timestamp?: number;
}

/**
 * Calculate price rates based on reserves
 * @returns [priceRate0, priceRate1] or [null, null] if calculation fails
 */
export function calculatePriceRates(
  reserves: PairReserves,
  token0: Token | null,
  token1: Token | null
): [string | null, string | null] {
  if (
    reserves.reserve0 === "0" ||
    reserves.reserve1 === "0" ||
    !token0 ||
    !token1
  ) {
    return [null, null];
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

    return [rate0, rate1];
  } catch (error) {
    console.error("Error calculating price rates:", error);
    return [null, null];
  }
}

/**
 * Calculate suggested liquidity amount based on reserves ratio
 */
export function calculateSuggestedLiquidityAmount(
  amount: string,
  token0: Token | null,
  token1: Token | null,
  reserves: PairReserves,
  pairExists: boolean
): string | null {
  if (
    !pairExists ||
    !amount ||
    !token0 ||
    !token1 ||
    reserves.reserve0 === "0" ||
    reserves.reserve1 === "0"
  ) {
    return null;
  }

  try {
    // Convert reserves to their actual values considering decimals
    const reserve0Actual =
      Number(reserves.reserve0) / Math.pow(10, token0.decimals);
    const reserve1Actual =
      Number(reserves.reserve1) / Math.pow(10, token1.decimals);

    // Calculate the ratio and suggested amount
    const ratio = reserve1Actual / reserve0Actual;
    const suggestedAmount = parseFloat(amount) * ratio;

    return suggestedAmount.toFixed(6);
  } catch (error) {
    console.error("Error calculating suggested amount:", error);
    return null;
  }
}

/**
 * Calculate estimated output for a swap
 */
export function calculateEstimatedOutput(
  amount0: string,
  reserves: PairReserves,
  token0: Token | null,
  token1: Token | null,
  pairExists: boolean
): { estimatedOutput: number | null; error: string | null } {
  if (
    !pairExists ||
    !amount0 ||
    !reserves.reserve0 ||
    !reserves.reserve1 ||
    !token0 ||
    !token1
  ) {
    return { estimatedOutput: null, error: null };
  }

  try {
    const BASIS_POINTS = 10000n;
    const TOTAL_FEE = 30n; // 0.3% fee
    const scaledAmount0 = BigInt(
      Math.floor(parseFloat(amount0) * Math.pow(10, token0.decimals))
    );
    const reserveIn = BigInt(reserves.reserve0);
    const reserveOut = BigInt(reserves.reserve1);

    if (scaledAmount0 >= reserveIn) {
      return {
        estimatedOutput: null,
        error: "Amount exceeds available liquidity",
      };
    }

    const amountInWithFee = scaledAmount0 * (BASIS_POINTS - TOTAL_FEE);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * BASIS_POINTS;
    const amountOut = numerator / denominator;
    const scaledOutput = Number(amountOut) / Math.pow(10, token1.decimals);

    return {
      estimatedOutput: scaledOutput,
      error: null,
    };
  } catch (error: any) {
    console.error("Error calculating output:", error);
    return {
      estimatedOutput: null,
      error: error.message,
    };
  }
}

/**
 * Get token type name safely from various formats
 */
export const getTokenTypeName = (
  tokenType: { name: string } | string | undefined
): string => {
  if (!tokenType) return "N/A";

  if (typeof tokenType === "string") {
    return tokenType.includes("::")
      ? tokenType.split("::").pop() || "N/A"
      : tokenType;
  }

  if (typeof tokenType === "object" && "name" in tokenType) {
    if (!tokenType.name || tokenType.name.trim() === "") return "Unknown Token"; // Handle empty names
    return tokenType.name.includes("::")
      ? tokenType.name.split("::").pop() || "N/A"
      : tokenType.name;
  }

  return "N/A";
};
