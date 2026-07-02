import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  appSettings,
  achievements,
  memberAchievements,
  memberProgress,
  streaks,
  tasks,
  type Achievement,
} from "@db/schema";

type CompletionSource = "task";
type Db = ReturnType<typeof getDb>;

const XP_PER_LEVEL = 100;
const DEFAULT_TASK_XP = 25;
export const DEFAULT_TASK_XP_SETTING_KEY = "default_task_xp";

async function ensureAppSettingsTable(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "appSettings" (
      "key" varchar(100) PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);
}

const DEFAULT_ACHIEVEMENTS = [
  {
    key: "first_step",
    title: "Bước đầu tiên",
    description: "Hoàn thành task đầu tiên.",
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

export async function getDefaultTaskXp(db: Db = getDb()) {
  try {
    await ensureAppSettingsTable(db);
    const setting = await db.query.appSettings.findFirst({
      where: eq(appSettings.key, DEFAULT_TASK_XP_SETTING_KEY),
    });
    const value = Number(setting?.value);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_TASK_XP;
  } catch {
    return DEFAULT_TASK_XP;
  }
}

export async function setDefaultTaskXp(value: number, db: Db = getDb()) {
  await ensureAppSettingsTable(db);
  const normalized = String(Math.max(0, Math.floor(value)));
  await db
    .insert(appSettings)
    .values({ key: DEFAULT_TASK_XP_SETTING_KEY, value: normalized })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: normalized },
    });
  return Number(normalized);
}

export function getCompletionXp(chymReward: number, baseXp = DEFAULT_TASK_XP) {
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
  const taskCompletions = await db.query.tasks.findMany({
    where: and(eq(tasks.assignedTo, memberId), eq(tasks.status, "completed")),
  });

  return taskCompletions.length;
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
  bonusXp?: number;
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
  const defaultTaskXp = await getDefaultTaskXp(db);
  const completionXp = alreadyCompletedToday
    ? 0
    : getCompletionXp(input.chymReward, defaultTaskXp) + Math.max(0, input.bonusXp ?? 0);
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
      db.query.streaks.findMany({
        where: and(eq(streaks.memberId, input.memberId), eq(streaks.sourceType, "task")),
      }),
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
