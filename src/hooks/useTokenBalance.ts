// useTokenBalance.ts - Updated with resource management
import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@suiet/wallet-kit";
import {
  Token,
  fetchAllCoins,
  calculateTotalBalance,
  getCoinType,
} from "../utils/tokenUtils";
import { formatBalance } from "../utils/formatUtils";
import { advancedSuiClient } from "../utils/advancedSuiClient";
import toast from "../utils/CustomToast";

// Create a global request controller for balance fetches
const balanceRequestsInProgress = new Map<string, Promise<string>>();

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
        return await balanceRequestsInProgress.get(requestKey);
      } catch (err) {
        // If the existing request fails, we'll try again
        console.warn("Previous balance request failed, retrying:", err);
      }
    }

    // Throttle repeated fetches for the same token
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < 5000) {
      // 5 seconds
      return balance; // Return current balance without fetching
    }

    // Mark as loading only if we're really making a new request
    if (isMounted.current) {
      setIsLoading(true);
      setError(null);
    }

    // Create the promise for this balance fetch
    const fetchPromise = (async () => {
      try {
        lastFetchTime.current = Date.now();

        // Get coin type for this token
        const coinType = await getCoinType(token.id);

        if (!coinType) {
          throw new Error("Failed to get coin type");
        }

        // Fetch all coins of this type
        const coins = await fetchAllCoins(account.address, coinType);

        // Calculate total balance
        const totalBalance = calculateTotalBalance(coins);

        // Format balance for display
        const formattedBalance = formatBalance(totalBalance, token.decimals);

        // Update state if component still mounted
        if (isMounted.current) {
          setBalance(formattedBalance);
          setError(null);
        }

        return formattedBalance;
      } catch (error: any) {
        console.error(`Error fetching balance:`, error);

        // Only update error state if still mounted
        if (isMounted.current) {
          setError(error.message || "Failed to fetch balance");

          // Show toast for resource errors
          if (
            error.message?.includes("INSUFFICIENT_RESOURCES") ||
            error.message?.includes("Failed to fetch")
          ) {
            toast.warning(
              "Network resource limitations detected. Some operations may be delayed.",
              { autoClose: 3000 }
            );
          }
        }

        return balance; // Return current balance on error
      } finally {
        // Clear loading state and remove from in-progress map
        if (isMounted.current) {
          setIsLoading(false);
        }

        // Remove from in-progress after a small delay to prevent immediate duplicate requests
        setTimeout(() => {
          balanceRequestsInProgress.delete(requestKey);
        }, 100);
      }
    })();

    // Store the promise in our tracking map
    balanceRequestsInProgress.set(requestKey, fetchPromise);

    return fetchPromise;
  }, [token?.id, token?.decimals, account?.address, balance]);

  // Fetch balance on token change with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (token) {
      timeoutId = setTimeout(() => {
        fetchBalance();
      }, 300); // Debounce for 300ms
    } else {
      setBalance("0");
    }

    // Set up polling for balance updates with longer interval and jitter
    // to prevent all clients hitting the API at once
    const jitter = Math.floor(Math.random() * 5000); // Random delay 0-5s
    const intervalId = setInterval(() => {
      if (token) {
        fetchBalance();
      }
    }, 20000 + jitter); // 20-25s interval with jitter

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [token, fetchBalance]);

  return { balance, isLoading, error, fetchBalance };
}

export function useTokenBalances(token0: Token | null, token1: Token | null) {
  const [balance0, setBalance0] = useState("0");
  const [balance1, setBalance1] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { account } = useWallet();
  const isMounted = useRef(true);
  const lastFetchTime = useRef<number>(0);

  // Clear the ref when unmounting
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!account?.address) {
      setBalance0("0");
      setBalance1("0");
      return;
    }

    // Simple throttling for repeated calls
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime.current;
    if (timeSinceLastFetch < 5000) {
      // 5 seconds
      return; // Skip fetch if called too frequently
    }

    lastFetchTime.current = now;

    if (isMounted.current) {
      setIsLoading(true);
      setError(null);
    }

    // Use separate try/catch for each token to allow partial success
    let errors = [];

    // Fetch token0 balance
    if (token0?.id) {
      try {
        // Get unique requestKey for this token
        const requestKey = `${account.address}-${token0.id}`;

        // Reuse existing request if one is in progress
        if (balanceRequestsInProgress.has(requestKey)) {
          const balance = await balanceRequestsInProgress.get(requestKey);
          if (isMounted.current) {
            setBalance0(balance || "0");
          }
        } else {
          // Create new balance fetch promise
          const fetchPromise = (async () => {
            try {
              const coinType = await getCoinType(token0.id);

              if (!coinType) {
                throw new Error("Failed to get coin type for token0");
              }

              const coins = await fetchAllCoins(account.address, coinType);
              const totalBalance = calculateTotalBalance(coins);
              const formattedBalance = formatBalance(
                totalBalance,
                token0.decimals
              );

              // Update state if component still mounted
              if (isMounted.current) {
                setBalance0(formattedBalance);
              }

              return formattedBalance;
            } catch (err) {
              console.error("Error fetching token0 balance:", err);
              errors.push(err);
              return "0";
            } finally {
              // Remove from in-progress after a delay
              setTimeout(() => {
                balanceRequestsInProgress.delete(requestKey);
              }, 100);
            }
          })();

          // Store the promise for potential reuse
          balanceRequestsInProgress.set(requestKey, fetchPromise);
          await fetchPromise;
        }
      } catch (err) {
        console.error("Error in token0 balance fetch:", err);
        errors.push(err);
      }
    } else {
      setBalance0("0");
    }

    // Fetch token1 balance after a small delay
    if (token1?.id) {
      try {
        // Add a small delay between tokens to avoid overloading the network
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get unique requestKey for this token
        const requestKey = `${account.address}-${token1.id}`;

        // Reuse existing request if one is in progress
        if (balanceRequestsInProgress.has(requestKey)) {
          const balance = await balanceRequestsInProgress.get(requestKey);
          if (isMounted.current) {
            setBalance1(balance || "0");
          }
        } else {
          // Create new balance fetch promise
          const fetchPromise = (async () => {
            try {
              const coinType = await getCoinType(token1.id);

              if (!coinType) {
                throw new Error("Failed to get coin type for token1");
              }

              const coins = await fetchAllCoins(account.address, coinType);
              const totalBalance = calculateTotalBalance(coins);
              const formattedBalance = formatBalance(
                totalBalance,
                token1.decimals
              );

              // Update state if component still mounted
              if (isMounted.current) {
                setBalance1(formattedBalance);
              }

              return formattedBalance;
            } catch (err) {
              console.error("Error fetching token1 balance:", err);
              errors.push(err);
              return "0";
            } finally {
              // Remove from in-progress after a delay
              setTimeout(() => {
                balanceRequestsInProgress.delete(requestKey);
              }, 100);
            }
          })();

          // Store the promise for potential reuse
          balanceRequestsInProgress.set(requestKey, fetchPromise);
          await fetchPromise;
        }
      } catch (err) {
        console.error("Error in token1 balance fetch:", err);
        errors.push(err);
      }
    } else {
      setBalance1("0");
    }

    // Handle errors
    if (errors.length > 0) {
      // Only show resource errors to avoid spamming the user
      const resourceError = errors.find(
        (err: any) =>
          err.message?.includes("INSUFFICIENT_RESOURCES") ||
          err.message?.includes("Failed to fetch")
      );

      if (resourceError && isMounted.current) {
        setError("Network resource limitations detected");

        toast.warning(
          "Network congestion detected. Some operations may be delayed.",
          { autoClose: 3000 }
        );
      }
    } else if (isMounted.current) {
      setError(null);
    }

    if (isMounted.current) {
      setIsLoading(false);
    }
  }, [token0, token1, account?.address]);

  // Fetch balances on tokens change with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (token0 || token1) {
      timeoutId = setTimeout(() => {
        fetchBalances();
      }, 300); // Debounce for 300ms
    }

    // Set up polling with jitter
    const jitter = Math.floor(Math.random() * 5000); // 0-5s random jitter
    const intervalId = setInterval(() => {
      if (token0 || token1) {
        fetchBalances();
      }
    }, 30000 + jitter); // 30-35s interval with jitter

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [token0, token1, fetchBalances]);

  return { balance0, balance1, isLoading, error, fetchBalances };
}
