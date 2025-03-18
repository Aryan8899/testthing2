"use client";
import { useState, useEffect, lazy, Suspense } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// Styles
import "@mysten/dapp-kit/dist/index.css";
import "react-toastify/dist/ReactToastify.css";

// Layout Components
import Header from "../src/layouts/Header";
import Footer from "../src/layouts/footer";

// Loading Components
import SplashScreen from "../src/components/common/SplashScreen";

// Lazy-loaded Page Components
const Main = lazy(() => import("../src/pages/Main"));
const SwapPage = lazy(() => import("../src/pages/Swap"));
const Pool = lazy(() => import("../src/pages/pool"));
const Liquidity = lazy(() => import("../src/pages/liquidity"));
const RemoveLiquidity = lazy(() => import("../src/pages/RemoveLiquidity"));

// Page loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="relative w-12 h-12">
      <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-gray-700/30"></div>
      <div className="absolute top-0 left-0 w-full h-full rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"></div>
    </div>
  </div>
);

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial load time for splash screen
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Animation variants for page transitions
  const pageTransition = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3 },
  };

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Router>
      <Header />
      <AnimatePresence mode="wait">
        <motion.div
          className="min-h-screen text-white relative z-10"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageTransition}
        >
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Main />} />
              <Route path="/swap" element={<SwapPage />} />
              <Route path="/pool" element={<Pool />} />
              <Route path="/addliquidity" element={<Liquidity />} />
              <Route path="/removeliquidity" element={<RemoveLiquidity />} />

              {/* Handle 404s and redirects */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <Footer />
    </Router>
  );
}
