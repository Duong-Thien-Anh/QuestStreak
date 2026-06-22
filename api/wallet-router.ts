import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { wallets, houseMembers, logs, memberProgress } from "@db/schema";
import { eq } from "drizzle-orm";

export const walletRouter = createRouter({
  get: authedQuery
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, input.memberId),
      });
      const progress = await db.query.memberProgress.findFirst({
        where: eq(memberProgress.memberId, input.memberId),
      });
      return {
        ...(wallet || { chymBalance: 0, chayBalance: 0 }),
        xp: progress?.xp ?? 0,
        level: progress?.level ?? 1,
      };
    }),

  addChym: adminQuery
    .input(
      z.object({
        memberId: z.number(),
        amount: z.number().min(1),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, input.memberId),
      });
      if (!wallet) throw new Error("Wallet not found");

      const newBalance = wallet.chymBalance + input.amount;
      await db
        .update(wallets)
        .set({ chymBalance: newBalance })
        .where(eq(wallets.memberId, input.memberId));

      // Get actor member
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(logs).values({
        houseId: actor?.houseId || 0,
        action: "ADD_CHYM",
        actorId: actor?.id || 0,
        targetId: input.memberId,
        details: JSON.stringify({ amount: input.amount, reason: input.reason }),
      });

      return { chymBalance: newBalance };
    }),

  removeChym: adminQuery
    .input(
      z.object({
        memberId: z.number(),
        amount: z.number().min(1),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, input.memberId),
      });
      if (!wallet) throw new Error("Wallet not found");

      const newBalance = Math.max(0, wallet.chymBalance - input.amount);
      await db
        .update(wallets)
        .set({ chymBalance: newBalance })
        .where(eq(wallets.memberId, input.memberId));

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(logs).values({
        houseId: actor?.houseId || 0,
        action: "REMOVE_CHYM",
        actorId: actor?.id || 0,
        targetId: input.memberId,
        details: JSON.stringify({ amount: input.amount, reason: input.reason }),
      });

      return { chymBalance: newBalance };
    }),

  addChay: adminQuery
    .input(
      z.object({
        memberId: z.number(),
        amount: z.number().min(1),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, input.memberId),
      });
      if (!wallet) throw new Error("Wallet not found");

      const newBalance = wallet.chayBalance + input.amount;
      await db
        .update(wallets)
        .set({ chayBalance: newBalance })
        .where(eq(wallets.memberId, input.memberId));

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(logs).values({
        houseId: actor?.houseId || 0,
        action: "ADD_CHAY",
        actorId: actor?.id || 0,
        targetId: input.memberId,
        details: JSON.stringify({ amount: input.amount, reason: input.reason }),
      });

      return { chayBalance: newBalance };
    }),

  forgiveChay: adminQuery
    .input(
      z.object({
        memberId: z.number(),
        amount: z.number().min(1),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, input.memberId),
      });
      if (!wallet) throw new Error("Wallet not found");

      const newBalance = Math.max(0, wallet.chayBalance - input.amount);
      await db
        .update(wallets)
        .set({ chayBalance: newBalance })
        .where(eq(wallets.memberId, input.memberId));

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(logs).values({
        houseId: actor?.houseId || 0,
        action: "FORGIVE_CHAY",
        actorId: actor?.id || 0,
        targetId: input.memberId,
        details: JSON.stringify({ amount: input.amount, reason: input.reason }),
      });

      return { chayBalance: newBalance };
    }),
});
