import React, { useState, useEffect, useRef } from "react";
import BackgroundEffects from "../components/BackgroundEffects";
import { ConnectWallet_Button } from "./ConnectWalletButton";
import { useWallet } from "@suiet/wallet-kit";
import {
  Wallet,
  Search,
  X,
  Menu,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { debounce } from "lodash";
import SimpleBar from "simplebar-react";
import "simplebar/dist/simplebar.min.css";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SuiClient } from "@mysten/sui.js/client";

// Type definitions
interface TokenInfo {
  id: string;
  type: string;
  metadata?: {
    name: string;
    symbol: string;
    image?: string;
    decimals: number;
  };
  balance: string;
  price?: number;
  change24h?: number;
}

// Navigation items
const navItems = [
  { label: "Swap", path: "/swap", isExternal: false },
  { label: "Pool", path: "/pool", isExternal: false },
  { label: "Earn", path: "https://suitrumpnew.vercel.app/", isExternal: true },
  { label: "SuiTrump", path: "https://sui-trump.com", isExternal: true },
  { label: "Bridge", path: "https://bridge.sui.io/", isExternal: true },
  { label: "Docs", path: "https://docs.sui.io/", isExternal: true },
];

// Constants
const DEFAULT_TOKEN_IMAGE =
  "https://cryptologos.cc/logos/sui-sui-logo.png?v=029";

// Utility functions
const getShortAddress = (address: string | undefined): string => {
  if (!address) return "";
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
};

const formatBalance = (balance: string, decimals: number = 9): string => {
  const value = Number(balance) / Math.pow(10, decimals);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
};

const Header: React.FC = () => {
  // State
  const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const suiClient = new SuiClient({ url: "https://fullnode.devnet.sui.io/" });

  // Refs
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { account, connected, signAndExecuteTransaction } = useWallet();

  const navigate = useNavigate();

  // Set active tab based on current URL
  useEffect(() => {
    const path = window.location.pathname;
    const matchingItem = navItems.find(
      (item) => !item.isExternal && item.path === path
    );
    if (matchingItem) {
      setActiveTab(matchingItem.label);
    }
  }, []);

  // Token fetching function
  const fetchBalance = async (
    tokenId: string,
    decimals: number
  ): Promise<string> => {
    if (!tokenId || !account?.address) return "0";
    try {
      const coin = await suiClient.getObject({
        id: tokenId,
        options: { showContent: true },
      });

      if (
        coin.data?.content &&
        "fields" in coin.data.content &&
        typeof coin.data.content.fields === "object" &&
        coin.data.content.fields &&
        "balance" in coin.data.content.fields
      ) {
        const balance = coin.data.content.fields.balance as string;
        return formatBalance(balance, decimals);
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
    return "0";
  };

  const fetchTokens = async (): Promise<void> => {
    if (!account) return;
    setIsLoading(true);

    try {
      const objects = await suiClient.getOwnedObjects({
        owner: account.address,
        options: {
          showType: true,
          showContent: true,
          showDisplay: true,
        },
      });

      const coinTypeMap = new Map<string, TokenInfo>();

      for (const obj of objects.data) {
        if (!obj.data?.type || !obj.data.type.includes("::coin::")) continue;

        const typeString = obj.data.type;
        const coinTypeMatch = typeString.match(/<(.+)>/);
        if (!coinTypeMatch) continue;

        const coinType = coinTypeMatch[1];

        // Skip LP tokens
        if (
          typeString.includes("LPCoin") ||
          obj.data.display?.data?.name?.includes("LP") ||
          obj.data.display?.data?.symbol?.includes("LP")
        ) {
          continue;
        }

        let rawBalance = "0";
        if (
          obj.data?.content &&
          typeof obj.data.content === "object" &&
          "fields" in obj.data.content &&
          obj.data.content.fields &&
          typeof obj.data.content.fields === "object" &&
          "balance" in obj.data.content.fields
        ) {
          rawBalance = obj.data.content.fields.balance as string;
        }

        const balance = BigInt(rawBalance);

        const existingToken = coinTypeMap.get(coinType);
        if (existingToken) {
          // Aggregate balances for duplicate tokens
          existingToken.balance = (
            BigInt(existingToken.balance) + balance
          ).toString();
        } else {
          let metadata;
          try {
            metadata = await suiClient.getCoinMetadata({ coinType });
          } catch {
            metadata = {
              name: coinType.split("::").pop() || "Unknown",
              symbol: coinType.split("::").pop() || "Unknown",
              image: DEFAULT_TOKEN_IMAGE,
              decimals: 0,
            };
          }

          coinTypeMap.set(coinType, {
            id: obj.data.objectId,
            type: typeString,
            metadata: {
              name: metadata?.name || coinType.split("::").pop() || "Unknown",
              symbol:
                metadata?.symbol || coinType.split("::").pop() || "Unknown",
              image: metadata?.iconUrl || DEFAULT_TOKEN_IMAGE,
              decimals: metadata?.decimals || 0,
            },
            balance: balance.toString(),
            price: Math.random() * 100, // Mock price data
            change24h: Math.random() * 20 - 10, // Mock change data
          });
        }
      }

      setTokens(Array.from(coinTypeMap.values()));
      if (searchQuery) {
        debouncedSearch(searchQuery);
      }
    } catch (error) {
      console.error("Error fetching tokens:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Effects for token fetching
  useEffect(() => {
    fetchTokens();
    const intervalId = setInterval(fetchTokens, 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId);
  }, [account]);

  // Search functionality
  const debouncedSearch = debounce((term: string) => {
    const searchTerm = term.toLowerCase().trim();
    const filtered = tokens.filter((token) => {
      return (
        token.metadata?.name.toLowerCase().includes(searchTerm) ||
        token.metadata?.symbol.toLowerCase().includes(searchTerm) ||
        token.id.toLowerCase().includes(searchTerm)
      );
    });
    setFilteredTokens(filtered);
  }, 300);

  useEffect(() => {
    if (searchQuery) {
      debouncedSearch(searchQuery);
    } else {
      setFilteredTokens([]);
    }
    return () => debouncedSearch.cancel();
  }, [searchQuery, tokens]);

  // Event handlers
  const handleWalletClick = (): void => {
    setDropdownVisible(!dropdownVisible);
  };

  const toggleMenu = (): void => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSearchFocus = (): void => {
    setIsSearchFocused(true);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleSearchBlur = (e: React.FocusEvent): void => {
    if (!searchRef.current?.contains(e.relatedTarget as Node)) {
      if (!searchQuery) {
        setIsSearchFocused(false);
      }
    }
  };

  const clearSearch = (): void => {
    setSearchQuery("");
    setIsSearchFocused(false);
    setFilteredTokens([]);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleNavigation = (
    path: string,
    isExternal: boolean,
    label: string
  ): void => {
    if (isExternal) {
      window.open(path, "_blank", "noopener,noreferrer");
    } else {
      navigate(path);
      setActiveTab(label);
    }
    if (isMenuOpen) {
      setIsMenuOpen(false);
    }
  };

  // Token item component
  const TokenItem: React.FC<{ token: TokenInfo }> = ({ token }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="group relative overflow-hidden rounded-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-blue-500/10 transition-all duration-500 ease-out rounded-xl" />

      <div className="p-3 flex items-center gap-3 backdrop-blur-sm bg-white/5 rounded-xl">
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/30 group-hover:to-purple-500/30 rounded-full blur-md transition-all duration-500 opacity-0 group-hover:opacity-100" />
          <img
            src={token.metadata?.image || DEFAULT_TOKEN_IMAGE}
            alt={token.metadata?.symbol}
            className="w-10 h-10 rounded-full object-cover border-2 border-white/10 relative z-10"
            onError={(e) => {
              (e.target as HTMLImageElement).src = DEFAULT_TOKEN_IMAGE;
            }}
          />
          {token.change24h !== undefined && (
            <div
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#04112a] z-20 ${
                token.change24h >= 0 ? "bg-green-500" : "bg-red-500"
              }`}
            />
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-white font-medium truncate group-hover:text-blue-300 transition-colors duration-300">
            {token.metadata?.symbol}
          </span>
          <span className="text-sm text-white/60 truncate">
            {token.metadata?.name}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium group-hover:text-blue-300 transition-colors duration-300">
            {token.balance}
          </span>

          {token.price && (
            <span className="text-xs text-white/60">
              ${token.price.toFixed(2)}
              {token.change24h !== undefined && (
                <span
                  className={`ml-1 ${
                    token.change24h >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {token.change24h >= 0 ? "↑" : "↓"}
                  {Math.abs(token.change24h).toFixed(1)}%
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Navigation link component
  const NavLink: React.FC<{
    label: string;
    path: string;
    isExternal: boolean;
    isMobile?: boolean;
  }> = ({ label, path, isExternal, isMobile = false }) => {
    const isActive = activeTab === label;

    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleNavigation(path, isExternal, label)}
        className={`
          relative px-4 py-2 rounded-xl overflow-hidden cursor-pointer
          ${isMobile ? "w-full" : ""}
          ${isActive ? "text-white" : "text-white hover:text-blue-300"}
        `}
      >
        {/* Background with animated gradient */}
        {isActive && (
          <motion.div
            layoutId={isMobile ? "mobileActiveBackground" : "activeBackground"}
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-gradient-x"
            transition={{ type: "spring", duration: 0.3 }}
          />
        )}

        {/* Hover state background with subtle pulse */}
        <div
          className={`
          absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-xl
          ${!isActive && "bg-white/10 backdrop-blur-sm"}
        `}
        />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center gap-1">
          <span
            className={`transition-all duration-300 ${
              isActive ? "font-medium" : ""
            }`}
          >
            {label}
          </span>

          {isExternal && <ExternalLink className="w-3.5 h-3.5 opacity-70" />}
        </div>
      </motion.button>
    );
  };

  // Connect wallet button with animations
  const ConnectWalletButton: React.FC = () => {
    return (
      <motion.div
        className="relative group"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Animated glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient-x"></div>

        {/* Button container */}
        <div className="relative">
          <ConnectWalletButton />
        </div>
      </motion.div>
    );
  };

  return (
    <>
      <BackgroundEffects />

      {/* Main header */}
      <header className="sticky top-0 z-[100]">
        {/* Animated border effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"
        />

        {/* Ultra modern glass effect */}
        <div className="relative backdrop-blur-lg bg-[#080e24]/90 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16 lg:h-20">
              {/* Logo and Navigation - moved to the left */}
              <div className="flex items-center gap-8">
                {/* Animated logo */}
                <motion.div
                  className="cursor-pointer"
                  onClick={() => navigate("/")}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="relative">
                    {/* Animated glow effect */}
                    <motion.div
                      className="absolute -inset-2 bg-blue-500/20 rounded-full blur-lg"
                      animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 0.8, 0.5],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        repeatType: "reverse",
                      }}
                    />

                    <h1 className="relative text-2xl font-extrabold tracking-tight">
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 animate-gradient-x">
                        Sui
                      </span>
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 animate-gradient-x">
                        DeX
                      </span>
                    </h1>
                  </div>
                </motion.div>

                {/* Desktop Navigation */}
                <nav className="hidden lg:flex items-center gap-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.label}
                      label={item.label}
                      path={item.path}
                      isExternal={item.isExternal}
                    />
                  ))}
                </nav>

                {/* Mobile Menu Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMenu}
                  className="lg:hidden bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors duration-200"
                >
                  <AnimatePresence mode="wait">
                    {isMenuOpen ? (
                      <motion.div
                        key="close"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <X className="w-5 h-5 text-white" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="menu"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Menu className="w-5 h-5 text-white" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>

              {/* RIGHT-SIDE: Search and Connect Wallet */}
              <div className="flex items-center gap-4">
                {/* Desktop Search */}
                <div ref={searchRef} className="relative hidden sm:block">
                  <div
                    className={`relative transition-all duration-300 ${
                      isSearchFocused ? "w-72" : "w-60"
                    }`}
                    onClick={handleSearchFocus}
                  >
                    {/* Search icon */}
                    <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                      <Search
                        className={`h-4 w-4 ${
                          isSearchFocused ? "text-blue-400" : "text-white/50"
                        }`}
                      />
                    </div>

                    {/* Input field */}
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={handleSearchFocus}
                      onBlur={handleSearchBlur}
                      className={`
                        w-full bg-white/5 text-white pl-10 pr-10 py-2 rounded-xl
                        border transition-all duration-300 backdrop-blur-md
                        ${
                          isSearchFocused
                            ? "border-blue-500/50 bg-white/10 shadow-lg shadow-blue-500/10"
                            : "border-white/5 hover:border-white/10"
                        }
                        focus:outline-none
                      `}
                    />

                    {/* Clear button */}
                    {searchQuery && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-3 top-0 bottom-0 flex items-center text-white/50 hover:text-white transition-colors duration-200"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}

                    {/* Search results */}
                    <AnimatePresence>
                      {isSearchFocused && searchQuery && (
                        <>
                          {/* Overlay */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 bg-black/50 z-[101]"
                            onClick={() => {
                              setIsSearchFocused(false);
                              setSearchQuery("");
                            }}
                          />

                          {/* Results dropdown */}
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute left-0 right-0 mt-2 bg-[#0c1638]/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-xl overflow-hidden z-[102]"
                          >
                            <SimpleBar style={{ maxHeight: "450px" }}>
                              <div className="p-2 space-y-2">
                                {isLoading ? (
                                  <div className="flex flex-col items-center justify-center p-8">
                                    <motion.div
                                      className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full mb-4"
                                      animate={{ rotate: 360 }}
                                      transition={{
                                        duration: 1,
                                        ease: "linear",
                                        repeat: Infinity,
                                      }}
                                    />
                                    <p className="text-white/70">
                                      Loading tokens...
                                    </p>
                                  </div>
                                ) : filteredTokens.length > 0 ? (
                                  filteredTokens.map((token) => (
                                    <TokenItem key={token.id} token={token} />
                                  ))
                                ) : (
                                  <div className="flex flex-col items-center justify-center p-8 text-center">
                                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
                                      <Search className="w-6 h-6 text-white/30" />
                                    </div>
                                    <p className="text-white/70">
                                      No tokens found
                                    </p>
                                    <p className="text-sm text-white/40 mt-1">
                                      Try a different search term
                                    </p>
                                  </div>
                                )}
                              </div>
                            </SimpleBar>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Mobile Search Button */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="sm:hidden bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors duration-200"
                  onClick={() => setIsSearchFocused(!isSearchFocused)}
                >
                  <Search className="w-5 h-5 text-white" />
                </motion.button>

                {/* Connect Wallet Button - Now positioned on the right */}
                <div className="hidden sm:block">
                  <ConnectWallet_Button />
                </div>

                {/* Mobile Wallet Button */}
                <div className="sm:hidden relative z-[150]">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="relative group"
                    onClick={handleWalletClick}
                  >
                    {/* Animated glow */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-300"></div>

                    {/* Button */}
                    <div className="relative p-2 bg-[#131644] rounded-full">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {dropdownVisible && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-[100%] right-0 w-56 bg-[#0c1638] backdrop-blur-xl rounded-xl border border-white/10 shadow-xl z-[9999] p-2"
                      >
                        <ConnectWallet_Button />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden backdrop-blur-xl bg-[#0c1638]/95 border-b border-white/10 overflow-hidden z-50 p-4"
          >
            <nav className="grid grid-cols-2 gap-2 p-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.label}
                  label={item.label}
                  path={item.path}
                  isExternal={item.isExternal}
                  isMobile={true}
                />
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Search Overlay */}
      <AnimatePresence>
        {isSearchFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed sm:hidden inset-0 bg-[#0c1638]/95 backdrop-blur-xl z-[200] p-4"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <div className="absolute left-3 h-full flex items-center top-0">
                    <Search className="h-4 w-4 text-blue-400" />
                  </div>

                  <input
                    type="text"
                    placeholder="Search tokens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full h-12 bg-white/5 text-white pl-10 pr-10 rounded-xl border border-blue-500/30 focus:outline-none"
                  />

                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 h-full flex items-center top-0 text-white/50 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setIsSearchFocused(false);
                    setSearchQuery("");
                  }}
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors duration-200"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Mobile search results */}
              <div className="flex-1 overflow-hidden">
                <SimpleBar style={{ maxHeight: "calc(100vh - 100px)" }}>
                  <div className="space-y-2 pr-2">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center p-12">
                        <motion.div
                          className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full mb-4"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            ease: "linear",
                            repeat: Infinity,
                          }}
                        />
                        <p className="text-white/70">Loading tokens...</p>
                      </div>
                    ) : filteredTokens.length > 0 ? (
                      filteredTokens.map((token) => (
                        <TokenItem key={token.id} token={token} />
                      ))
                    ) : searchQuery ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                          <Search className="w-8 h-8 text-white/30" />
                        </div>
                        <p className="text-white/70">
                          No tokens found matching "{searchQuery}"
                        </p>
                        <p className="text-sm text-white/40 mt-2">
                          Try a different search term
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                          <Search className="w-8 h-8 text-white/30" />
                        </div>
                        <p className="text-white/70">
                          Type to search for tokens
                        </p>
                        <p className="text-sm text-white/40 mt-2">
                          Search by name, symbol, or address
                        </p>
                      </div>
                    )}
                  </div>
                </SimpleBar>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
