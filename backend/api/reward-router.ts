import { z } from "zod";
import { createRouter, authedQuery, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  rewards,
  rewardPurchases,
  rewardGiftDetails,
  wallets,
  houseMembers,
  logs,
} from "@db/schema";
import { and, count, eq } from "drizzle-orm";
import { createNotification } from "./lib/notifications";

export const rewardRouter = createRouter({
  list: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rewardRows = await db.query.rewards.findMany({
        where: eq(rewards.houseId, input.houseId),
      });
      const purchaseRows = await db.query.rewardPurchases.findMany();

      return rewardRows.map((reward) => ({
        ...reward,
        purchaseCount: purchaseRows.filter((purchase) => purchase.rewardId === reward.id).length,
      }));
    }),

  create: domQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        cost: z.number().min(0).default(0),
        purchaseLimit: z.number().int().min(0).nullable().optional(),
        purchaseLimitPerUser: z.number().int().min(0).nullable().optional(),
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
          purchaseLimit: input.purchaseLimit ?? null,
          purchaseLimitPerUser: input.purchaseLimitPerUser ?? null,
          image: input.image,
          rarity: input.rarity,
          createdBy: actor?.id || 0,
        })
        .returning({ id: rewards.id });

      return { id: reward.id, ...input };
    }),

  update: domQuery
    .input(
      z.object({
        rewardId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        cost: z.number().min(0).optional(),
        purchaseLimit: z.number().int().min(0).nullable().optional(),
        purchaseLimitPerUser: z.number().int().min(0).nullable().optional(),
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
      if (input.purchaseLimit !== undefined) updateData.purchaseLimit = input.purchaseLimit;
      if (input.purchaseLimitPerUser !== undefined) {
        updateData.purchaseLimitPerUser = input.purchaseLimitPerUser;
      }
      if (input.rarity !== undefined) updateData.rarity = input.rarity;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(rewards).set(updateData).where(eq(rewards.id, input.rewardId));
      return { success: true };
    }),

  delete: domQuery
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

      if (reward.purchaseLimit !== null) {
        const [totalPurchases] = await db
          .select({ value: count() })
          .from(rewardPurchases)
          .where(eq(rewardPurchases.rewardId, reward.id));
        if (Number(totalPurchases?.value ?? 0) >= reward.purchaseLimit) {
          throw new Error("Reward này đã hết lượt mua");
        }
      }

      if (reward.purchaseLimitPerUser !== null) {
        const [memberPurchases] = await db
          .select({ value: count() })
          .from(rewardPurchases)
          .where(
            and(
              eq(rewardPurchases.rewardId, reward.id),
              eq(rewardPurchases.memberId, member.id),
            ),
          );
        if (Number(memberPurchases?.value ?? 0) >= reward.purchaseLimitPerUser) {
          throw new Error("Bạn đã đạt giới hạn mua reward này");
        }
      }

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

  gift: domQuery
    .input(
      z.object({
        rewardId: z.number(),
        memberId: z.number(),
        giftMessage: z.string().max(2000).optional(),
        giftReason: z.string().max(2000).optional(),
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

      const [purchase] = await db
        .insert(rewardPurchases)
        .values({
          rewardId: input.rewardId,
          memberId: input.memberId,
          giftedBy: actor?.id || 0,
        })
        .returning({ id: rewardPurchases.id });

      await db.insert(rewardGiftDetails).values({
        purchaseId: purchase.id,
        giftMessage: input.giftMessage ?? null,
        giftReason: input.giftReason ?? null,
      });

      await db.insert(logs).values({
        houseId: reward.houseId,
        action: "REWARD_GIFTED",
        actorId: actor?.id || 0,
        targetId: input.memberId,
        details: JSON.stringify({
          rewardId: reward.id,
          giftMessage: input.giftMessage,
          giftReason: input.giftReason,
        }),
      });

      await createNotification({
        houseId: reward.houseId,
        recipientId: input.memberId,
        actorId: actor?.id ?? null,
        type: "reward_gifted",
        title: "Bạn nhận được reward",
        message: input.giftMessage || reward.title,
        entityType: "reward",
        entityId: reward.id,
        metadata: {
          giftReason: input.giftReason,
          rewardTitle: reward.title,
        },
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
