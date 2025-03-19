import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { motion, AnimatePresence } from "framer-motion";
import SimpleBar from "simplebar-react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import "simplebar/dist/simplebar.min.css";
import { Search, X, Wallet, AlertCircle, RefreshCcw } from "lucide-react";
import { useTokens } from "../../hooks/useTokens";
import {
  Token,
  TokenInfo,
  DEFAULT_TOKEN_IMAGE,
  normalizeToken,
} from "../../utils/tokenUtils";

interface TokenSelectorProps {
  onSelect: (token: Token | null) => void;
  selectedToken: Token | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  showInput?: boolean;
  label: string;
  balance?: string;
  isInput?: boolean;
  selectedToken1?: Token | null;
  centerButton?: boolean; // Center the selector button
  disableInput?: boolean; // Explicitly disable input functionality
  isLoading?: boolean; // New prop to show loading state
}

// Token skeleton for loading state (memoized)
const TokenSkeleton = memo(() => (
  <div className="animate-pulse w-full flex items-center gap-3 p-3 rounded-xl">
    <div className="w-10 h-10 bg-gray-700/50 rounded-full"></div>
    <div className="flex-1">
      <div className="h-5 w-24 bg-gray-700/50 rounded mb-2"></div>
      <div className="h-4 w-16 bg-gray-700/50 rounded"></div>
    </div>
    <div className="h-5 w-16 bg-gray-700/50 rounded"></div>
  </div>
));

// Portal for modal
interface PortalProps {
  children: React.ReactNode;
}

const Portal: React.FC<PortalProps> = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  return mounted ? createPortal(children, document.body) : null;
};

// Token list item component (memoized)
const TokenListItem = memo(
  ({
    token,
    index,
    onSelect,
  }: {
    token: TokenInfo;
    index: number;
    onSelect: (token: Token) => void;
  }) => {
    // Format balance with proper decimal places
    const formattedBalance = (() => {
      try {
        const balance =
          parseFloat(token.balance) /
          Math.pow(10, token.metadata?.decimals || 9);
        return balance < 0.001
          ? balance.toExponential(2)
          : balance.toLocaleString(undefined, { maximumFractionDigits: 6 });
      } catch (e) {
        return "0";
      }
    })();

    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-indigo-900/30 transition-colors"
        onClick={() => {
          // Normalize token before passing to ensure image is set
          onSelect(
            normalizeToken({
              id: token.id,
              name: token.metadata?.name || "",
              symbol: token.metadata?.symbol || "",
              decimals: token.metadata?.decimals || 0,
              metadata: token.metadata,
              coinType: token.coinType,
              allObjectIds: token.allObjectIds,
            })
          );
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <img
              src={token.metadata?.image || DEFAULT_TOKEN_IMAGE}
              alt={token.metadata?.symbol || "Token"}
              className="w-full h-full object-cover rounded-full border border-indigo-700/50"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_TOKEN_IMAGE;
              }}
            />
            {token.allObjectIds && token.allObjectIds.length > 1 && (
              <div className="absolute -top-1 -right-1 bg-indigo-500 text-xs text-white font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {token.allObjectIds.length}
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="font-medium text-white group-hover:text-indigo-400 transition-colors">
              {token.metadata?.symbol || "Unknown"}
            </div>
            <div className="text-sm text-gray-400 truncate max-w-[120px]">
              {token.metadata?.name || "Unknown Token"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-medium text-white group-hover:text-indigo-400 transition-colors text-sm sm:text-base">
            {formattedBalance}
          </div>
        </div>
      </motion.button>
    );
  }
);

const TokenSelector: React.FC<TokenSelectorProps> = ({
  onSelect,
  selectedToken,
  amount,
  onAmountChange,
  showInput = true,
  label,
  balance = "0",
  isInput = true,
  centerButton = false,
  disableInput = false,
  isLoading = false, // Default to false
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const { account } = useWallet(); // Suiet wallet hook
  const modalRef = useRef<HTMLDivElement>(null);

  // Use our custom hook for token data
  const {
    tokens,
    filteredTokens,
    isLoading: isTokensLoading,
    searchQuery,
    setSearchQuery,
    fetchTokens,
  } = useTokens();

  // Determine if we should show input fields
  // If disableInput is true, we never show input regardless of other props
  const shouldShowInput = !disableInput && showInput && selectedToken;

  // Ensure the selectedToken has a properly formatted metadata with image
  const normalizedSelectedToken = selectedToken
    ? normalizeToken(selectedToken)
    : null;

  // Handle click outside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Open modal handler
  const handleOpenModal = useCallback(() => {
    if (isLoading) return; // Don't open modal if we're loading

    if (!account?.address) {
      toast.error("Please connect your wallet to select a token");
      return;
    }
    setIsOpen(true);
  }, [account?.address, isLoading]);

  // Handle amount input change
  const handleAmountChange = useCallback(
    (value: string) => {
      if (disableInput) return; // Don't allow changes if input is disabled
      if (/^\d*\.?\d*$/.test(value) || value === "") {
        onAmountChange(value);
      }
    },
    [onAmountChange, disableInput]
  );

  // Handle token selection
  const handleTokenSelect = useCallback(
    (token: Token) => {
      // Normalize token before passing up to ensure consistent structure
      onSelect(normalizeToken(token));
      setIsOpen(false);
    },
    [onSelect]
  );

  // Animation variants
  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { type: "spring", duration: 0.3 },
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  return (
    <div className="rounded-2xl px-5 py-4 border border-indigo-700/30 bg-gray-800/40 backdrop-blur-sm hover:border-indigo-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {normalizedSelectedToken && (
          <span className="text-sm text-gray-400 flex items-center">
            <Wallet className="w-3.5 h-3.5 text-indigo-400 mr-1" />
            {isLoading ? (
              <span className="flex items-center">
                <RefreshCcw className="w-3 h-3 animate-spin mr-1 text-indigo-400" />
                Loading...
              </span>
            ) : (
              <>Balance: {balance}</>
            )}
          </span>
        )}
      </div>

      <div
        className={`flex ${
          centerButton && !shouldShowInput
            ? "justify-center"
            : "justify-between"
        } items-center gap-3`}
      >
        {shouldShowInput && (
          <div className="flex-1 min-w-0 relative">
            <div className="flex items-center">
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className={`bg-transparent border-none text-lg sm:text-xl w-full p-1 sm:p-2 focus:outline-none text-white transition-all duration-200 focus:ring-0 pr-16 ${
                  isLoading ? "opacity-60" : ""
                }`}
                placeholder="0.0"
                readOnly={!isInput || disableInput || isLoading}
                disabled={isLoading}
              />
              {isInput &&
                !disableInput &&
                parseFloat(balance) > 0 &&
                !isLoading && (
                  <button
                    onClick={() => onAmountChange(balance)}
                    className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-2xs sm:text-xs bg-indigo-800/50 hover:bg-indigo-700/60 text-indigo-300 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg transition-colors whitespace-nowrap min-w-12"
                    disabled={isLoading}
                  >
                    MAX
                  </button>
                )}
            </div>
          </div>
        )}

        <button
          onClick={handleOpenModal}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 hover:bg-indigo-700/30 active:scale-95 ${
            normalizedSelectedToken
              ? "bg-gray-800/50 border-gray-700/50"
              : "bg-indigo-600/20 border-indigo-500/30 text-indigo-400"
          } border ${isLoading ? "opacity-70 cursor-wait" : ""}`}
          disabled={isLoading}
        >
          {normalizedSelectedToken ? (
            <>
              <div className="flex items-center gap-2">
                <img
                  src={
                    normalizedSelectedToken.metadata?.image ||
                    DEFAULT_TOKEN_IMAGE
                  }
                  alt={normalizedSelectedToken.symbol}
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    // If image fails to load, set src to default image
                    (e.target as HTMLImageElement).src = DEFAULT_TOKEN_IMAGE;
                  }}
                />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-white">
                    {normalizedSelectedToken.symbol}
                  </span>
                  <span className="text-xs text-gray-400">
                    {/* Simplified for cleaner UI */}
                  </span>
                </div>
              </div>
              {isLoading ? (
                <RefreshCcw className="w-4 h-4 animate-spin ml-1 text-indigo-400" />
              ) : (
                <svg
                  className="w-4 h-4 text-gray-400 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold cursor-pointer">
                {isLoading ? "Loading..." : "Select Token"}
              </span>
              {isLoading && (
                <RefreshCcw className="w-4 h-4 animate-spin ml-1 text-indigo-400" />
              )}
            </>
          )}
        </button>
      </div>

      {/* Token Selection Modal */}
      <AnimatePresence>
        {isOpen && (
          <Portal>
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={backdropVariants}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
              style={{ overflowY: "auto" }}
            >
              <motion.div
                variants={modalVariants}
                ref={modalRef}
                className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl p-5 w-full max-w-md border border-indigo-500/30 max-h-[85vh] flex flex-col shadow-2xl shadow-indigo-600/20"
                style={{ zIndex: 10000 }}
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
                    Select Token
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded-lg bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Input */}
                <div className="mb-4 relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    <Search className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or symbol"
                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-indigo-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/30"
                  />
                </div>

                {/* Token List */}
                <SimpleBar
                  className="flex-1 overflow-y-auto pr-1"
                  style={{ maxHeight: "400px" }}
                >
                  <div className="space-y-1">
                    {isTokensLoading ? (
                      <>
                        <TokenSkeleton />
                        <TokenSkeleton />
                        <TokenSkeleton />
                        <TokenSkeleton />
                      </>
                    ) : filteredTokens.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="mx-auto w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                          <AlertCircle className="w-8 h-8 text-gray-500" />
                        </div>
                        <p className="text-gray-400 mb-2">
                          {searchQuery
                            ? "No matching tokens found"
                            : "No tokens found in your wallet"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {searchQuery
                            ? "Try a different search term"
                            : "Try connecting a different wallet"}
                        </p>
                      </div>
                    ) : (
                      filteredTokens.map((token, index) => (
                        <TokenListItem
                          key={token.id + index}
                          token={token}
                          index={index}
                          onSelect={handleTokenSelect}
                        />
                      ))
                    )}
                  </div>
                </SimpleBar>

                {/* Refresh Button */}
                <button
                  onClick={fetchTokens}
                  disabled={isTokensLoading}
                  className="mt-4 w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {isTokensLoading ? (
                    <span className="flex items-center">
                      <RefreshCcw className="w-4 h-4 animate-spin mr-2" />
                      Loading...
                    </span>
                  ) : (
                    "Refresh Tokens"
                  )}
                </button>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TokenSelector;
