// NetworkStatus.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { advancedSuiClient } from "../utils/advancedSuiClient";

// Network health status type
type NetworkStatus = "healthy" | "degraded" | "error" | "unknown";

interface NetworkStatusBarProps {
  onRetry?: () => void;
  className?: string;
}

/**
 * Network status bar component that monitors the Sui network health
 * and displays appropriate status messages
 */
const NetworkStatusBar: React.FC<NetworkStatusBarProps> = ({
  onRetry,
  className = "",
}) => {
  const [status, setStatus] = useState<NetworkStatus>("unknown");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Function to check network health
  const checkNetworkHealth = async () => {
    try {
      setIsLoading(true);

      // Perform a lightweight query to test the network
      await advancedSuiClient
        .getSuiClient()
        .getLatestCheckpointSequenceNumber();

      // Network responded successfully
      setStatus("healthy");
      setErrorMessage("");
      setHasError(false);
      setIsVisible(false); // Hide when healthy
    } catch (error: any) {
      // Determine status based on error
      if (
        error.message?.includes("INSUFFICIENT_RESOURCES") ||
        error.message?.includes("timeout")
      ) {
        setStatus("degraded");
        setErrorMessage(
          "The Sui network is experiencing congestion. Some operations may be delayed."
        );
      } else if (error.message?.includes("Failed to fetch")) {
        setStatus("error");
        setErrorMessage(
          "Connection to the Sui network failed. Check your internet connection."
        );
      } else {
        setStatus("error");
        setErrorMessage(error.message || "Unknown network error occurred");
      }

      setHasError(true);
      setIsVisible(true); // Show when there's an issue
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual retry
  const handleRetry = () => {
    checkNetworkHealth();
    if (onRetry) onRetry();
  };

  // Reset circuit breaker when manually retrying
  const handleResetCircuitBreaker = () => {
    advancedSuiClient.resetCircuitBreaker();
    handleRetry();
  };

  // Check network health on mount and periodically
  useEffect(() => {
    checkNetworkHealth();

    // Periodic checks with different intervals based on status
    const intervalTime =
      status === "error" ? 10000 : status === "degraded" ? 15000 : 30000; // 30s when healthy

    const interval = setInterval(checkNetworkHealth, intervalTime);

    return () => clearInterval(interval);
  }, [status]);

  // If not visible or healthy, don't render
  if (!isVisible && status === "healthy") {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`rounded-xl border px-4 py-3 mb-4 flex items-center justify-between ${
          status === "degraded"
            ? "bg-yellow-900/20 border-yellow-500/30 text-yellow-400"
            : status === "error"
            ? "bg-red-900/20 border-red-500/30 text-red-400"
            : "bg-indigo-900/20 border-indigo-500/30 text-indigo-400"
        } ${className}`}
      >
        <div className="flex items-center gap-3">
          {status === "degraded" && (
            <Wifi className="w-5 h-5 text-yellow-500" />
          )}
          {status === "error" && <WifiOff className="w-5 h-5 text-red-500" />}
          {status === "unknown" && (
            <AlertCircle className="w-5 h-5 text-indigo-500" />
          )}

          <div>
            <p className="font-medium">
              {status === "degraded" && "Network Congestion Detected"}
              {status === "error" && "Network Connection Error"}
              {status === "unknown" && "Checking Network Status..."}
            </p>
            <p className="text-sm opacity-80">{errorMessage}</p>
          </div>
        </div>

        <button
          onClick={handleResetCircuitBreaker}
          disabled={isLoading}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm ${
            status === "degraded"
              ? "bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300"
              : status === "error"
              ? "bg-red-500/20 hover:bg-red-500/30 text-red-300"
              : "bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300"
          } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          <span>Retry Connection</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default NetworkStatusBar;
