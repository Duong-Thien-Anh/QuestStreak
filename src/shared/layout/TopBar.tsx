import { useAppStore } from "@/shared/store/useAppStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import { Menu, Crown, LogOut } from "lucide-react";
import { NotificationBell } from "@/shared/components/NotificationBell";

export function TopBar() {
  const { setManagementPanel } = useAppStore();
  const { logout, isLoading: isLoggingOut } = useAuth();
  const houseQuery = trpc.house.get.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const roomName = houseQuery.data?.name ?? "Lunis House";

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-[#0D0D11]/95 backdrop-blur-sm z-50 border-b border-white/5 flex items-center justify-between px-4">
      <div className="w-20 flex justify-start">
        <button
          onClick={() => setManagementPanel("account")}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Mở menu tài khoản"
          title="Menu tài khoản"
        >
          <Menu className="w-5 h-5 text-white/70" />
        </button>
      </div>

      <button
        onClick={() => setManagementPanel("room")}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 hover:border-[#FF2A85]/50 hover:bg-[#FF2A85]/5 transition-all group"
      >
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#FF2A85] to-[#A155FF] flex items-center justify-center">
          <Crown className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold text-white/90 group-hover:text-[#FF2A85] transition-colors">
          {roomName}
        </span>
      </button>

      <div className="w-20 flex items-center justify-end gap-1">
        {/* Notification Bell — visible to all */}
        <NotificationBell />

        <button
          onClick={logout}
          disabled={isLoggingOut}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut className="w-5 h-5 text-white/70" />
        </button>
      </div>
    </header>
  );
}
