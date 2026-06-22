import { and, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  achievements,
  habitCheckins,
  memberAchievements,
  memberProgress,
  streaks,
  tasks,
  type Achievement,
} from "@db/schema";

type CompletionSource = "habit" | "task";
type Db = ReturnType<typeof getDb>;

const XP_PER_LEVEL = 100;

const DEFAULT_ACHIEVEMENTS = [
  {
    key: "first_step",
    title: "Bước đầu tiên",
    description: "Hoàn thành habit hoặc task đầu tiên.",
    icon: "sparkles",
    xpReward: 10,
    criteriaType: "total_completions",
    criteriaValue: 1,
  },
  {
    key: "streak_3",
    title: "Chuỗi 3 ngày",
    description: "Giữ streak 3 ngày liên tiếp.",
    icon: "flame",
    xpReward: 25,
    criteriaType: "current_streak",
    criteriaValue: 3,
  },
  {
    key: "streak_7",
    title: "Một tuần rực cháy",
    description: "Giữ streak 7 ngày liên tiếp.",
    icon: "flame",
    xpReward: 75,
    criteriaType: "current_streak",
    criteriaValue: 7,
  },
  {
    key: "xp_100",
    title: "100 XP",
    description: "Tích lũy 100 XP.",
    icon: "badge",
    xpReward: 20,
    criteriaType: "xp",
    criteriaValue: 100,
  },
  {
    key: "level_5",
    title: "Level 5",
    description: "Đạt level 5.",
    icon: "crown",
    xpReward: 100,
    criteriaType: "level",
    criteriaValue: 5,
  },
] satisfies Array<Omit<typeof achievements.$inferInsert, "id" | "createdAt">>;

export function calculateLevel(xp: number) {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function getCompletionXp(sourceType: CompletionSource, chymReward: number) {
  const baseXp = sourceType === "habit" ? 10 : 25;
  return baseXp + Math.max(0, chymReward) * 2;
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isSameUtcDay(a: Date, b: Date) {
  return startOfUtcDay(a) === startOfUtcDay(b);
}

function dayDistance(a: Date, b: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startOfUtcDay(b) - startOfUtcDay(a)) / dayMs);
}

export async function ensureDefaultAchievements(db: Db) {
  await Promise.all(
    DEFAULT_ACHIEVEMENTS.map((achievement) =>
      db.insert(achievements).values(achievement).onConflictDoNothing({
        target: achievements.key,
      })
    )
  );
}

export async function ensureMemberProgress(db: Db, memberId: number) {
  const progress = await db.query.memberProgress.findFirst({
    where: eq(memberProgress.memberId, memberId),
  });
  if (progress) return progress;

  const [created] = await db
    .insert(memberProgress)
    .values({ memberId })
    .returning();
  return created;
}

async function getCompletionCount(db: Db, memberId: number) {
  const [habitCompletions, taskCompletions] = await Promise.all([
    db.query.habitCheckins.findMany({
      where: and(eq(habitCheckins.memberId, memberId), eq(habitCheckins.status, "done")),
    }),
    db.query.tasks.findMany({
      where: and(eq(tasks.assignedTo, memberId), eq(tasks.status, "completed")),
    }),
  ]);

  return habitCompletions.length + taskCompletions.length;
}

function meetsCriteria(
  achievement: Achievement,
  stats: { totalCompletions: number; currentStreak: number; xp: number; level: number }
) {
  switch (achievement.criteriaType) {
    case "total_completions":
      return stats.totalCompletions >= achievement.criteriaValue;
    case "current_streak":
      return stats.currentStreak >= achievement.criteriaValue;
    case "xp":
      return stats.xp >= achievement.criteriaValue;
    case "level":
      return stats.level >= achievement.criteriaValue;
    default:
      return false;
  }
}

export async function awardCompletionProgress(input: {
  memberId: number;
  sourceType: CompletionSource;
  sourceId: number;
  chymReward: number;
}) {
  const db = getDb();
  const now = new Date();
  await ensureDefaultAchievements(db);

  const existingStreak = await db.query.streaks.findFirst({
    where: and(
      eq(streaks.memberId, input.memberId),
      eq(streaks.sourceType, input.sourceType),
      eq(streaks.sourceId, input.sourceId)
    ),
  });

  const alreadyCompletedToday =
    existingStreak?.lastCompletedAt && isSameUtcDay(existingStreak.lastCompletedAt, now);
  let currentStreak = existingStreak?.currentStreak ?? 0;
  let longestStreak = existingStreak?.longestStreak ?? 0;

  if (!alreadyCompletedToday) {
    currentStreak =
      existingStreak?.lastCompletedAt && dayDistance(existingStreak.lastCompletedAt, now) === 1
        ? existingStreak.currentStreak + 1
        : 1;
    longestStreak = Math.max(longestStreak, currentStreak);

    if (existingStreak) {
      await db
        .update(streaks)
        .set({ currentStreak, longestStreak, lastCompletedAt: now })
        .where(eq(streaks.id, existingStreak.id));
    } else {
      await db.insert(streaks).values({
        memberId: input.memberId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        currentStreak,
        longestStreak,
        lastCompletedAt: now,
      });
    }
  }

  const progress = await ensureMemberProgress(db, input.memberId);
  const completionXp = alreadyCompletedToday
    ? 0
    : getCompletionXp(input.sourceType, input.chymReward);
  let xp = progress.xp + completionXp;
  let level = calculateLevel(xp);

  if (completionXp > 0 || progress.level !== level) {
    await db
      .update(memberProgress)
      .set({ xp, level })
      .where(eq(memberProgress.memberId, input.memberId));
  }

  const [memberStreaks, allAchievements, unlockedAchievements, totalCompletions] =
    await Promise.all([
      db.query.streaks.findMany({ where: eq(streaks.memberId, input.memberId) }),
      db.query.achievements.findMany(),
      db.query.memberAchievements.findMany({
        where: eq(memberAchievements.memberId, input.memberId),
      }),
      getCompletionCount(db, input.memberId),
    ]);

  const unlockedIds = new Set(unlockedAchievements.map((achievement) => achievement.achievementId));
  const maxCurrentStreak = Math.max(currentStreak, ...memberStreaks.map((streak) => streak.currentStreak));
  const newlyUnlocked = allAchievements.filter(
    (achievement) =>
      !unlockedIds.has(achievement.id) &&
      meetsCriteria(achievement, {
        totalCompletions,
        currentStreak: maxCurrentStreak,
        xp,
        level,
      })
  );

  if (newlyUnlocked.length > 0) {
    await db
      .insert(memberAchievements)
      .values(
        newlyUnlocked.map((achievement) => ({
          memberId: input.memberId,
          achievementId: achievement.id,
        }))
      )
      .onConflictDoNothing();

    const achievementXp = newlyUnlocked.reduce(
      (total, achievement) => total + achievement.xpReward,
      0
    );
    if (achievementXp > 0) {
      xp += achievementXp;
      level = calculateLevel(xp);
      await db
        .update(memberProgress)
        .set({ xp, level })
        .where(eq(memberProgress.memberId, input.memberId));
    }
  }

  return {
    xp,
    level,
    xpAwarded: completionXp,
    currentStreak,
    longestStreak,
    achievementsUnlocked: newlyUnlocked,
  };
}
