import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Flame,
  Zap,
  Crown,
  Trophy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BadgeCheck,
  Shield,
  Star,
} from "lucide-react";
import { useGamification } from "@/shared/hooks/useGamification";

// ─── Utility: icon map for achievement icons ───────────────────────────────

const iconMap: Record<string, React.ReactNode> = {
  sparkles: <Sparkles className="w-4 h-4" />,
  flame: <Flame className="w-4 h-4" />,
  badge: <BadgeCheck className="w-4 h-4" />,
  crown: <Crown className="w-4 h-4" />,
  trophy: <Trophy className="w-4 h-4" />,
  shield: <Shield className="w-4 h-4" />,
  star: <Star className="w-4 h-4" />,
  zap: <Zap className="w-4 h-4" />,
};

// ─── Streak Heatmap (last 7 slots) ────────────────────────────────────────

function StreakDots({ current, max }: { current: number; max: number }) {
  const count = 7;
  // Fill slots: show how many consecutive days are "active" up to current streak
  return (
    <div className="flex gap-1" role="img" aria-label={`${current} ngày streak`}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i < Math.min(current, count);
        const isToday = i === Math.min(current, count) - 1 && current > 0;
        return (
          <div
            key={i}
            title={active ? `Ngày ${i + 1}` : ""}
            className={`w-4 h-4 rounded-sm transition-all duration-300 ${
              active
                ? isToday
                  ? "bg-[#FF2A85] shadow-[0_0_8px_rgba(255,42,133,0.7)]"
                  : "bg-[#FF2A85]/70"
                : "bg-white/8"
            }`}
            style={{
              opacity: active ? 0.4 + 0.6 * ((i + 1) / Math.max(current, 1)) : 0.12,
            }}
          />
        );
      })}
      {max > count && (
        <span className="text-[10px] text-white/30 self-center ml-0.5">+{max - count}</span>
      )}
    </div>
  );
}

// ─── XP Progress Bar ──────────────────────────────────────────────────────

function XpBar({ xpProgress, xpInCurrentLevel }: { xpProgress: number; xpInCurrentLevel: number }) {
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-white/8 overflow-hidden">
        {/* Glow track */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${xpProgress}%` }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
          className="h-full rounded-full relative"
          style={{
            background: "linear-gradient(90deg, #A155FF, #FF2A85)",
          }}
        >
          {/* Animated shimmer */}
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              backgroundSize: "200% 100%",
            }}
          />
        </motion.div>
      </div>
      <div className="flex justify-between">
        <span className="text-[10px] text-white/30">{xpInCurrentLevel} XP</span>
        <span className="text-[10px] text-white/30">100 XP</span>
      </div>
    </div>
  );
}

// ─── Achievement Badge ─────────────────────────────────────────────────────

function AchievementBadge({
  title,
  icon,
  unlocked,
  xpReward,
}: {
  title: string;
  icon: string;
  unlocked: boolean;
  xpReward: number;
}) {
  return (
    <div
      title={title}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all duration-300 min-w-[64px] ${
        unlocked
          ? "border-[#A155FF]/50 bg-[#A155FF]/10 shadow-[0_0_12px_rgba(161,85,255,0.15)]"
          : "border-white/5 bg-white/3 opacity-40 grayscale"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          unlocked
            ? "bg-gradient-to-br from-[#A155FF] to-[#FF2A85] text-white"
            : "bg-white/10 text-white/30"
        }`}
      >
        {iconMap[icon] ?? <Trophy className="w-4 h-4" />}
      </div>
      <span className="text-[9px] text-center leading-tight text-white/60 line-clamp-2 w-full">
        {title}
      </span>
      {unlocked && (
        <span className="text-[8px] text-[#A155FF] font-semibold">+{xpReward} XP</span>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface GamificationPanelProps {
  memberId: number | undefined;
  memberName?: string;
}

export function GamificationPanel({ memberId, memberName }: GamificationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    isLoading,
    xp,
    level,
    xpInCurrentLevel,
    xpProgress,
    maxCurrentStreak,
    maxLongestStreak,
    achievements,
    unlockedCount,
    totalCount,
    levelTitle,
  } = useGamification(memberId);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-[#1A1A22] rounded-2xl border border-white/5 p-4 animate-pulse"
      >
        <div className="h-4 w-1/3 bg-white/10 rounded mb-3" />
        <div className="h-2 w-full bg-white/5 rounded-full mb-2" />
        <div className="flex gap-2">
          <div className="h-3 w-12 bg-white/5 rounded" />
          <div className="h-3 w-12 bg-white/5 rounded" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.35 }}
      className="bg-[#1A1A22] rounded-2xl border border-white/5 overflow-hidden"
    >
      {/* ── Collapsed Header (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 flex items-center justify-between group hover:bg-white/2 transition-colors"
        aria-expanded={expanded}
      >
        {/* Left: level badge + name */}
        <div className="flex items-center gap-3">
          {/* Level circle */}
          <div
            className="relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              background:
                "conic-gradient(#FF2A85 0%, #A155FF 50%, #1A1A22 50%)",
              padding: "2px",
            }}
          >
            <div className="w-full h-full rounded-full bg-[#1A1A22] flex items-center justify-center">
              <span className="text-sm font-bold text-white">{level}</span>
            </div>
          </div>

          <div className="text-left">
            <p className="text-xs text-white/40 uppercase tracking-wider leading-none mb-0.5">
              {levelTitle}
            </p>
            <p className="text-sm font-semibold text-white leading-none">
              {memberName ?? "Thành viên"}
            </p>
          </div>
        </div>

        {/* Center: streak fire */}
        <div className="flex items-center gap-4">
          {/* Streak indicator */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
              maxCurrentStreak > 0
                ? "border-[#FF6B35]/30 bg-[#FF6B35]/10"
                : "border-white/5 bg-white/3"
            }`}
          >
            <Flame
              className={`w-4 h-4 transition-colors ${
                maxCurrentStreak > 0 ? "text-[#FF6B35]" : "text-white/20"
              }`}
              style={
                maxCurrentStreak > 0
                  ? { filter: "drop-shadow(0 0 4px rgba(255,107,53,0.6))" }
                  : {}
              }
            />
            <span
              className={`text-sm font-bold tabular-nums ${
                maxCurrentStreak > 0 ? "text-[#FF6B35]" : "text-white/20"
              }`}
            >
              {maxCurrentStreak}
            </span>
          </div>

          {/* XP pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#A155FF]/30 bg-[#A155FF]/10">
            <Zap className="w-3.5 h-3.5 text-[#A155FF]" />
            <span className="text-sm font-bold text-[#A155FF] tabular-nums">{xp}</span>
          </div>
        </div>

        {/* Right: expand icon */}
        <div className="text-white/30 group-hover:text-white/50 transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* ── Expanded Detail ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="gamification-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-5 border-t border-white/5 pt-4">

              {/* XP Progress */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#A155FF]" />
                    <span className="text-xs font-semibold text-white/70">
                      Level {level} · {levelTitle}
                    </span>
                  </div>
                  <span className="text-xs text-white/40 tabular-nums">
                    {xp} XP tổng
                  </span>
                </div>
                <XpBar xpProgress={xpProgress} xpInCurrentLevel={xpInCurrentLevel} />
                <p className="text-[10px] text-white/30 mt-1 text-right">
                  {100 - xpInCurrentLevel} XP đến Level {level + 1}
                </p>
              </div>

              {/* Streak Info */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-[#FF6B35]" />
                  <span className="text-xs font-semibold text-white/70">Streak</span>
                  {maxCurrentStreak >= 7 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF6B35]/20 text-[#FF6B35] font-semibold">
                      🔥 On fire!
                    </span>
                  )}
                </div>

                <StreakDots current={maxCurrentStreak} max={maxLongestStreak} />

                <div className="flex gap-4 mt-3">
                  <div className="flex-1 bg-[#141418] rounded-xl p-3 border border-white/5">
                    <p className="text-xl font-bold text-[#FF6B35] tabular-nums">
                      {maxCurrentStreak}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">Streak hiện tại</p>
                  </div>
                  <div className="flex-1 bg-[#141418] rounded-xl p-3 border border-white/5">
                    <p className="text-xl font-bold text-white/60 tabular-nums">
                      {maxLongestStreak}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">Kỷ lục dài nhất</p>
                  </div>
                  <div className="flex-1 bg-[#141418] rounded-xl p-3 border border-white/5">
                    <p className="text-xl font-bold text-[#A155FF] tabular-nums">
                      {unlockedCount}/{totalCount}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5">Thành tích</p>
                  </div>
                </div>
              </div>

              {/* Achievements */}
              {achievements.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-[#FFD700]" />
                    <span className="text-xs font-semibold text-white/70">Thành tích</span>
                    <span className="ml-auto text-[10px] text-white/30">
                      {unlockedCount} đã mở khoá
                    </span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                    {achievements.map((a) => (
                      <AchievementBadge
                        key={a.id}
                        title={a.title}
                        icon={a.icon ?? "trophy"}
                        unlocked={a.unlockedAt !== null}
                        xpReward={a.xpReward}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
