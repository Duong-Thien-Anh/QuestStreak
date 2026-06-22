import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { habits, habitCheckins, houseMembers } from "@db/schema";
import { eq, and, gte } from "drizzle-orm";
import { awardCompletionProgress } from "./lib/gamification";
import { createNotification } from "./lib/notifications";

export const habitRouter = createRouter({
  list: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const allHabits = await db.query.habits.findMany({
        where: eq(habits.houseId, input.houseId),
      });
      return allHabits;
    }),

  create: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        type: z.enum(["wanted", "unwanted"]),
        frequency: z.enum(["daily", "weekly", "monthly"]),
        daysOfWeek: z.string().optional(),
        chymReward: z.number().min(0).default(0),
        chayPenalty: z.number().min(0).default(0),
        icon: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [habit] = await db
        .insert(habits)
        .values({
          houseId: input.houseId,
          title: input.title,
          description: input.description,
          type: input.type,
          frequency: input.frequency,
          daysOfWeek: input.daysOfWeek || null,
          chymReward: input.chymReward,
          chayPenalty: input.chayPenalty,
          icon: input.icon || "heart",
          createdBy: actor?.id || 0,
        })
        .returning({ id: habits.id });

      return { id: habit.id, ...input };
    }),

  delete: adminQuery
    .input(z.object({ habitId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(habits).where(eq(habits.id, input.habitId));
      return { success: true };
    }),

  checkin: authedQuery
    .input(z.object({ habitId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (!member) throw new Error("Member not found");
      const habit = await db.query.habits.findFirst({
        where: eq(habits.id, input.habitId),
      });
      if (!habit) throw new Error("Habit not found");

      // Check if already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existing = await db.query.habitCheckins.findFirst({
        where: and(
          eq(habitCheckins.habitId, input.habitId),
          eq(habitCheckins.memberId, member.id),
          gte(habitCheckins.checkedAt, today)
        ),
      });

      if (existing) {
        // Remove checkin (toggle off)
        await db.delete(habitCheckins).where(eq(habitCheckins.id, existing.id));
        return { checked: false };
      }

      await db.insert(habitCheckins).values({
        habitId: input.habitId,
        memberId: member.id,
        status: "done",
      });

      const progress = await awardCompletionProgress({
        memberId: member.id,
        sourceType: "habit",
        sourceId: input.habitId,
        chymReward: habit.chymReward,
      });

      await createNotification({
        houseId: habit.houseId,
        actorId: member.id,
        type: "habit_checked_in",
        title: "Habit đã được check-in",
        message: habit.title,
        entityType: "habit",
        entityId: habit.id,
        metadata: {
          xpAwarded: progress.xpAwarded,
          currentStreak: progress.currentStreak,
        },
      });

      await Promise.all(
        progress.achievementsUnlocked.map((achievement) =>
          createNotification({
            houseId: habit.houseId,
            recipientId: member.id,
            actorId: member.id,
            type: "achievement_unlocked",
            title: "Achievement đã mở khóa",
            message: achievement.title,
            entityType: "achievement",
            entityId: achievement.id,
            metadata: { key: achievement.key, xpReward: achievement.xpReward },
          })
        )
      );

      return { checked: true, progress };
    }),

  getCheckins: authedQuery
    .input(z.object({ habitId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (!member) return [];

      return db.query.habitCheckins.findMany({
        where: and(
          eq(habitCheckins.habitId, input.habitId),
          eq(habitCheckins.memberId, member.id)
        ),
      });
    }),
});
