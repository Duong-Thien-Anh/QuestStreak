import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { memberAchievements, memberProgress, streaks, wallets } from "@db/schema";
import { ensureDefaultAchievements } from "./lib/gamification";

export const gamificationRouter = createRouter({
  summary: authedQuery
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      await ensureDefaultAchievements(db);

      const [wallet, progress, memberStreaks, allAchievements, unlockedRows] = await Promise.all([
        db.query.wallets.findFirst({
          where: eq(wallets.memberId, input.memberId),
        }),
        db.query.memberProgress.findFirst({
          where: eq(memberProgress.memberId, input.memberId),
        }),
        db.query.streaks.findMany({
          where: and(eq(streaks.memberId, input.memberId), eq(streaks.sourceType, "task")),
        }),
        db.query.achievements.findMany(),
        db.query.memberAchievements.findMany({
          where: eq(memberAchievements.memberId, input.memberId),
        }),
      ]);

      const unlockedByAchievementId = new Map(
        unlockedRows.map((row) => [row.achievementId, row])
      );

      return {
        wallet: {
          ...(wallet || { chymBalance: 0, chayBalance: 0 }),
          xp: progress?.xp ?? 0,
          level: progress?.level ?? 1,
        },
        streaks: memberStreaks,
        achievements: allAchievements.map((achievement) => ({
          ...achievement,
          unlockedAt: unlockedByAchievementId.get(achievement.id)?.unlockedAt ?? null,
        })),
      };
    }),
});
