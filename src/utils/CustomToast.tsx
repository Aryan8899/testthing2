// CustomToast.tsx
import React from "react";
import {
  ToastContainer,
  toast as originalToast,
  cssTransition,
  ToastOptions,
} from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AlertCircle, CheckCircle, XCircle, Info, X } from "lucide-react";

// Fix TypeScript error by properly defining the transition
const slideTransition = cssTransition({
  enter: "toast-slide-in",
  exit: "toast-slide-out",
  appendPosition: false,
  collapse: true,
  collapseDuration: 300,
});

// Extend the original toast with styled versions
const toast = {
  ...originalToast,
  success: (message: string | React.ReactNode, options?: ToastOptions) => {
    return originalToast.success(message, {
      icon: <CheckCircle className="w-5 h-5 text-emerald-400" />,
      className:
        "!bg-gray-900/95 backdrop-blur-lg border border-emerald-500/30 shadow-lg shadow-emerald-500/10 text-white",
      ...options,
    });
  },
  error: (message: string | React.ReactNode, options?: ToastOptions) => {
    return originalToast.error(message, {
      icon: <XCircle className="w-5 h-5 text-rose-400" />,
      className:
        "!bg-gray-900/95 backdrop-blur-lg border border-rose-500/30 shadow-lg shadow-rose-500/10 text-white",
      ...options,
    });
  },
  info: (message: string | React.ReactNode, options?: ToastOptions) => {
    return originalToast.info(message, {
      icon: <Info className="w-5 h-5 text-cyan-400" />,
      className:
        "!bg-gray-900/95 backdrop-blur-lg border border-cyan-500/30 shadow-lg shadow-cyan-500/10 text-white",
      ...options,
    });
  },
  warning: (message: string | React.ReactNode, options?: ToastOptions) => {
    return originalToast.warning(message, {
      icon: <AlertCircle className="w-5 h-5 text-amber-400" />,
      className:
        "!bg-gray-900/95 backdrop-blur-lg border border-amber-500/30 shadow-lg shadow-amber-500/10 text-white",
      ...options,
    });
  },
  loading: (message: string | React.ReactNode, options?: ToastOptions) => {
    return originalToast.loading(message, {
      className:
        "!bg-gray-900/95 backdrop-blur-lg border border-indigo-500/30 shadow-lg shadow-indigo-500/10 text-white",
      ...options,
    });
  },
};

// Styled toast container component
export const StyledToastContainer = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="dark"
      transition={slideTransition}
      closeButton={({ closeToast }) => (
        <button
          onClick={closeToast}
          className="p-1 rounded-full hover:bg-gray-700/50"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
      // Fix TypeScript errors by using valid props
      toastClassName={() => "rounded-xl p-4 min-h-0 min-w-[300px] shadow-xl"}
      className="toast-container"
    />
  );
};

// Export our enhanced toast as the default
export default toast;
