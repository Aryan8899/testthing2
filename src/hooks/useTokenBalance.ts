/**
 * Custom hook for fetching and managing token balances
 */
import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { SuiClient } from "@mysten/sui.js/client";
import {
  Token,
  getBaseType,
  fetchAllCoins,
  calculateTotalBalance,
} from "../utils/tokenUtils";
import { formatBalance } from "../utils/formatUtils";

export function useTokenBalance(token: Token | null) {
  const [balance, setBalance] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  // Get wallet connection
  const { account } = useWallet();
  const suiClient = new SuiClient({ url: "https://fullnode.devnet.sui.io/" });

  const fetchBalance = useCallback(async () => {
    if (!token?.id || !account?.address) return "0";

    setIsLoading(true);

    try {
      // Get token type to find all objects of this type
      const tokenObj = await suiClient.getObject({
        id: token.id,
        options: { showType: true },
      });

      const fullType = tokenObj.data?.type || "";
      const coinTypeMatch = fullType.match(/<(.+)>/);
      const coinType = coinTypeMatch ? coinTypeMatch[1] : "";

      if (!coinType) return "0";

      // Fetch all coins using UTXO model approach
      const coins = await fetchAllCoins(suiClient, account.address, coinType);
      const totalBalance = calculateTotalBalance(coins);

      // Format balance for display
      const formattedBalance = formatBalance(totalBalance, token.decimals);
      setBalance(formattedBalance);
      return formattedBalance;
    } catch (error) {
      console.error(`Error fetching balance:`, error);
      return "0";
    } finally {
      setIsLoading(false);
    }
  }, [token?.id, token?.decimals, account?.address, suiClient]);

  // Fetch balance on token change
  useEffect(() => {
    if (token) {
      fetchBalance();
    } else {
      setBalance("0");
    }

    // Set up polling for balance updates
    const intervalId = setInterval(() => {
      if (token) {
        fetchBalance();
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(intervalId);
  }, [token, fetchBalance]);

  return { balance, isLoading, fetchBalance };
}

export function useTokenBalances(token0: Token | null, token1: Token | null) {
  const [balance0, setBalance0] = useState("0");
  const [balance1, setBalance1] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const { account } = useWallet();
  const suiClient = new SuiClient({ url: "https://fullnode.devnet.sui.io/" });


  const fetchBalances = useCallback(async () => {
    if (!account?.address) {
      setBalance0("0");
      setBalance1("0");
      return;
    }

    setIsLoading(true);

    try {
      // Fetch balance for token0
      if (token0?.id) {
        const tokenObj = await suiClient.getObject({
          id: token0.id,
          options: { showType: true },
        });

        const fullType = tokenObj.data?.type || "";
        const coinTypeMatch = fullType.match(/<(.+)>/);
        const coinType = coinTypeMatch ? coinTypeMatch[1] : "";

        if (coinType) {
          const coins = await fetchAllCoins(
            suiClient,
            account.address,
            coinType
          );
          const totalBalance = calculateTotalBalance(coins);
          const formattedBalance = formatBalance(totalBalance, token0.decimals);
          setBalance0(formattedBalance);
        }
      } else {
        setBalance0("0");
      }

      // Fetch balance for token1
      if (token1?.id) {
        const tokenObj = await suiClient.getObject({
          id: token1.id,
          options: { showType: true },
        });

        const fullType = tokenObj.data?.type || "";
        const coinTypeMatch = fullType.match(/<(.+)>/);
        const coinType = coinTypeMatch ? coinTypeMatch[1] : "";

        if (coinType) {
          const coins = await fetchAllCoins(
            suiClient,
            account.address,
            coinType
          );
          const totalBalance = calculateTotalBalance(coins);
          const formattedBalance = formatBalance(totalBalance, token1.decimals);
          setBalance1(formattedBalance);
        }
      } else {
        setBalance1("0");
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
    } finally {
      setIsLoading(false);
    }
  }, [token0, token1, account?.address, suiClient]);

  // Fetch balances on tokens change
  useEffect(() => {
    fetchBalances();

    // Set up polling for balance updates
    const intervalId = setInterval(fetchBalances, 10000); // Every 10 seconds

    return () => clearInterval(intervalId);
  }, [token0, token1, fetchBalances]);

  return { balance0, balance1, isLoading, fetchBalances };
}
