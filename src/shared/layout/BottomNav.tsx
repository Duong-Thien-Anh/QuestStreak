import { useAppStore, type Tab } from "@/shared/store/useAppStore";
import { CheckSquare, ShoppingBag, AlertOctagon, BookOpen } from "lucide-react";

const tabs: { key: Tab; label: string; icon: typeof CheckSquare; color: string }[] = [
  { key: "tasks", label: "Nhiệm vụ", icon: CheckSquare, color: "#FF2A85" },
  { key: "shop", label: "Phần thưởng", icon: ShoppingBag, color: "#A155FF" },
  { key: "punishments", label: "Hình phạt", icon: AlertOctagon, color: "#FF3B30" },
  { key: "notebook", label: "Sổ tay", icon: BookOpen, color: "#00F2FE" },
];

export function BottomNav() {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#0D0D11]/95 backdrop-blur-sm border-t border-white/5 z-50">
      <div className="flex items-center justify-around h-full px-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl transition-all relative"
              style={{
                color: isActive ? tab.color : "#52525B",
              }}
            >
              {isActive && (
                <div
                  className="absolute inset-0 rounded-xl opacity-10"
                  style={{
                    background: `radial-gradient(circle at center, ${tab.color}, transparent 70%)`,
                  }}
                />
              )}
              <Icon
                className="w-5 h-5 transition-transform"
                style={{
                  strokeWidth: isActive ? 2.5 : 1.5,
                }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  color: isActive ? tab.color : "#52525B",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
