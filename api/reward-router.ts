import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { rewards, rewardPurchases, wallets, houseMembers, logs } from "@db/schema";
import { eq } from "drizzle-orm";

export const rewardRouter = createRouter({
  list: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.rewards.findMany({
        where: eq(rewards.houseId, input.houseId),
      });
    }),

  create: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        cost: z.number().min(0).default(0),
        image: z.string().optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).default("common"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [reward] = await db
        .insert(rewards)
        .values({
          houseId: input.houseId,
          title: input.title,
          description: input.description,
          cost: input.cost,
          image: input.image,
          rarity: input.rarity,
          createdBy: actor?.id || 0,
        })
        .$returningId();

      return { id: reward.id, ...input };
    }),

  update: adminQuery
    .input(
      z.object({
        rewardId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        cost: z.number().min(0).optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.cost !== undefined) updateData.cost = input.cost;
      if (input.rarity !== undefined) updateData.rarity = input.rarity;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(rewards).set(updateData).where(eq(rewards.id, input.rewardId));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ rewardId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(rewards).where(eq(rewards.id, input.rewardId));
      return { success: true };
    }),

  purchase: authedQuery
    .input(z.object({ rewardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const reward = await db.query.rewards.findFirst({
        where: eq(rewards.id, input.rewardId),
      });
      if (!reward) throw new Error("Reward not found");

      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (!member) throw new Error("Member not found");

      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, member.id),
      });
      if (!wallet || wallet.chymBalance < reward.cost) {
        throw new Error("Insufficient Chym balance");
      }

      // Deduct Chym
      await db
        .update(wallets)
        .set({ chymBalance: wallet.chymBalance - reward.cost })
        .where(eq(wallets.memberId, member.id));

      // Create purchase record
      await db.insert(rewardPurchases).values({
        rewardId: input.rewardId,
        memberId: member.id,
      });

      await db.insert(logs).values({
        houseId: member.houseId,
        action: "REWARD_PURCHASED",
        actorId: member.id,
        targetId: member.id,
        details: JSON.stringify({ rewardId: reward.id, cost: reward.cost }),
      });

      return { success: true, newBalance: wallet.chymBalance - reward.cost };
    }),

  gift: adminQuery
    .input(
      z.object({
        rewardId: z.number(),
        memberId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const reward = await db.query.rewards.findFirst({
        where: eq(rewards.id, input.rewardId),
      });
      if (!reward) throw new Error("Reward not found");

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(rewardPurchases).values({
        rewardId: input.rewardId,
        memberId: input.memberId,
        giftedBy: actor?.id || 0,
      });

      await db.insert(logs).values({
        houseId: reward.houseId,
        action: "REWARD_GIFTED",
        actorId: actor?.id || 0,
        targetId: input.memberId,
        details: JSON.stringify({ rewardId: reward.id }),
      });

      return { success: true };
    }),

  myPurchases: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const member = await db.query.houseMembers.findFirst({
      where: eq(houseMembers.userId, ctx.user.id),
    });
    if (!member) return [];

    return db.query.rewardPurchases.findMany({
      where: eq(rewardPurchases.memberId, member.id),
    });
  }),
});
