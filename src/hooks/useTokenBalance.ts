// useTokenBalance.ts - Improved with parallel fetching
import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@suiet/wallet-kit";
import {
  Token,
  fetchAllCoins,
  calculateTotalBalance,
  getCoinType,
  normalizeToken,
} from "../utils/tokenUtils";
import { formatBalance } from "../utils/formatUtils";
import { advancedSuiClient } from "../utils/advancedSuiClient";
import toast from "../utils/CustomToast";

// Create a global request controller for balance fetches
const balanceRequestsInProgress = new Map<string, Promise<string>>();

// Cache for coin types to avoid repeated lookups
const coinTypeCache = new Map<string, string>();

// Helper function to fetch a single token's balance
async function fetchTokenBalance(
  token: Token,
  accountAddress: string,
  isMounted: React.MutableRefObject<boolean>
): Promise<string> {
  if (!token?.id || !accountAddress) return "0";

  // Generate a unique key for this token balance request
  const requestKey = `${accountAddress}-${token.id}`;

  // Check if we already have a request in progress
  if (balanceRequestsInProgress.has(requestKey)) {
    try {
      return (await balanceRequestsInProgress.get(requestKey)) || "0";
    } catch (err) {
      console.warn("Previous balance request failed, retrying:", err);
    }
  }

  // Create the promise for this balance fetch
  const fetchPromise = (async () => {
    try {
      // Check if we have the coin type cached
      let coinType = coinTypeCache.get(token.id);

      // If not cached, fetch and cache it
      if (!coinType) {
        coinType = await getCoinType(token.id);
        if (coinType) {
          coinTypeCache.set(token.id, coinType);
        }
      }

      if (!coinType) {
        throw new Error(`Failed to get coin type for ${token.id}`);
      }

      // Fetch all coins of this type
      const coins = await fetchAllCoins(accountAddress, coinType);

      // Calculate total balance
      const totalBalance = calculateTotalBalance(coins);

      // Format balance for display
      const formattedBalance = formatBalance(totalBalance, token.decimals);

      return formattedBalance;
    } catch (error: any) {
      console.error(`Error fetching balance for ${token.id}:`, error);
      return "0"; // Return zero on error
    } finally {
      // Remove from in-progress after a small delay
      setTimeout(() => {
        balanceRequestsInProgress.delete(requestKey);
      }, 100);
    }
  })();

  // Store the promise in our tracking map
  balanceRequestsInProgress.set(requestKey, fetchPromise);

  return fetchPromise;
}

export function useTokenBalances(token0: Token | null, token1: Token | null) {
  const [balance0, setBalance0] = useState("0");
  const [balance1, setBalance1] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { account } = useWallet();
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);
  const fetchInProgress = useRef(false);

  // Clear the ref when unmounting
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!account?.address || fetchInProgress.current) {
      return;
    }

    // Lighter throttling - 2 seconds instead of 5
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < 2000) {
      // Reduced from 5000ms to 2000ms
      return;
    }

    lastFetchTime.current = now;
    fetchInProgress.current = true;

    if (isMounted.current) {
      setIsLoading(true);
      setError(null);
    }

    try {
      // Fetch both token balances in parallel
      const promises = [];

      if (token0) {
        promises.push(
          fetchTokenBalance(normalizeToken(token0), account.address, isMounted)
            .then((balance) => {
              if (isMounted.current) {
                setBalance0(balance);
              }
              return balance;
            })
            .catch((err) => {
              console.error("Error fetching token0 balance:", err);
              return "0";
            })
        );
      } else {
        setBalance0("0");
      }

      if (token1) {
        promises.push(
          fetchTokenBalance(normalizeToken(token1), account.address, isMounted)
            .then((balance) => {
              if (isMounted.current) {
                setBalance1(balance);
              }
              return balance;
            })
            .catch((err) => {
              console.error("Error fetching token1 balance:", err);
              return "0";
            })
        );
      } else {
        setBalance1("0");
      }

      // Wait for all fetches to complete
      await Promise.all(promises);
    } catch (err: any) {
      console.error("Error fetching token balances:", err);

      // Only update error state if still mounted
      if (isMounted.current) {
        setError(err.message || "Failed to fetch balances");

        // Show toast for resource errors
        if (
          err.message?.includes("INSUFFICIENT_RESOURCES") ||
          err.message?.includes("Failed to fetch")
        ) {
          toast.warning(
            "Network resource limitations detected. Some operations may be delayed.",
            { autoClose: 3000 }
          );
        }
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
      fetchInProgress.current = false;
    }
  }, [token0, token1, account?.address]);

  // Fetch balances on tokens change with reduced debouncing (200ms instead of 300ms)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (token0 || token1) {
      timeoutId = setTimeout(() => {
        fetchBalances();
      }, 200); // Reduced from 300ms to 200ms
    } else {
      // Reset balances when no tokens are selected
      setBalance0("0");
      setBalance1("0");
    }

    // Set up polling with reduced interval and jitter
    const jitter = Math.floor(Math.random() * 3000); // Reduced from 5000ms to 3000ms
    const intervalId = setInterval(() => {
      if (token0 || token1) {
        fetchBalances();
      }
    }, 20000 + jitter); // Reduced from 30000ms to 20000ms

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [token0, token1, fetchBalances]);

  return { balance0, balance1, isLoading, error, fetchBalances };
}

// For backward compatibility, keep the single token hook
export function useTokenBalance(token: Token | null) {
  const [balance, setBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { account } = useWallet();
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);

  // Clear the request tracking when unmounting
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchBalance = useCallback(async () => {
    if (!token?.id || !account?.address) return "0";

    // Generate a unique key for this token balance request
    const requestKey = `${account.address}-${token.id}`;

    // Check if we already have a request in progress
    if (balanceRequestsInProgress.has(requestKey)) {
      try {
        return (await balanceRequestsInProgress.get(requestKey)) || "0";
      } catch (err) {
        console.warn("Previous balance request failed, retrying:", err);
      }
    }

    // Throttle repeated fetches for the same token (reduced from 5s to 2s)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < 2000) {
      return balance;
    }

    if (isMounted.current) {
      setIsLoading(true);
      setError(null);
    }

    lastFetchTime.current = now;

    try {
      const result = await fetchTokenBalance(
        normalizeToken(token),
        account.address,
        isMounted
      );

      if (isMounted.current) {
        setBalance(result);
        setError(null);
      }

      return result;
    } catch (error: any) {
      console.error(`Error fetching balance:`, error);

      if (isMounted.current) {
        setError(error.message || "Failed to fetch balance");
      }

      return balance;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [token, account?.address, balance]);

  // Fetch balance on token change with reduced debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (token) {
      timeoutId = setTimeout(() => {
        fetchBalance();
      }, 200); // Reduced from 300ms to 200ms
    } else {
      setBalance("0");
    }

    // Set up polling for balance updates with reduced interval
    const jitter = Math.floor(Math.random() * 3000); // Reduced from 5000ms
    const intervalId = setInterval(() => {
      if (token) {
        fetchBalance();
      }
    }, 15000 + jitter); // Reduced from 20000ms to 15000ms

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [token, fetchBalance]);

  return { balance, isLoading, error, fetchBalance };
}
