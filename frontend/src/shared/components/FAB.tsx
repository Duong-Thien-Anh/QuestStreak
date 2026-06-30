import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import { useAppStore } from "@/shared/store/useAppStore";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

interface FABAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  color?: string;
}

interface FABProps {
  actions: FABAction[];
}

export function FAB({ actions }: FABProps) {
  const { fabOpen, setFabOpen } = useAppStore();
  const { isAdmin } = useCurrentUser();

  if (!isAdmin) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex flex-col items-end">
      <AnimatePresence>
        {fabOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFabOpen(false)}
              className="fixed inset-0 bg-black/50 z-[-1]"
            />
            {/* Action buttons */}
            {actions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, scale: 0, y: 0 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: -(i + 1) * 64,
                }}
                exit={{ opacity: 0, scale: 0, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: i * 0.05,
                }}
                onClick={() => {
                  action.onClick();
                  setFabOpen(false);
                }}
                className="absolute bottom-0 right-0 flex items-center gap-3"
              >
                <span className="text-sm font-medium text-white/90 bg-[#1A1A22] px-3 py-1.5 rounded-lg border border-white/10 whitespace-nowrap shadow-lg">
                  {action.label}
                </span>
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: action.color || "#FF2A85",
                    boxShadow: `0 4px 16px ${action.color || "#FF2A85"}40`,
                  }}
                >
                  {action.icon}
                </div>
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setFabOpen(!fabOpen)}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FF2A85] leading-none shadow-neon-pink"
      >
        <motion.div
          animate={{ rotate: fabOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
        >
          <Plus className="block h-6 w-6 text-white" />
        </motion.div>
      </motion.button>
    </div>
  );
}
