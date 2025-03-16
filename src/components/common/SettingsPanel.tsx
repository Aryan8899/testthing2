import React from "react";
import { motion } from "framer-motion";
import { Settings, Info, Clock } from "lucide-react";

interface SettingsPanelProps {
  slippage: number;
  setSlippage: (value: number) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  slippage,
  setSlippage,
  onClose,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-4 p-6 rounded-xl bg-indigo-900/20 backdrop-blur-lg border border-indigo-500/30 shadow-xl"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-cyan-400" />
          <span>Transaction Settings</span>
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400" />
            Slippage Tolerance (%)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[0.1, 0.5, 1.0, 5.0].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setSlippage(value);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  Number(slippage) === value
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-gray-800/70 text-gray-300 hover:bg-gray-700/80"
                }`}
              >
                {value}%
              </button>
            ))}
            <input
              type="text"
              value={slippage === 0 ? "" : slippage}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "") {
                  setSlippage(0);
                } else {
                  const parsed = parseFloat(value);
                  if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                    setSlippage(parsed);
                  }
                }
              }}
              className="px-3 py-2 border rounded-lg bg-gray-800/70 text-gray-300 border-indigo-500/30 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              placeholder="Custom"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Transaction Deadline
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="w-20 px-3 py-2 border rounded-lg bg-gray-800/70 text-gray-300 border-indigo-500/30 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
              defaultValue={20}
              min={1}
              max={60}
            />
            <span className="text-gray-300">minutes</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPanel;
