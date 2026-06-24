import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Gift,
  Send,
  Trophy,
  XCircle,
  CheckCheck,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

// ─── Types ────────────────────────────────────────────────────────────────

type NotificationType =
  | "task_assigned"
  | "task_submitted"
  | "task_completed"
  | "task_rejected"
  | "reward_gifted"
  | "achievement_unlocked"
  | "system";

interface Notification {
  id: number;
  houseId: number;
  recipientId: number | null;
  actorId: number | null;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: number | null;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function relativeTime(date: Date | string): string {
  const now = Date.now();
  const d = new Date(date).getTime();
  const diff = now - d;
  if (diff < 60_000) return "Vừa xong";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return `${Math.floor(diff / 86_400_000)} ngày trước`;
}

function getTypeIcon(type: string) {
  const cls = "w-4 h-4 flex-shrink-0";
  switch (type as NotificationType) {
    case "task_assigned":
      return <ClipboardList className={cls} style={{ color: "#00F2FE" }} />;
    case "task_submitted":
      return <Send className={cls} style={{ color: "#A155FF" }} />;
    case "task_completed":
      return <CheckCircle2 className={cls} style={{ color: "#34D399" }} />;
    case "task_rejected":
      return <XCircle className={cls} style={{ color: "#FF3B30" }} />;
    case "reward_gifted":
      return <Gift className={cls} style={{ color: "#FFD700" }} />;
    case "achievement_unlocked":
      return <Trophy className={cls} style={{ color: "#FFD700" }} />;
    default:
      return <Bell className={cls} style={{ color: "#A155FF" }} />;
  }
}

function getTypeColor(type: string): string {
  switch (type as NotificationType) {
    case "task_assigned":    return "#00F2FE";
    case "task_submitted":   return "#A155FF";
    case "task_completed":   return "#34D399";
    case "task_rejected":    return "#FF3B30";
    case "reward_gifted":    return "#FFD700";
    case "achievement_unlocked": return "#FFD700";
    default:                 return "#A155FF";
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const houseQuery = trpc.house.get.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });
  const houseId = houseQuery.data?.id;

  const utils = trpc.useUtils();

  // Poll unread count every 30s
  const countQuery = trpc.notification.unreadCount.useQuery(
    { houseId: houseId ?? 0 },
    {
      enabled: !!houseId,
      refetchInterval: 30_000,
      staleTime: 15_000,
    }
  );
  const unreadCount = countQuery.data?.count ?? 0;

  // Load notifications only when dropdown is open
  const listQuery = trpc.notification.list.useQuery(
    { houseId: houseId ?? 0, limit: 50 },
    {
      enabled: !!houseId && open,
      staleTime: 10_000,
    }
  );

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      void utils.notification.unreadCount.invalidate();
      void utils.notification.list.invalidate();
    },
  });

  const markAllMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notification.unreadCount.invalidate();
      void utils.notification.list.invalidate();
    },
  });

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleNotificationClick = (n: Notification) => {
    if (n.recipientId !== null && !n.readAt) {
      markReadMutation.mutate({ notificationId: n.id });
    }
  };

  const handleMarkAll = () => {
    if (!houseId) return;
    markAllMutation.mutate({ houseId });
  };

  const notifications: Notification[] = (listQuery.data as Notification[] | undefined) ?? [];

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
        aria-label="Thông báo"
        title="Thông báo"
      >
        <Bell className="w-5 h-5 text-white/70" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-[#FF2A85] rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-[0_0_8px_rgba(255,42,133,0.6)]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="notif-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed top-14 right-2 w-80 max-h-[480px] bg-[#1A1A22]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-[60] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#A155FF]" />
                <h3 className="text-sm font-semibold text-white">Thông báo</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FF2A85]/20 text-[#FF2A85] font-semibold">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  disabled={markAllMutation.isPending}
                  className="flex items-center gap-1 text-[11px] text-white/40 hover:text-[#A155FF] transition-colors disabled:opacity-40"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Đọc hết
                </button>
              )}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Loading */}
              {listQuery.isLoading && (
                <div className="space-y-0">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-4 py-3 border-b border-white/5 animate-pulse">
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-white/5 flex-shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 bg-white/5 rounded w-3/4" />
                          <div className="h-2.5 bg-white/5 rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty */}
              {!listQuery.isLoading && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-sm text-white/30">Chưa có thông báo nào</p>
                </div>
              )}

              {/* Items */}
              {notifications.map((n) => {
                const isUnread = n.recipientId !== null && !n.readAt;
                const color = getTypeColor(n.type);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition-all hover:bg-white/3 relative ${
                      isUnread ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    {/* Unread left bar */}
                    {isUnread && (
                      <span
                        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${color}15` }}
                      >
                        {getTypeIcon(n.type)}
                      </div>
                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-snug ${isUnread ? "text-white" : "text-white/60"}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2 leading-snug">
                            {n.message}
                          </p>
                        )}
                        <p className="text-[10px] text-white/25 mt-1">
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                      {/* Unread dot */}
                      {isUnread && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                          style={{ backgroundColor: color }}
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
