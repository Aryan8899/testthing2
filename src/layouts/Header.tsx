import React, { useState, useEffect, useRef } from "react";
import BackgroundEffects from "../components/BackgroundEffects";
import { useWallet } from "@suiet/wallet-kit";
import { AllDefaultWallets } from "@suiet/wallet-kit";
import {
  Search,
  X,
  Menu,
  ExternalLink,
  Coins,
  LayoutDashboard,
  ArrowRightLeft,
  ChevronDown,
  Copy,
  LogOut,
  Check,
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
  allObjectIds?: string[]; // Track all object IDs for merging functionality
}

// Navigation items
const navItems = [
  {
    label: "Swap",
    path: "/swap",
    isExternal: false,
    icon: <ArrowRightLeft className="w-4 h-4" />,
  },
  {
    label: "Pool",
    path: "/pool",
    isExternal: false,
    icon: <LayoutDashboard className="w-4 h-4" />,
  },
  {
    label: "Earn",
    path: "https://newfarm-rho.vercel.app/",
    isExternal: true,
    icon: <Coins className="w-4 h-4" />,
  },
  {
    label: "SuiTrump",
    path: "https://sui-trump.com",
    isExternal: true,
    icon: <ExternalLink className="w-4 h-4" />,
  },
  {
    label: "Bridge",
    path: "https://bridge.sui.io/",
    isExternal: true,
    icon: <ArrowRightLeft className="w-4 h-4 rotate-90" />,
  },
  {
    label: "Docs",
    path: "https://docs.sui.io/",
    isExternal: true,
    icon: <ExternalLink className="w-4 h-4" />,
  },
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
  const [walletMenuOpen, setWalletMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const suiClient = new SuiClient({ url: "https://fullnode.devnet.sui.io/" });

  // Refs
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const searchOverlayRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { account, connected, disconnect, connecting, select } = useWallet();
  const navigate = useNavigate();

  // Effect for handling clicks outside search and wallet menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Handle search outside clicks
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node) &&
        !searchOverlayRef.current?.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }

      // Handle wallet menu outside clicks
      if (
        walletMenuRef.current &&
        !walletMenuRef.current.contains(event.target as Node)
      ) {
        setWalletMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Copy address to clipboard
  const copyAddress = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle wallet connection
  const handleWalletConnect = () => {
    if (connected) {
      // Toggle the wallet menu dropdown if already connected
      setWalletMenuOpen(!walletMenuOpen);
    } else if (!connected && !connecting) {
      // Just call select() to trigger the wallet selection modal
      select("Sui Wallet");
    }
  };

  // Token fetching function
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
        limit: 50, // Increase limit to get more tokens at once
      });

      const coinTypeMap = new Map<string, TokenInfo>();

      // Process all objects to group by coin type
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

        // Skip zero balance tokens
        if (balance <= 0n) continue;

        // Utilize Sui's merge functionality by combining balances for the same coin type
        const existingToken = coinTypeMap.get(coinType);
        if (existingToken) {
          // Aggregate balances for duplicate tokens (Sui merge functionality)
          existingToken.balance = (
            BigInt(existingToken.balance) + balance
          ).toString();

          // Keep track of all object IDs for the same token type
          if (!existingToken.allObjectIds) {
            existingToken.allObjectIds = [existingToken.id, obj.data.objectId];
          } else {
            existingToken.allObjectIds.push(obj.data.objectId);
          }
        } else {
          // Fetch metadata for this coin type
          let metadata;
          try {
            metadata = await suiClient.getCoinMetadata({ coinType });
          } catch {
            // Fallback metadata
            metadata = {
              name: coinType.split("::").pop() || "Unknown",
              symbol: coinType.split("::").pop() || "Unknown",
              image: DEFAULT_TOKEN_IMAGE,
              decimals: 9, // Default decimals for Sui tokens
            };
          }

          // Create new token entry
          coinTypeMap.set(coinType, {
            id: obj.data.objectId,
            type: typeString,
            metadata: {
              name: metadata?.name || coinType.split("::").pop() || "Unknown",
              symbol:
                metadata?.symbol || coinType.split("::").pop() || "Unknown",
              image: metadata?.iconUrl || DEFAULT_TOKEN_IMAGE,
              decimals: metadata?.decimals || 9,
            },
            balance: balance.toString(),
            price: Math.random() * 100, // Mock price data
            change24h: Math.random() * 20 - 10, // Mock change data
            allObjectIds: [obj.data.objectId],
          });
        }
      }

      // Convert map to array and sort by balance (highest first)
      const tokenArray = Array.from(coinTypeMap.values()).sort((a, b) => {
        return Number(BigInt(b.balance) - BigInt(a.balance));
      });

      setTokens(tokenArray);
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
  const toggleMobileMenu = (): void => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleSearchFocus = (): void => {
    setIsSearchFocused(true);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const clearSearch = (): void => {
    setSearchQuery("");
    if (!isSearchFocused) return;
    setIsSearchFocused(false);
    setFilteredTokens([]);
    if (searchInputRef.current) {
      searchInputRef.current.blur();
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

  // Token item component with enhanced glass effect
  const TokenItem: React.FC<{ token: TokenInfo }> = ({ token }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative overflow-hidden rounded-xl"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-indigo-500/0 to-purple-500/0 group-hover:from-cyan-500/10 group-hover:via-indigo-500/10 group-hover:to-purple-500/10 transition-all duration-500 ease-out rounded-xl" />

      <div className="p-3 flex items-center gap-3 backdrop-blur-lg bg-white/5 rounded-xl border border-white/5 group-hover:border-cyan-500/20 transition-all duration-300">
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/0 to-purple-500/0 group-hover:from-cyan-500/30 group-hover:to-purple-500/30 rounded-full blur-md transition-all duration-500 opacity-0 group-hover:opacity-100" />
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
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 z-20 ${
                token.change24h >= 0 ? "bg-emerald-500" : "bg-rose-500"
              }`}
            />
          )}
        </div>

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-white font-semibold truncate group-hover:text-cyan-300 transition-colors duration-300">
            {token.metadata?.symbol}
          </span>
          <span className="text-sm text-white/80 truncate">
            {token.metadata?.name}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-sm text-white font-medium group-hover:text-cyan-300 transition-colors duration-300">
            {token.balance}
          </span>

          {token.price && (
            <span className="text-xs text-white/80">
              ${token.price.toFixed(2)}
              {token.change24h !== undefined && (
                <span
                  className={`ml-1 ${
                    token.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
                  } font-medium`}
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

  // Navigation link component with enhanced visual effects
  const NavLink: React.FC<{
    label: string;
    path: string;
    isExternal: boolean;
    isMobile?: boolean;
    icon?: React.ReactNode;
  }> = ({ label, path, isExternal, isMobile = false, icon }) => {
    const isActive = activeTab === label;

    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleNavigation(path, isExternal, label)}
        className={`
          relative px-4 py-2 rounded-xl overflow-hidden cursor-pointer
          ${isMobile ? "w-full flex items-center gap-3" : ""}
          ${isActive ? "text-white" : "text-white/80 hover:text-cyan-300"}
          transition-all duration-300
        `}
      >
        {/* Background with animated gradient */}
        {isActive && (
          <motion.div
            layoutId={isMobile ? "mobileActiveBackground" : "activeBackground"}
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 animate-gradient-x"
            transition={{ type: "spring", duration: 0.3 }}
          />
        )}

        {/* Hover state background with subtle pulse */}
        <div
          className={`
          absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 rounded-xl
          ${!isActive && "bg-white/10 backdrop-blur-lg"}
        `}
        />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {isMobile && icon}
          <span
            className={`transition-all duration-300 ${
              isActive ? "font-medium" : ""
            }`}
          >
            {label}
          </span>

          {isExternal && !isMobile && (
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          )}
        </div>
      </motion.button>
    );
  };

  // Custom Connect Wallet Button Component
  const ConnectWalletButton = () => {
    return (
      <button
        onClick={handleWalletConnect}
        className="h-10 px-4 py-2 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 border border-indigo-500/30 transition-all duration-300 shadow-lg shadow-indigo-500/20 flex items-center gap-2 cursor-pointer"
      >
        {connecting ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>Connecting...</span>
          </div>
        ) : connected ? (
          <div className="flex items-center gap-2">
            <span className="bg-green-500 h-2.5 w-2.5 rounded-full"></span>
            <span>{getShortAddress(account?.address)}</span>
            <ChevronDown className="w-4 h-4 text-gray-300" />
          </div>
        ) : (
          <span>Connect Wallet</span>
        )}
      </button>
    );
  };

  return (
    <>
      <BackgroundEffects />

      {/* Main header */}
      <header className="sticky top-0 z-[20]">
        {/* Animated border effect */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
        />

        {/* Enhanced glass effect header */}
        <div className="relative backdrop-blur-xl bg-[#080e24]/70 border-b border-white/10 shadow-lg shadow-black/5">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16 lg:h-20">
              {/* Logo and Navigation - left side */}
              <div className="flex items-center gap-6 md:gap-8">
                {/* Animated logo with enhanced glow */}
                <motion.div
                  className="cursor-pointer"
                  onClick={() => navigate("/")}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="relative">
                    {/* Animated glow effect */}
                    <motion.div
                      className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-lg"
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
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-indigo-500 animate-gradient-x">
                        Sui
                      </span>
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 animate-gradient-x">
                        DeX
                      </span>
                    </h1>
                  </div>
                </motion.div>

                {/* Desktop Navigation - Enhanced with more space and better styling */}
                <nav className="hidden lg:flex items-center gap-1">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.label}
                      label={item.label}
                      path={item.path}
                      isExternal={item.isExternal}
                      icon={item.icon}
                    />
                  ))}
                </nav>

                {/* Mobile Menu Button - Enhanced with better hover effects */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleMobileMenu}
                  className="lg:hidden bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors duration-200 border border-white/5 hover:border-white/10 shadow-lg"
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

              {/* RIGHT-SIDE: Search and Connect Wallet - Ensuring wallet is rightmost */}
              <div className="flex items-center gap-4 justify-end w-full max-w-[500px] ml-auto">
                {/* Desktop Search */}
                <div
                  ref={searchRef}
                  className="relative hidden sm:block flex-grow"
                >
                  <div className={`relative transition-all duration-300`}>
                    {/* Search icon */}
                    <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                      <Search
                        className={`h-4 w-4 ${
                          isSearchFocused ? "text-cyan-400" : "text-white/50"
                        }`}
                      />
                    </div>

                    {/* Input field with enhanced styling */}
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={handleSearchFocus}
                      className={`
                        w-full bg-white/5 text-white pl-10 pr-10 py-2 rounded-xl
                        border transition-all duration-300 backdrop-blur-xl
                        ${
                          isSearchFocused
                            ? "border-cyan-500/50 bg-white/10 shadow-lg shadow-cyan-500/10"
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
                  </div>

                  {/* Search results with enhanced glass effect */}
                  <AnimatePresence>
                    {isSearchFocused && (
                      <>
                        {/* Search results dropdown */}
                        <motion.div
                          ref={searchOverlayRef}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            duration: 0.2,
                          }}
                          className="absolute left-0 right-0 mt-2 bg-[#0c1638]/95 backdrop-blur-xl rounded-xl border border-cyan-500/20 shadow-xl overflow-hidden z-[102]"
                        >
                          <SimpleBar style={{ maxHeight: "450px" }}>
                            <div className="p-2 space-y-2">
                              {isLoading ? (
                                <div className="flex flex-col items-center justify-center p-8">
                                  <motion.div
                                    className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full mb-4"
                                    animate={{ rotate: 360 }}
                                    transition={{
                                      duration: 1,
                                      ease: "linear",
                                      repeat: Infinity,
                                    }}
                                  />
                                  <p className="text-white/90 font-medium">
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
                                    <Search className="w-6 h-6 text-cyan-400/60" />
                                  </div>
                                  <p className="text-white/90 font-medium">
                                    No tokens found
                                  </p>
                                  <p className="text-sm text-white/60 mt-1">
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

                {/* Mobile Search Button with enhanced styling */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="sm:hidden bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all duration-200 border border-white/5 hover:border-cyan-500/30"
                  onClick={handleSearchFocus}
                >
                  <Search className="w-5 h-5 text-white" />
                </motion.button>

                {/* Connect Wallet Button - Positioned at rightmost end */}
                <div className="hidden sm:block" ref={walletMenuRef}>
                  <div className="relative group transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
                    <div className="relative z-10">
                      <ConnectWalletButton />
                    </div>

                    {/* Wallet menu dropdown */}
                    <AnimatePresence>
                      {walletMenuOpen && connected && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.95 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                          className="absolute right-0 mt-2 w-72 bg-[#0c1638]/95 backdrop-blur-xl rounded-xl border border-indigo-500/20 shadow-xl overflow-hidden z-[9999]"
                        >
                          <div className="p-4 border-b border-white/10">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 flex items-center justify-center text-white">
                                <span className="text-lg font-bold">
                                  {account?.address?.substring(0, 1)}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm text-white font-medium">
                                  Connected Wallet
                                </p>
                                <p className="text-xs text-white/60">
                                  Sui Wallet
                                </p>
                              </div>
                            </div>

                            <div className="bg-white/5 rounded-lg p-2 flex items-center justify-between mt-2 ">
                              <p className="text-sm text-white/80 font-mono">
                                {getShortAddress(account?.address)}
                              </p>
                              <button
                                onClick={copyAddress}
                                className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors cursor-pointer"
                              >
                                {copied ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="p-4">
                            <button
                              onClick={() => {
                                disconnect();
                                setWalletMenuOpen(false);
                              }}
                              className="flex items-center gap-2 w-full py-2 px-3 text-left rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Disconnect</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu with enhanced glass effect */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3,
            }}
            className="lg:hidden backdrop-blur-xl bg-gradient-to-b from-[#0c1638]/95 to-[#131644]/95 border-b border-white/10 overflow-hidden z-50"
          >
            <div className="p-5">
              {/* Mobile connect wallet button at top of menu for visibility */}
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <ConnectWalletButton />
                </div>
                <AnimatePresence>
                  {walletMenuOpen && connected && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                      className="absolute right-0 mt-2 w-72 bg-[#0c1638]/95 backdrop-blur-xl rounded-xl border border-indigo-500/20 shadow-xl overflow-hidden z-[9999]"
                    >
                      <div className="p-4 border-b border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 flex items-center justify-center text-white">
                            <span className="text-lg font-bold">
                              {account?.address?.substring(0, 1)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-white font-medium">
                              Connected Wallet
                            </p>
                            <p className="text-xs text-white/60">Sui Wallet</p>
                          </div>
                        </div>

                        <div className="bg-white/5 rounded-lg p-2 flex items-center justify-between mt-2">
                          <p className="text-sm text-white/80 font-mono">
                            {getShortAddress(account?.address)}
                          </p>
                          <button
                            onClick={copyAddress}
                            className="p-1.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                          >
                            {copied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-4">
                        <button
                          onClick={() => {
                            disconnect();
                            setWalletMenuOpen(false);
                          }}
                          className="flex items-center gap-2 w-full py-2 px-3 text-left rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* Navigation grid with enhanced spacing and styling */}
              <nav className="grid grid-cols-1 gap-3 p-2">
                {navItems.map((item) => (
                  <NavLink
                    key={item.label}
                    label={item.label}
                    path={item.path}
                    isExternal={item.isExternal}
                    isMobile={true}
                    icon={item.icon}
                  />
                ))}
              </nav>
            </div>

            {/* Decorative gradient bottom edge */}
            <div className="h-1 bg-gradient-to-r from-cyan-500/0 via-indigo-500/50 to-purple-500/0"></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Search Overlay with improved glass effect */}
      <AnimatePresence>
        {isSearchFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              duration: 0.3,
            }}
            className="fixed sm:hidden inset-0 bg-gradient-to-b from-[#0c1638]/95 to-[#131644]/95 backdrop-blur-xl z-[200] p-4"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1">
                  <div className="absolute left-3 h-full flex items-center top-0">
                    <Search className="h-4 w-4 text-cyan-400" />
                  </div>

                  <input
                    type="text"
                    placeholder="Search tokens..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-full h-12 bg-white/5 text-white pl-10 pr-10 rounded-xl border border-cyan-500/30 focus:outline-none"
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
                  className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors duration-200 border border-white/10"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>

              {/* Mobile search results with enhanced styling */}
              <div className="flex-1 overflow-hidden">
                <SimpleBar style={{ maxHeight: "calc(100vh - 100px)" }}>
                  <div className="space-y-2 pr-2">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center p-12">
                        <motion.div
                          className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full mb-4"
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            ease: "linear",
                            repeat: Infinity,
                          }}
                        />
                        <p className="text-white/90 font-medium">
                          Loading tokens...
                        </p>
                      </div>
                    ) : filteredTokens.length > 0 ? (
                      filteredTokens.map((token) => (
                        <TokenItem key={token.id} token={token} />
                      ))
                    ) : searchQuery ? (
                      <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/10">
                          <Search className="w-8 h-8 text-cyan-400/60" />
                        </div>
                        <p className="text-white/90 font-medium">
                          No tokens found matching "{searchQuery}"
                        </p>
                        <p className="text-sm text-white/60 mt-2">
                          Try a different search term
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-full flex items-center justify-center mb-4 border border-white/10 shadow-lg shadow-cyan-500/10">
                          <Search className="w-8 h-8 text-cyan-400/70" />
                        </div>
                        <p className="text-white/90 font-medium">
                          Type to search for tokens
                        </p>
                        <p className="text-sm text-white/70 mt-2">
                          Search by name, symbol, or address
                        </p>
                        <div className="mt-6 flex justify-center">
                          <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-white/80 text-sm">
                            <span className="text-cyan-400 font-medium">
                              Tip:
                            </span>{" "}
                            Your tokens will be automatically merged by type
                          </div>
                        </div>
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
