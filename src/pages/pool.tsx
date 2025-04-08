import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@suiet/wallet-kit";
import { motion, AnimatePresence } from "framer-motion";
import SimpleBar from "simplebar-react";
import "simplebar/dist/simplebar.min.css";
import toast, { StyledToastContainer } from "../utils/CustomToast";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  PlusCircle,
  MinusCircle,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  BarChart3,
  Clock,
  Link,
  Wallet,
  ArrowRightLeft,
  PieChart,
  Filter,
} from "lucide-react";

// Import advanced SUI client for blockchain interactions
import { advancedSuiClient } from "../utils/advancedSuiClient";

// Define interfaces for event data
interface PoolEventData {
  poolId?: string;
  token0Type?: string;
  token1Type?: string;
  feeTier?: string;
  creator?: string;
  [key: string]: any; // Allow for additional properties
}

interface LPEventData {
  lpCoinId?: string;
  pairId?: string;
  token0Type?: { name: string } | string;
  token1Type?: { name: string } | string;
  amount0?: string;
  amount1?: string;
  liquidity?: string;
  totalSupply?: string;
  type?: string;
  [key: string]: any; // Allow for additional properties
}

// Define interfaces for component data
interface Pool {
  pair: string;
  chain: string;
  version: string;
  feeTier: string;
  apr: {
    current: string;
    previous: string;
  };
  tvl: string;
  volume24h: string;
  poolType: string;
  tokens: string[];
  pairId: string; // Added to store the actual pair ID
}

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

interface Position {
  id: string;
  pairId: string;
  token0: {
    name: string;
    amount: string;
    decimals: number;
  };
  token1: {
    name: string;
    amount: string;
    decimals: number;
  };
  liquidity: string;
  feeTier: string;
  apr: string;
  createdAt: string;
  valueUSD: string;
}

// Interface for pool details
interface PoolDetail {
  apr: string;
  prevApr: string;
  tvl: string;
  volume24h: string;
}

// Helper components
const Spinner = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
  </div>
);

// Get token name without module prefix
const getTokenName = (fullName: string): string => {
  if (!fullName) return "N/A";
  return fullName.includes("::")
    ? fullName.split("::").pop() || fullName
    : fullName;
};

// Format transaction hash for display
const formatHash = (hash: string): string => {
  if (!hash) return "N/A";
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

// Format number with commas and specified decimal places
const formatNumber = (value: string | number, decimals: number = 2): string => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num)
    ? "0"
    : num.toLocaleString(undefined, {
        maximumFractionDigits: decimals,
      });
};

// Main component
const EnhancedPoolsInterface: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("history");
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [positionsData, setPositionsData] = useState<Position[]>([]);
  const [poolsData, setPoolsData] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPositions, setIsLoadingPositions] = useState(true);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { account, connected } = useWallet();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Function to fetch pools data from backend
  const fetchPoolsData = async () => {
    setIsLoadingPools(true);

    try {
      // Try to fetch pools from backend
      const response = await fetch("https://dexback-mu.vercel.app/api/pools");

      if (!response.ok) {
        throw new Error("Failed to fetch pools data from backend");
      }

      const poolsData = await response.json();
      setPoolsData(poolsData);

      if (!isInitialLoad) {
        toast.success("Successfully fetched pools data");
      }
    } catch (backendError) {
      console.error("Error fetching pools from backend:", backendError);

      // If backend fails, try to fetch from blockchain
      try {
        await fetchPoolsFromBlockchain();
      } catch (blockchainError) {
        console.error("Error fetching pools from blockchain:", blockchainError);
        setLoadError("Failed to load pools data. Please try again later.");

        if (!isInitialLoad) {
          toast.error("Failed to fetch pools data");
        }
      }
    } finally {
      setIsLoadingPools(false);
    }
  };

  // Fetch pools data directly from blockchain
  const fetchPoolsFromBlockchain = async () => {
    try {
      // Reset any previous circuit breakers to ensure clean connection
      advancedSuiClient.resetCircuitBreaker();

      // Get all pools from the DEX module
      const poolsResult = await advancedSuiClient.queryEvents({
        query: {
          MoveEventType: "0x2::dex::PoolCreatedEvent",
        },
        limit: 50,
        order: "descending",
      });

      // Map the blockchain data to our Pool interface
      const pools: Pool[] = await Promise.all(
        poolsResult.data.map(async (event) => {
          // Fix: Add type assertion for eventData
          const eventData = event.parsedJson as PoolEventData;

          // Get additional pool information such as reserves, APR, etc.
          const poolInfo = await fetchPoolDetailFromBlockchain(
            eventData.poolId || ""
          );

          return {
            pair: `${getTokenName(eventData.token0Type || "")} / ${getTokenName(
              eventData.token1Type || ""
            )}`,
            chain: "SUI BLOCKCHAIN",
            version: "V1",
            feeTier: eventData.feeTier ? `${eventData.feeTier}%` : "0.03%",
            apr: {
              current: poolInfo.apr || "0.00%",
              previous: poolInfo.prevApr || "0.00%",
            },
            tvl: poolInfo.tvl ? `$ ${formatNumber(poolInfo.tvl)}` : "$ 0.00",
            volume24h: poolInfo.volume24h
              ? `$ ${formatNumber(poolInfo.volume24h)}`
              : "$ 0.00",
            poolType: "v1",
            tokens: [
              getTokenName(eventData.token0Type || ""),
              getTokenName(eventData.token1Type || ""),
            ],
            pairId: eventData.poolId || "",
          };
        })
      );

      setPoolsData(pools);
    } catch (error) {
      console.error("Error in fetchPoolsFromBlockchain:", error);
      throw error;
    }
  };

  // Helper function to fetch pool details from blockchain
  const fetchPoolDetailFromBlockchain = async (
    poolId: string
  ): Promise<PoolDetail> => {
    try {
      // Fetch object data from the blockchain
      const poolObject = await advancedSuiClient.getObject({
        id: poolId,
        options: {
          showContent: true,
          showDisplay: true,
        },
      });

      if (!poolObject.data || !poolObject.data.content) {
        return {
          apr: "0.00%",
          prevApr: "0.00%",
          tvl: "0.00",
          volume24h: "0.00",
        };
      }

      // Extract the content from the pool object
      const content = poolObject.data.content;

      // Here we would process the actual pool data to calculate these metrics
      // For now, we just return placeholder data as we need to implement the actual logic
      // based on your specific DEX implementation

      // In a real implementation, you would calculate:
      // 1. Current APR based on fees and rewards
      // 2. Previous APR for comparison
      // 3. TVL based on token reserves and prices
      // 4. 24h volume from the pool events

      return {
        apr: "12.34%", // This would be calculated
        prevApr: "11.20%", // This would be calculated
        tvl: "24500.50", // This would be calculated
        volume24h: "5670.25", // This would be calculated
      };
    } catch (error) {
      console.error("Error fetching pool detail:", error);
      return {
        apr: "0.00%",
        prevApr: "0.00%",
        tvl: "0.00",
        volume24h: "0.00",
      };
    }
  };

  // Fetch history data
  const fetchHistoryData = async () => {
    if (!account?.address) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setRefreshing(true);

    try {
      const response = await fetch(
        `https://dexback-mu.vercel.app/api/lpcoin/${account.address}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }

      const data = await response.json();
      setHistoryData(data);

      if (data.length > 0 && !isInitialLoad) {
        toast.success("Successfully fetched transaction history");
      }
    } catch (backendError) {
      console.error("Error fetching history from backend:", backendError);

      // If backend fails, try to fetch from blockchain
      try {
        const blockchainHistoryData = await fetchHistoryFromBlockchain();
        setHistoryData(blockchainHistoryData);

        if (blockchainHistoryData.length > 0 && !isInitialLoad) {
          toast.success(
            "Successfully fetched transaction history from blockchain"
          );
        }
      } catch (blockchainError) {
        console.error(
          "Error fetching history from blockchain:",
          blockchainError
        );
        setLoadError(
          "Failed to load transaction history. Please try again later."
        );

        if (!isInitialLoad) {
          toast.error("Failed to fetch transaction history");
        }
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setIsInitialLoad(false);
    }
  };

  // Function to fetch history data from blockchain
  const fetchHistoryFromBlockchain = async (): Promise<HistoryData[]> => {
    if (!account?.address) {
      return [];
    }

    try {
      // Reset any circuit breakers
      advancedSuiClient.resetCircuitBreaker();

      // Query all LP events for the current user
      const eventsResult = await advancedSuiClient.queryEvents({
        query: {
          MoveEventType: "0x2::dex::LiquidityEvent",
          Sender: account.address,
        },
        limit: 50,
        order: "descending",
      });

      // Map the blockchain events to our HistoryData interface
      const historyItems: HistoryData[] = eventsResult.data.map((event) => {
        // Fix: Add type assertion for eventData
        const eventData = event.parsedJson as LPEventData;

        // Get token type names with null checks
        const token0Name =
          typeof eventData.token0Type === "string"
            ? eventData.token0Type
            : eventData.token0Type?.name || "";

        const token1Name =
          typeof eventData.token1Type === "string"
            ? eventData.token1Type
            : eventData.token1Type?.name || "";

        return {
          sender: event.sender,
          lpCoinId: eventData.lpCoinId || "",
          pairId: eventData.pairId || "",
          transactionHash: event.id.txDigest,
          token0Type: { name: token0Name },
          token1Type: { name: token1Name },
          amount0: eventData.amount0 || "0",
          amount1: eventData.amount1 || "0",
          liquidity: eventData.liquidity || "0",
          totalSupply: eventData.totalSupply || "0",
          timestamp: new Date(Number(event.timestampMs)).toISOString(),
          type: event.type,
        };
      });

      return historyItems;
    } catch (error) {
      console.error("Error fetching history from blockchain:", error);
      throw error;
    }
  };

  // Fetch positions data
  const fetchPositionsData = async () => {
    if (!account?.address) {
      setIsLoadingPositions(false);
      return;
    }

    setIsLoadingPositions(true);
    setRefreshing(true);

    try {
      // Try to fetch from backend first
      const response = await fetch(
        `https://dexback-mu.vercel.app/api/positions/${account.address}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch positions from backend");
      }

      const data = await response.json();
      setPositionsData(data);

      if (data.length > 0 && !isInitialLoad) {
        toast.success("Successfully fetched positions");
      }
    } catch (backendError) {
      console.error("Error fetching positions from backend:", backendError);

      // If backend fails, try to fetch from blockchain
      try {
        const blockchainPositionsData = await fetchPositionsFromBlockchain();
        setPositionsData(blockchainPositionsData);

        if (blockchainPositionsData.length > 0 && !isInitialLoad) {
          toast.success("Successfully fetched positions from blockchain");
        }
      } catch (blockchainError) {
        console.error(
          "Error fetching positions from blockchain:",
          blockchainError
        );
        setLoadError("Failed to load positions data. Please try again later.");

        if (!isInitialLoad) {
          toast.error("Failed to fetch positions");
        }
      }
    } finally {
      setIsLoadingPositions(false);
      setRefreshing(false);
    }
  };

  // Function to fetch positions from blockchain
  const fetchPositionsFromBlockchain = async (): Promise<Position[]> => {
    if (!account?.address) {
      return [];
    }

    try {
      // Reset circuit breaker to ensure clean connection
      advancedSuiClient.resetCircuitBreaker();

      // Get all LP coins owned by the user
      const ownedObjects = await advancedSuiClient.getOwnedObjects({
        owner: account.address,
        filter: {
          MatchAll: [{ StructType: "0x2::coin::Coin" }],
        },
        options: {
          showType: true,
          showContent: true,
          showDisplay: true,
        },
      });

      // Filter for LP tokens by looking at their types
      const lpTokens = ownedObjects.data.filter((obj) => {
        const type = obj.data?.type || "";
        return (
          type.includes("::LPCoin") || type.includes("::LiquidityProviderToken")
        );
      });

      // Process each LP token to get position details
      const positions = await Promise.all(
        lpTokens.map(async (token) => {
          try {
            // Extract token type and try to get pair information
            const type = token.data?.type || "";
            const content = token.data?.content || {};

            // Extract token types from the LP token type
            const tokenTypes = extractTokenTypesFromLPToken(type);

            // Get the pair ID from the LP token if available
            const pairId = extractPairIdFromLP(content);

            // Get position details
            const positionDetails = await getPositionDetailsFromBlockchain(
              token.data?.objectId || "",
              pairId
            );

            // Calculate USD value
            const valueUSD = calculateUSDValue(
              positionDetails.token0Amount,
              positionDetails.token1Amount,
              positionDetails.token0Price,
              positionDetails.token1Price
            );

            return {
              id: token.data?.objectId || "",
              pairId: pairId,
              token0: {
                name: tokenTypes.token0Name,
                amount: positionDetails.token0Amount,
                decimals: positionDetails.token0Decimals,
              },
              token1: {
                name: tokenTypes.token1Name,
                amount: positionDetails.token1Amount,
                decimals: positionDetails.token1Decimals,
              },
              liquidity: positionDetails.liquidity,
              feeTier: positionDetails.feeTier,
              apr: positionDetails.apr,
              createdAt: positionDetails.createdAt,
              valueUSD: `$ ${valueUSD}`,
            };
          } catch (error) {
            console.error("Error processing LP token:", error);
            return null;
          }
        })
      );

      // Fix: Filter out null values with type guard
      return positions.filter(
        (position): position is Position => position !== null
      );
    } catch (error) {
      console.error("Error in fetchPositionsFromBlockchain:", error);
      throw error;
    }
  };

  // Helper function to extract token types from LP token type
  const extractTokenTypesFromLPToken = (lpTokenType: string) => {
    // This depends on your specific DEX implementation
    // For example, if LP token type is "0x2::dex::LPCoin<0x2::sui::SUI, 0x2::usdc::USDC>"
    // then we need to extract the token types SUI and USDC

    try {
      // Default values
      let token0Name = "Token A";
      let token1Name = "Token B";

      // Try to extract from type string
      const typeMatch = lpTokenType.match(/<([^,]+),\s*([^>]+)>/);
      if (typeMatch && typeMatch.length >= 3) {
        token0Name = getTokenName(typeMatch[1]);
        token1Name = getTokenName(typeMatch[2]);
      }

      return { token0Name, token1Name };
    } catch (error) {
      console.error("Error extracting token types:", error);
      return { token0Name: "Token A", token1Name: "Token B" };
    }
  };

  // Helper function to extract pair ID from LP token content
  const extractPairIdFromLP = (content: any) => {
    // This depends on your specific DEX implementation
    // For example, if the LP token has a field for the pair ID
    try {
      // Look for common field names that might contain the pair ID
      if (content.fields?.pairId) {
        return content.fields.pairId;
      } else if (content.fields?.poolId) {
        return content.fields.poolId;
      } else {
        // Generate a placeholder ID if we can't find the actual one
        return "0x" + Math.random().toString(16).slice(2, 10);
      }
    } catch (error) {
      console.error("Error extracting pair ID:", error);
      return "0x" + Math.random().toString(16).slice(2, 10);
    }
  };

  // Interface for position details
  interface PositionDetails {
    token0Amount: string;
    token1Amount: string;
    token0Decimals: number;
    token1Decimals: number;
    token0Price: number;
    token1Price: number;
    liquidity: string;
    feeTier: string;
    apr: string;
    createdAt: string;
  }

  // Helper function to get position details from blockchain
  const getPositionDetailsFromBlockchain = async (
    lpTokenId: string,
    pairId: string
  ): Promise<PositionDetails> => {
    try {
      // Query the blockchain to get position details
      // This would involve calling your DEX's getter functions

      // For demonstration, we return placeholder data
      // In a real implementation, this would calculate the actual values
      return {
        token0Amount: (Math.random() * 1000).toFixed(6),
        token1Amount: (Math.random() * 100).toFixed(6),
        token0Decimals: 6,
        token1Decimals: 18,
        token0Price: 1.0, // USD price
        token1Price: 10.0, // USD price
        liquidity: (Math.random() * 10000).toFixed(2),
        feeTier: "0.03%",
        apr: (Math.random() * 100).toFixed(2) + "%",
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 86400000
        ).toISOString(),
      };
    } catch (error) {
      console.error("Error getting position details:", error);
      // Return default values on error
      return {
        token0Amount: "0",
        token1Amount: "0",
        token0Decimals: 6,
        token1Decimals: 18,
        token0Price: 1.0,
        token1Price: 1.0,
        liquidity: "0",
        feeTier: "0.03%",
        apr: "0.00%",
        createdAt: new Date().toISOString(),
      };
    }
  };

  // Helper function to calculate USD value of a position
  const calculateUSDValue = (
    token0Amount: string,
    token1Amount: string,
    token0Price: number,
    token1Price: number
  ) => {
    try {
      const amount0 = parseFloat(token0Amount);
      const amount1 = parseFloat(token1Amount);

      const value = amount0 * token0Price + amount1 * token1Price;
      return formatNumber(value);
    } catch (error) {
      console.error("Error calculating USD value:", error);
      return "0.00";
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (account?.address) {
      fetchHistoryData();
      fetchPositionsData();
    } else {
      setIsLoading(false);
      setIsLoadingPositions(false);
    }

    // Always fetch pools data regardless of wallet connection
    fetchPoolsData();
  }, [account?.address]);

  // Filter data based on search term
  const filteredHistoryData = useMemo(() => {
    if (!searchTerm.trim()) return historyData;

    const term = searchTerm.toLowerCase();
    return historyData.filter((entry) => {
      // Search in token types
      const token0 = getTokenName(entry.token0Type?.name || "").toLowerCase();
      const token1 = getTokenName(entry.token1Type?.name || "").toLowerCase();

      // Search in other fields
      return (
        token0.includes(term) ||
        token1.includes(term) ||
        entry.sender.toLowerCase().includes(term) ||
        entry.lpCoinId.toLowerCase().includes(term) ||
        entry.pairId.toLowerCase().includes(term) ||
        (entry.type && entry.type.toLowerCase().includes(term))
      );
    });
  }, [historyData, searchTerm]);

  // Filter pools based on search term
  const filteredPools = useMemo(() => {
    if (!searchTerm.trim()) return poolsData;

    const term = searchTerm.toLowerCase();
    return poolsData.filter((pool) => {
      return (
        pool.pair.toLowerCase().includes(term) ||
        pool.tokens.some((token) => token.toLowerCase().includes(term)) ||
        pool.poolType.toLowerCase().includes(term)
      );
    });
  }, [poolsData, searchTerm]);

  // Filter positions based on search term
  const filteredPositionsData = useMemo(() => {
    if (!searchTerm.trim()) return positionsData;

    const term = searchTerm.toLowerCase();
    return positionsData.filter((position) => {
      return (
        position.token0.name.toLowerCase().includes(term) ||
        position.token1.name.toLowerCase().includes(term) ||
        position.id.toLowerCase().includes(term) ||
        position.pairId.toLowerCase().includes(term)
      );
    });
  }, [positionsData, searchTerm]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
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

  const tableVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.3 },
    },
  };

  // Calculate time since a timestamp
  const getTimeSince = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  // Render empty state
  const renderEmptyState = (message: string) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center p-10 text-center bg-gray-800/20 rounded-xl border border-gray-700/30"
    >
      <AlertCircle className="w-12 h-12 text-gray-500 mb-3" />
      <p className="text-gray-400 mb-2">{message}</p>
      <p className="text-sm text-gray-500">
        {activeTab === "history"
          ? "Add liquidity to see your transactions here"
          : activeTab === "my-positions"
          ? "Add liquidity to see your positions here"
          : "Check back later for available pools"}
      </p>
      <button
        onClick={() => navigate("/addliquidity")}
        className="mt-4 px-4 py-2 bg-cyan-600/50 hover:bg-cyan-600/70 text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Add Liquidity</span>
      </button>
    </motion.div>
  );

  // Handle refreshing data
  const handleRefresh = () => {
    if (refreshing || !account?.address) return;

    // Reset any errors
    setLoadError(null);

    // Reset circuit breaker to ensure clean connection
    advancedSuiClient.resetCircuitBreaker();

    // Refresh all data sources
    fetchHistoryData();
    fetchPositionsData();
    fetchPoolsData();

    toast.info("Refreshing data...");
  };

  return (
    <>
      <StyledToastContainer />

      <motion.div
        className="min-h-screen text-white p-4"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          className="max-w-7xl mx-auto bg-gray-900/30 backdrop-blur-xl rounded-3xl p-6 border border-gray-700/50 shadow-lg hover:shadow-cyan-500/10 transition-all duration-500"
          variants={itemVariants}
        >
          {/* Header and Navigation */}
          <div className="mb-6">
            <motion.h1
              className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2"
              variants={itemVariants}
            >
              Liquidity Pools
            </motion.h1>
            <motion.p
              className="text-gray-400 text-sm sm:text-base"
              variants={itemVariants}
            >
              View pools, manage your positions, and track your liquidity
              history
            </motion.p>
          </div>

          {/* Network Error */}
          {loadError && (
            <motion.div
              variants={itemVariants}
              className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p>{loadError}</p>
              </div>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors text-sm"
              >
                Retry
              </button>
            </motion.div>
          )}

          {/* Navigation Tabs */}
          <motion.div
            variants={itemVariants}
            className="flex justify-center sm:justify-start mb-6 relative"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-1 flex w-full max-w-md flex-wrap sm:flex-nowrap">
              {["history", "all-pools", "my-positions"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-300 relative cursor-pointer ${
                    activeTab === tab
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-500/80 to-blue-500/80 rounded-lg -z-10"
                      layoutId="activeTab"
                      transition={{ type: "spring", duration: 0.5 }}
                    />
                  )}
                  <div className="flex items-center justify-center gap-2">
                    {tab === "history" && <Clock className="w-4 h-4" />}
                    {tab === "all-pools" && <BarChart3 className="w-4 h-4" />}
                    {tab === "my-positions" && <PieChart className="w-4 h-4" />}
                    <span>
                      {tab
                        .replace("-", " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase())}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Filters Row */}
          <motion.div
            className="flex flex-col sm:flex-row items-center gap-3 mb-5"
            variants={itemVariants}
          >
            {/* Search Input */}
            <div className="relative w-full sm:w-auto sm:max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={`Search ${
                  activeTab === "all-pools"
                    ? "pools"
                    : activeTab === "my-positions"
                    ? "positions"
                    : "transactions"
                }...`}
                className="w-full py-2 pl-10 pr-4 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-grow hidden sm:block"></div>

            {/* Action Buttons */}
            <div className="flex gap-3 w-full sm:w-auto justify-end mt-3 sm:mt-0">
              <button
                onClick={handleRefresh}
                disabled={refreshing || !account?.address}
                className={`p-2 rounded-xl ${
                  refreshing || !account?.address
                    ? "bg-gray-800/30 text-gray-500"
                    : "bg-gray-800/60 hover:bg-gray-700/60 text-gray-300"
                } transition-colors border border-gray-700/50 flex items-center justify-center ${
                  !account?.address ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                title={
                  account?.address
                    ? "Refresh data"
                    : "Connect wallet to refresh"
                }
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>

              <button
                onClick={() => navigate("/addliquidity")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Add Liquidity</span>
              </button>

              <button
                onClick={() => navigate("/removeliquidity")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer"
              >
                <MinusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Remove Liquidity</span>
              </button>
            </div>
          </motion.div>

          {/* Wallet Connection Notice */}
          {!account?.address && (
            <motion.div
              variants={itemVariants}
              className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl text-yellow-300 flex items-center gap-3"
            >
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div className="flex-1">
                <p>
                  Connect your wallet to view your personal transaction history
                  and positions.
                </p>
              </div>
              <button
                onClick={() => {
                  // Fix for TypeScript error with click() method
                  const connectWalletButton = document.querySelector(
                    '[data-testid="connect-wallet-button"]'
                  );
                  if (connectWalletButton instanceof HTMLElement) {
                    connectWalletButton.click();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 transition-colors text-sm"
              >
                Connect
              </button>
            </motion.div>
          )}

          {/* Data Tables */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tableVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative overflow-hidden rounded-xl border border-gray-700/50 bg-gray-800/20 backdrop-blur-sm"
            >
              {activeTab === "history" && isLoading ? (
                <Spinner />
              ) : activeTab === "my-positions" && isLoadingPositions ? (
                <Spinner />
              ) : activeTab === "all-pools" && isLoadingPools ? (
                <Spinner />
              ) : (
                <SimpleBar
                  style={{ maxHeight: "600px" }}
                  className="overflow-x-auto"
                >
                  {activeTab === "history" && (
                    <>
                      {filteredHistoryData.length > 0 ? (
                        <table className="w-full border-collapse">
                          <thead className="bg-gray-800/60 sticky top-0 z-10">
                            <tr className="text-left text-xs font-medium text-cyan-300 uppercase tracking-wider">
                              <th className="px-4 py-3">LP Coin ID</th>
                              <th className="px-4 py-3">Pair ID</th>
                              <th className="px-4 py-3">Tx Digest</th>
                              <th className="px-4 py-3">Token Pair</th>
                              <th className="px-4 py-3">Amount</th>
                              <th className="px-4 py-3">Liquidity</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/30">
                            {filteredHistoryData.map((entry, index) => (
                              <motion.tr
                                key={`${entry.lpCoinId || index}-${
                                  entry.transactionHash || index
                                }`}
                                className="hover:bg-gray-700/20 transition-colors bg-gray-800/10"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center">
                                    <Link className="w-4 h-4 text-cyan-400 mr-2" />
                                    <a
                                      href={`https://suiscan.xyz/devnet/object/${entry.lpCoinId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:underline font-mono text-xs"
                                    >
                                      {formatHash(entry.lpCoinId)}
                                    </a>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center">
                                    <Link className="w-4 h-4 text-cyan-400 mr-2" />
                                    <a
                                      href={`https://suiscan.xyz/devnet/object/${entry.pairId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:underline font-mono text-xs"
                                    >
                                      {formatHash(entry.pairId)}
                                    </a>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center">
                                    <Link className="w-4 h-4 text-cyan-400 mr-2" />
                                    <a
                                      href={`https://suiscan.xyz/devnet/transaction/${entry.transactionHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:underline font-mono text-xs"
                                    >
                                      {formatHash(entry.transactionHash)}
                                    </a>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center space-x-1">
                                    <span className="font-medium">
                                      {getTokenName(
                                        entry.token0Type?.name || ""
                                      )}
                                    </span>
                                    <span className="text-gray-400">/</span>
                                    <span className="font-medium">
                                      {getTokenName(
                                        entry.token1Type?.name || ""
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="space-y-1">
                                    <div className="flex items-center">
                                      <span className="text-xs text-gray-400 w-12">
                                        {getTokenName(
                                          entry.token0Type?.name || ""
                                        ).substring(0, 4)}
                                        :
                                      </span>
                                      <span className="ml-1 font-mono">
                                        {Number(entry.amount0).toLocaleString(
                                          undefined,
                                          { maximumFractionDigits: 2 }
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      <span className="text-xs text-gray-400 w-12">
                                        {getTokenName(
                                          entry.token1Type?.name || ""
                                        ).substring(0, 4)}
                                        :
                                      </span>
                                      <span className="ml-1 font-mono">
                                        {Number(entry.amount1).toLocaleString(
                                          undefined,
                                          { maximumFractionDigits: 2 }
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm font-mono">
                                  {Number(entry.liquidity).toLocaleString(
                                    undefined,
                                    { maximumFractionDigits: 2 }
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 text-xs rounded-full bg-cyan-500/10 text-cyan-400">
                                    {entry.type
                                      ? entry.type
                                          .split("::")
                                          ?.pop()
                                          ?.replace(/>$/, "")
                                      : "Unknown"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-300">
                                  {entry.timestamp
                                    ? getTimeSince(entry.timestamp)
                                    : "N/A"}
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        renderEmptyState("No transaction history found")
                      )}
                    </>
                  )}

                  {activeTab === "all-pools" && (
                    <>
                      {filteredPools.length > 0 ? (
                        <table className="w-full border-collapse">
                          <thead className="bg-gray-800/60 sticky top-0 z-10">
                            <tr className="text-left text-xs font-medium text-cyan-300 uppercase tracking-wider">
                              <th className="px-4 py-3">Pool</th>
                              <th className="px-4 py-3">Fee Tier</th>
                              <th className="px-4 py-3">APR</th>
                              <th className="px-4 py-3">TVL</th>
                              <th className="px-4 py-3">Volume 24H</th>
                              <th className="px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/30">
                            {filteredPools.map((pool, index) => (
                              <motion.tr
                                key={pool.pairId || index}
                                className="hover:bg-gray-700/20 transition-colors bg-gray-800/10"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center">
                                    <div className="flex -space-x-2 mr-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center z-10">
                                        {pool.tokens[0]?.substring(0, 1)}
                                      </div>
                                      <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center">
                                        {pool.tokens[1]?.substring(0, 1)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {pool.pair}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {pool.chain}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 text-xs rounded-full bg-cyan-500/10 text-cyan-400">
                                    {pool.feeTier}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-green-400">
                                      {pool.apr.current}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {Number(
                                        pool.apr.current.replace("%", "")
                                      ) >
                                      Number(pool.apr.previous.replace("%", ""))
                                        ? "↑ "
                                        : "↓ "}
                                      Previous: {pool.apr.previous}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-medium">
                                  {pool.tvl}
                                </td>
                                <td className="px-4 py-3">{pool.volume24h}</td>
                                <td className="px-4 py-3">
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/addliquidity?token0=${pool.tokens[0]}&token1=${pool.tokens[1]}`
                                        )
                                      }
                                      className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 transition-colors"
                                      title="Add liquidity to this pool"
                                    >
                                      <PlusCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/swap?token0=${pool.tokens[0]}&token1=${pool.tokens[1]}`
                                        )
                                      }
                                      className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors"
                                      title="Swap these tokens"
                                    >
                                      <ArrowRightLeft className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        renderEmptyState("No pools match your search")
                      )}
                    </>
                  )}

                  {activeTab === "my-positions" && (
                    <>
                      {filteredPositionsData.length > 0 ? (
                        <table className="w-full border-collapse">
                          <thead className="bg-gray-800/60 sticky top-0 z-10">
                            <tr className="text-left text-xs font-medium text-cyan-300 uppercase tracking-wider">
                              <th className="px-4 py-3">Position</th>
                              <th className="px-4 py-3">Fee Tier</th>
                              <th className="px-4 py-3">Liquidity</th>
                              <th className="px-4 py-3">Token Amounts</th>
                              <th className="px-4 py-3">Value</th>
                              <th className="px-4 py-3">APR</th>
                              <th className="px-4 py-3">Age</th>
                              <th className="px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/30">
                            {filteredPositionsData.map((position, index) => (
                              <motion.tr
                                key={position.id || index}
                                className="hover:bg-gray-700/20 transition-colors bg-gray-800/10"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center">
                                    <div className="flex -space-x-2 mr-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center z-10">
                                        {position.token0.name.substring(0, 1)}
                                      </div>
                                      <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-800 flex items-center justify-center">
                                        {position.token1.name.substring(0, 1)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {position.token0.name} /{" "}
                                        {position.token1.name}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        ID: {formatHash(position.id)}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 text-xs rounded-full bg-cyan-500/10 text-cyan-400">
                                    {position.feeTier}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono">
                                  {formatNumber(position.liquidity)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <div className="space-y-1">
                                    <div className="flex items-center">
                                      <span className="text-xs text-gray-400 w-12">
                                        {position.token0.name.substring(0, 4)}:
                                      </span>
                                      <span className="ml-1 font-mono">
                                        {formatNumber(
                                          position.token0.amount,
                                          position.token0.decimals === 18
                                            ? 6
                                            : 2
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex items-center">
                                      <span className="text-xs text-gray-400 w-12">
                                        {position.token1.name.substring(0, 4)}:
                                      </span>
                                      <span className="ml-1 font-mono">
                                        {formatNumber(
                                          position.token1.amount,
                                          position.token1.decimals === 18
                                            ? 6
                                            : 2
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-medium text-green-400">
                                  {position.valueUSD}
                                </td>
                                <td className="px-4 py-3 font-medium text-green-400">
                                  {position.apr}
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-sm">
                                  {getTimeSince(position.createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/removeliquidity?positionId=${position.id}`
                                        )
                                      }
                                      className="p-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-colors"
                                      title="Remove liquidity"
                                    >
                                      <MinusCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        window.open(
                                          `https://suiscan.xyz/devnet/object/${position.id}`,
                                          "_blank"
                                        )
                                      }
                                      className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors"
                                      title="View on explorer"
                                    >
                                      <Link className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      ) : !account?.address ? (
                        renderEmptyState(
                          "Connect your wallet to view positions"
                        )
                      ) : (
                        renderEmptyState("No active positions found")
                      )}
                    </>
                  )}
                </SimpleBar>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Pagination or Statistics Footer */}
          <motion.div
            className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400"
            variants={itemVariants}
          >
            <div>
              {activeTab === "history" && filteredHistoryData.length > 0 && (
                <p>
                  Showing {filteredHistoryData.length} transaction
                  {filteredHistoryData.length !== 1 ? "s" : ""}
                </p>
              )}
              {activeTab === "all-pools" && filteredPools.length > 0 && (
                <p>
                  Showing {filteredPools.length} pool
                  {filteredPools.length !== 1 ? "s" : ""}
                </p>
              )}
              {activeTab === "my-positions" &&
                filteredPositionsData.length > 0 && (
                  <p>
                    Showing {filteredPositionsData.length} position
                    {filteredPositionsData.length !== 1 ? "s" : ""}
                  </p>
                )}
            </div>

            <div className="mt-2 sm:mt-0 flex items-center">
              <button
                onClick={() =>
                  window.open("https://suiscan.xyz/devnet/", "_blank")
                }
                className="flex items-center text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <span>View more on SuiScan</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
};

// Helper components
const X = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default EnhancedPoolsInterface;
