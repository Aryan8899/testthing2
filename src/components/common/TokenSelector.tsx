import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useWallet } from "@suiet/wallet-kit";
import { motion, AnimatePresence } from "framer-motion";
import SimpleBar from "simplebar-react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import "simplebar/dist/simplebar.min.css";
import { Search, X, Wallet, AlertCircle } from "lucide-react";
import { useTokens } from "../../hooks/useTokens";
import { Token, TokenInfo, DEFAULT_TOKEN_IMAGE } from "../../utils/tokenUtils";
// import { formatBalance } from "../../utils/formatUtils";
import { usePair } from "../../hooks/usePair";


interface TokenSelectorProps {
  onSelect: (token: Token | null) => void;
  selectedToken: Token | null;
  amount: string;
  onAmountChange: (amount: string) => void;
  showInput?: boolean;
  label: string;
  balance?: string;
  isInput?: boolean;
  selectedToken1?: Token | null; // ADD: Second token
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
        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-indigo-900/20 transition-colors"
        onClick={() => {
          onSelect({
            id: token.id,
            name: token.metadata?.name || "",
            symbol: token.metadata?.symbol || "",
            decimals: token.metadata?.decimals || 0,
            metadata: token.metadata,
            coinType: token.coinType,
            allObjectIds: token.allObjectIds,
          });
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10">
            <img
              src={token.metadata?.image || DEFAULT_TOKEN_IMAGE}
              alt={token.metadata?.symbol || "Token"}
              className="w-full h-full object-cover rounded-full border border-gray-700"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_TOKEN_IMAGE;
              }} // Fallback in case of image loading failure
            />
            {token.allObjectIds && token.allObjectIds.length > 1 && (
              <div className="absolute -top-1 -right-1 bg-cyan-500 text-xs text-black font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {token.allObjectIds.length}
              </div>
            )}
          </div>
          <div className="text-left">
            <div className="font-medium text-white group-hover:text-cyan-400 transition-colors">
              {token.metadata?.symbol || "Unknown"}
            </div>
            <div className="text-sm text-gray-400 truncate max-w-[120px]">
              {token.metadata?.name || "Unknown Token"}
            </div>
          </div>
        </div>
        <div className="text-right">
        <div className="font-medium text-white group-hover:text-cyan-400 transition-colors text-sm sm:text-base">
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
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const { account } = useWallet(); // Suiet wallet hook
  const modalRef = useRef<HTMLDivElement>(null);

  // Use our custom hook for token data
  const {
    tokens,
    filteredTokens,
    isLoading,
    searchQuery,
    setSearchQuery,
    fetchTokens,
  } = useTokens();

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
    if (!account?.address) {
      toast.error("Please connect your wallet to select a token");
      return;
    }
    setIsOpen(true);
  }, [account?.address]);

  // Handle amount input change
  const handleAmountChange = useCallback(
    (value: string) => {
      if (/^\d*\.?\d*$/.test(value) || value === "") {
        onAmountChange(value);
      }
    },
    [onAmountChange]
  );

  // Handle token selection
  const handleTokenSelect = useCallback(
    (token: Token) => {
      onSelect(token);
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
    <div className="rounded-2xl px-4 py-4 border border-gray-700/50 bg-gray-800/30 backdrop-blur-sm hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {selectedToken && showInput && (
          <span className="text-sm text-gray-400 flex items-center">
            <Wallet className="w-3.5 h-3.5 text-cyan-400 mr-1" />
            Balance: {balance}
          </span>
        )}
      </div>

      <div
        className={`flex ${
          !showInput || !selectedToken ? "justify-center" : "justify-between"
        } items-center gap-2`}
      >
       {showInput && selectedToken && (
  <div className="flex-1 min-w-0 relative">
    <div className="flex items-center">
      <input
        type="text"
        value={amount}
        onChange={(e) => handleAmountChange(e.target.value)}
        className="bg-transparent border-none text-lg sm:text-xl w-full p-1 sm:p-2 focus:outline-none text-white transition-all duration-200 focus:ring-0 pr-16"
        placeholder="0.0"
        readOnly={!isInput}
      />
      {isInput && parseFloat(balance) > 0 && (
        <button
          onClick={() => onAmountChange(balance)}
          className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 text-2xs sm:text-xs bg-cyan-800/50 hover:bg-cyan-700/60 text-cyan-300 px-1 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg transition-colors whitespace-nowrap min-w-12"
        >
          MAX
        </button>
      )}
    </div>
  </div>
)}

        <button
          onClick={handleOpenModal}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 hover:bg-gray-700/50 active:scale-95 ${
            selectedToken
              ? "bg-gray-800/50 border-gray-700/50"
              : "bg-cyan-600/20 border-cyan-500/30 text-cyan-400"
          } border`}
        >
          {selectedToken ? (
            <>
              <div className="flex items-center gap-2">
                <img
                  src={selectedToken.metadata?.image || DEFAULT_TOKEN_IMAGE}
                  alt={selectedToken.symbol}
                  className="w-8 h-8 rounded-full"
                />
                <div className="flex flex-col items-start">
                  <span className="font-medium text-white">
                    {selectedToken.symbol}
                  </span>
                  <span className="text-xs text-gray-400">
                    {/* {selectedToken.name} */}
                  </span>
                </div>
              </div>
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
            </>
          ) : (
            <span className="font-semibold">Select Token</span>
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
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-[9999] p-4"
              style={{ overflowY: "auto" }}
            >
              <motion.div
                variants={modalVariants}
                ref={modalRef}
                className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl p-5 w-full max-w-md border border-cyan-500/30 max-h-[85vh] flex flex-col shadow-2xl shadow-cyan-600/20"
                style={{ zIndex: 10000 }}
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white">
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
                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-cyan-500/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/30"
                  />
                </div>

                {/* Token List */}
                <SimpleBar
                  className="flex-1 overflow-y-auto pr-1"
                  style={{ maxHeight: "400px" }}
                >
                  <div className="space-y-1">
                    {isLoading ? (
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
                  disabled={isLoading}
                  className="mt-4 w-full flex items-center justify-center py-2 px-4 bg-cyan-600/20 text-cyan-400 rounded-xl hover:bg-cyan-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Loading..." : "Refresh Tokens"}
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
