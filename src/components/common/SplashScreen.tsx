import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { suidex } from "../../assets"; // Import the SUIDEX logo

const SplashScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);

  // Simulate loading progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 15;
        return next > 100 ? 100 : next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#080e24] flex flex-col items-center justify-center z-50">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 bg-indigo-500/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-1/3 h-1/3 bg-cyan-500/20 rounded-full blur-[80px] animate-pulse-slow" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo animation with image instead of text */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="relative flex justify-center">
            {/* SUIDEX logo image */}
            <motion.img
              src={suidex}
              alt="SuiDeX Logo"
              className="h-16 w-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
            />

            {/* Animated rings around logo */}
            <motion.div
              className="absolute -inset-4 border border-indigo-500/20 rounded-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                repeatType: "reverse",
              }}
            />
            <motion.div
              className="absolute -inset-8 border border-cyan-500/10 rounded-full"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatType: "reverse",
                delay: 0.2,
              }}
            />
          </div>
        </motion.div>

        {/* Loading bar */}
        <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>

        {/* Loading text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={Math.floor(progress / 25)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-gray-400 text-sm"
          >
            {progress < 25 && "Connecting to Sui Network..."}
            {progress >= 25 && progress < 50 && "Loading Protocol Data..."}
            {progress >= 50 && progress < 75 && "Initializing DEX Interface..."}
            {progress >= 75 && progress < 100 && "Almost Ready..."}
            {progress >= 100 && "Welcome to SuiDex!"}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Version number */}
      <motion.div
        className="absolute bottom-4 text-xs text-gray-600"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 0.5 }}
      >
        v1.0.0
      </motion.div>
    </div>
  );
};

export default SplashScreen;
