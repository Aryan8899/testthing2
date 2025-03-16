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

// Define interfaces
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

// Main component
const EnhancedPoolsInterface: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("history");
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { account, connected } = useWallet();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Sample pools data
  const allPools: Pool[] = [
    {
      pair: "USDT / WBNB",
      chain: "BNB SMART CHAIN",
      version: "V3",
      feeTier: "0.01%",
      apr: {
        current: "107.58%",
        previous: "98.42%",
      },
      tvl: "$ 5,808,463.8",
      volume24h: "$ 141M",
      poolType: "v3",
      tokens: ["USDT", "WBNB"],
    },
    {
      pair: "USDC / WBNB",
      chain: "BNB SMART CHAIN",
      version: "V3",
      feeTier: "0.05%",
      apr: {
        current: "11.56%",
        previous: "10.62%",
      },
      tvl: "$ 52,280,865",
      volume24h: "$ 27,707,066",
      poolType: "v3",
      tokens: ["USDC", "WBNB"],
    },
    {
      pair: "ETH / WBNB",
      chain: "BNB SMART CHAIN",
      version: "V3",
      feeTier: "0.05%",
      apr: {
        current: "76.15%",
        previous: "71.12%",
      },
      tvl: "$ 5,005,882.5",
      volume24h: "$ 18,113,972",
      poolType: "v3",
      tokens: ["ETH", "WBNB"],
    },
    {
      pair: "BTC / USDT",
      chain: "BNB SMART CHAIN",
      version: "V3",
      feeTier: "0.03%",
      apr: {
        current: "82.47%",
        previous: "79.35%",
      },
      tvl: "$ 8,725,941.2",
      volume24h: "$ 32,456,789",
      poolType: "v3",
      tokens: ["BTC", "USDT"],
    },
    {
      pair: "SOL / USDC",
      chain: "BNB SMART CHAIN",
      version: "V3",
      feeTier: "0.02%",
      apr: {
        current: "54.63%",
        previous: "51.24%",
      },
      tvl: "$ 3,451,278.9",
      volume24h: "$ 15,238,764",
      poolType: "v3",
      tokens: ["SOL", "USDC"],
    },
  ];

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

      if (data.length > 0  && !isInitialLoad) {
        toast.success("Successfully fetched transaction history");
      }
    } catch (error) {
      console.error("Error fetching history:", error);
      if (!isInitialLoad) {
        toast.error("Failed to fetch transaction history");
      }
      toast.error("Failed to fetch transaction history");

    } finally {
      setIsLoading(false);
      setRefreshing(false);

      setIsInitialLoad(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchHistoryData();
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
    if (!searchTerm.trim()) return allPools;

    const term = searchTerm.toLowerCase();
    return allPools.filter((pool) => {
      return (
        pool.pair.toLowerCase().includes(term) ||
        pool.tokens.some((token) => token.toLowerCase().includes(term)) ||
        pool.poolType.toLowerCase().includes(term)
      );
    });
  }, [allPools, searchTerm]);

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

          {/* Navigation Tabs */}
          <motion.div
            variants={itemVariants}
            className="flex justify-center sm:justify-start mb-6 relative"
          >
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 p-1 flex w-full max-w-md">
              {["history", "all-pools", "my-positions"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm sm:text-base font-medium transition-all duration-300 relative ${
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
                  activeTab === "all-pools" ? "pools" : "transactions"
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
                onClick={() => fetchHistoryData()}
                disabled={refreshing || !account?.address}
                className="p-2 rounded-xl bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 transition-colors border border-gray-700/50 flex items-center justify-center"
                title="Refresh data"
              >
                <RefreshCw
                  className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>

              <button
                onClick={() => navigate("/addliquidity")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-lg shadow-cyan-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Add Liquidity</span>
              </button>

              <button
                onClick={() => navigate("/removeliquidity")}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 shadow-lg shadow-red-500/20"
              >
                <MinusCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Remove Liquidity</span>
              </button>
            </div>
          </motion.div>

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
              {isLoading ? (
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
                              <th className="px-4 py-3">Sender</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/30">
                            {filteredHistoryData.map((entry, index) => (
                              <motion.tr
                                key={`${entry.lpCoinId || index}`}
                                className="hover:bg-gray-700/20 transition-colors bg-gray-800/10"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                              >
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center">
                                    <Link className="w-4 h-4 text-cyan-400 mr-2" />
                                    <a
                                      href={`https://suiscan.xyz/object/${entry.lpCoinId}`}
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
                                      href={`https://suiscan.xyz/object/${entry.pairId}`}
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
                                      href={`https://suiscan.xyz/transaction/${entry.transactionHash}`}
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
                                <td className="px-4 py-3 text-sm">
                                  <div className="flex items-center">
                                    <Wallet className="w-4 h-4 text-cyan-400 mr-2" />
                                    <a
                                      href={`https://suiscan.xyz/address/${entry.sender}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-cyan-400 hover:underline font-mono text-xs"
                                    >
                                      {formatHash(entry.sender)}
                                    </a>
                                  </div>
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
                                key={index}
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
                                      onClick={() => navigate("/addliquidity")}
                                      className="p-2 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/40 transition-colors"
                                    >
                                      <PlusCircle className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => navigate("/swap")}
                                      className="p-2 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors"
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

                  {activeTab === "my-positions" &&
                    renderEmptyState("No active positions found")}
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
            </div>

            <div className="mt-2 sm:mt-0 flex items-center">
              <button
                onClick={() => window.open("https://suiscan.xyz/", "_blank")}
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
