/**
 * Component for displaying and selecting swap routes
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  RefreshCcw,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { RouteInfo } from "../../hooks/useRoutes";

interface RouteDisplayProps {
  routes: RouteInfo[];
  selectedRoute: RouteInfo | null;
  onRouteSelect: (route: RouteInfo) => void;
  isLoadingRoutes: boolean;
  refreshRoutes: () => void;
}

const RouteDisplay: React.FC<RouteDisplayProps> = ({
  routes,
  selectedRoute,
  onRouteSelect,
  isLoadingRoutes,
  refreshRoutes,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 5 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  if (routes.length === 0 && !isLoadingRoutes) {
    return null;
  }

  // Handle route selection
  const handleRouteSelect = (route: RouteInfo) => {
    onRouteSelect(route);
  };

  // Show high price impact warning
  const showPriceImpactWarning = (priceImpact: number) => {
    if (priceImpact > 10) {
      return (
        <div className="flex items-center gap-1 text-red-400">
          <AlertTriangle className="w-3 h-3" />
          <span>High impact</span>
        </div>
      );
    } else if (priceImpact > 5) {
      return (
        <div className="flex items-center gap-1 text-yellow-400">
          <AlertTriangle className="w-3 h-3" />
          <span>Medium impact</span>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mt-4 bg-indigo-900/20 rounded-xl p-4 border border-indigo-500/30"
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-gray-300 text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-400" />
          {routes.length === 1
            ? "Best Route"
            : `Available Routes (${routes.length})`}
        </h3>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={refreshRoutes}
            disabled={isLoadingRoutes}
            className="flex items-center gap-1 text-xs py-1 px-2 bg-indigo-800/40 hover:bg-indigo-700/50 text-indigo-300 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCcw
              className={`w-3 h-3 ${isLoadingRoutes ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </motion.button>

          {routes.length > 1 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-indigo-800/40 hover:bg-indigo-700/50 text-indigo-300 transition-colors"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isLoadingRoutes ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center items-center py-6"
          >
            <div className="flex flex-col items-center">
              <RefreshCcw className="w-6 h-6 text-indigo-400 animate-spin mb-2" />
              <p className="text-sm text-gray-400">Finding best routes...</p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {/* Always show the best (first) route */}
            {routes.length > 0 && (
              <RouteItem
                route={routes[0]}
                isSelected={
                  selectedRoute?.path.join() === routes[0].path.join()
                }
                onSelect={handleRouteSelect}
                highlight={true}
              />
            )}

            {/* Show additional routes when expanded */}
            <AnimatePresence>
              {expanded && routes.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 mt-2 pt-2 border-t border-indigo-500/20"
                >
                  {routes.slice(1).map((route, index) => (
                    <RouteItem
                      key={index}
                      route={route}
                      isSelected={
                        selectedRoute?.path.join() === route.path.join()
                      }
                      onSelect={handleRouteSelect}
                      highlight={false}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Component for rendering an individual route
const RouteItem: React.FC<{
  route: RouteInfo;
  isSelected: boolean;
  onSelect: (route: RouteInfo) => void;
  highlight: boolean;
}> = ({ route, isSelected, onSelect, highlight }) => {
  // Format output amount for display
  const formattedOutput = parseFloat(route.estimatedOutput).toFixed(6);

  // Price impact styling
  const impactColor =
    route.priceImpact < 1
      ? "text-green-400"
      : route.priceImpact < 5
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(route)}
      className={`w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
        isSelected
          ? "bg-indigo-700/40 border border-indigo-500/50"
          : "bg-gray-800/40 border border-gray-700/40 hover:bg-gray-700/30"
      } ${highlight ? "bg-opacity-70" : "bg-opacity-50"}`}
    >
      <div className="flex flex-col items-start gap-1">
        {/* Path display */}
        <div className="flex items-center">
          {route.pathSymbols.map((symbol, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <ArrowRight className="mx-1 text-indigo-400 w-3 h-3" />
              )}
              <span className="font-medium text-white text-sm">{symbol}</span>
            </React.Fragment>
          ))}
        </div>

        {/* Route details */}
        <div className="flex items-center gap-3 text-xs">
          <span
            className={`px-2 py-0.5 rounded-full ${
              route.type === "direct"
                ? "bg-green-500/20 text-green-400"
                : "bg-indigo-500/20 text-indigo-400"
            }`}
          >
            {route.type === "direct" ? "Direct" : `${route.hops} Hops`}
          </span>

          <span className="text-gray-400">Output: {formattedOutput}</span>

          <span className={impactColor}>
            Impact: {route.priceImpact.toFixed(2)}%
          </span>
        </div>
      </div>

      {isSelected && <CheckCircle className="w-5 h-5 text-indigo-400" />}
    </motion.button>
  );
};

export default RouteDisplay;
