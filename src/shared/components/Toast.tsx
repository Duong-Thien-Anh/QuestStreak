import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  visible: boolean;
  onClose: () => void;
}

export function Toast({ message, type, visible, onClose }: ToastProps) {
  const iconColor =
    type === "success" ? "#00F2FE" : type === "error" ? "#FF3B30" : "#A155FF";

  const Icon = type === "success" ? CheckCircle : type === "error" ? XCircle : Info;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-16 left-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl bg-[#1A1A22] border border-white/10 shadow-xl"
        >
          <Icon className="w-5 h-5 flex-shrink-0" style={{ color: iconColor }} />
          <span className="text-sm text-white/90 flex-1">{message}</span>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
