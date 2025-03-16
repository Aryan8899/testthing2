/**
 * Shared utilities for formatting values
 */

/**
 * Format token amount with appropriate decimals for display
 */
export const formatTokenAmount = (amount: string, decimals: number): string => {
  if (!amount) return "0";
  const formattedAmount = Number(amount) / Math.pow(10, decimals);
  return formattedAmount.toFixed(Math.min(decimals, 6));
};

/**
 * Format balance for display with proper decimal places
 */
export function formatBalance(balance: string, decimals: number): string {
  try {
    if (!balance || balance === "0") {
      return "0.000";
    }

    const numericBalance = BigInt(balance);
    const divisor = BigInt(10 ** decimals);

    // Integer division for whole part
    const wholePart = numericBalance / divisor;

    // Modulo for fractional part
    const fractionalPart = numericBalance % divisor;

    // Scale fractional part to proper decimal places (up to 4)
    const maxDecimals = Math.min(decimals, 3);
    const scalingFactor = BigInt(10 ** maxDecimals);
    const scaledFractional = (fractionalPart * scalingFactor) / divisor;

    // Format with appropriate decimal places
    return `${wholePart}.${scaledFractional
      .toString()
      .padStart(maxDecimals, "0")}`;
  } catch (error) {
    console.error("Error formatting balance:", error);
    return "0.000";
  }
}

/**
 * Format a hash or address for display by showing only first and last few characters
 */
export const formatHash = (
  hash: string,
  prefixLength = 6,
  suffixLength = 4
): string => {
  if (!hash) return "N/A";
  if (hash.length <= prefixLength + suffixLength) return hash;
  return `${hash.slice(0, prefixLength)}...${hash.slice(-suffixLength)}`;
};

/**
 * Format large number for display with commas and without decimals
 */
export const formatLargeNumber = (value: string): string => {
  if (!value) return "0";

  try {
    const num = BigInt(value);
    return num.toLocaleString("en-US").replace(/\.\d+$/, "");
  } catch (e) {
    return Number(value).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  }
};

/**
 * Format a date to a readable string
 */
export const formatDate = (timestamp: number): string => {
  // Convert from seconds to milliseconds if needed
  const milliseconds = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
  return new Date(milliseconds).toLocaleString();
};
