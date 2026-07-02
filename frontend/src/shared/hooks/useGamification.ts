import { trpc } from "@/providers/trpc";

/**
 * Hook to fetch gamification data (XP, level, streaks, achievements)
 * for a given memberId. Falls back to defaults when no data is available.
 */
export function useGamification(memberId: number | undefined) {
  const query = trpc.gamification.summary.useQuery(
    { memberId: memberId ?? 0 },
    {
      enabled: !!memberId,
      staleTime: 1000 * 60 * 2, // 2 min cache
      retry: false,
    }
  );

  const data = query.data;

  // XP config: 100 XP per level
  const XP_PER_LEVEL = 100;
  const xp = data?.wallet.xp ?? 0;
  const level = data?.wallet.level ?? 1;
  const levelTitle = data?.wallet.levelTitle ?? "Người mới";
  const xpInCurrentLevel = xp % XP_PER_LEVEL;
  const xpProgress = (xpInCurrentLevel / XP_PER_LEVEL) * 100;

  // Aggregate streak info across tracked tasks.
  const streaks = data?.streaks ?? [];
  const maxCurrentStreak = streaks.length
    ? Math.max(...streaks.map((s) => s.currentStreak))
    : 0;
  const maxLongestStreak = streaks.length
    ? Math.max(...streaks.map((s) => s.longestStreak))
    : 0;

  // Achievement counts
  const achievements = data?.achievements ?? [];
  const unlockedCount = achievements.filter((a) => a.unlockedAt !== null).length;
  const totalCount = achievements.length;

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    // Raw
    xp,
    level,
    levelTitle,
    streaks,
    achievements,
    // Computed
    xpInCurrentLevel,
    xpProgress,
    maxCurrentStreak,
    maxLongestStreak,
    unlockedCount,
    totalCount,
    // Wallet
    chymBalance: data?.wallet.chymBalance ?? 0,
    chayBalance: data?.wallet.chayBalance ?? 0,
  };
}
