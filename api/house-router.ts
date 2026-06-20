import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { houses, houseMembers, wallets } from "@db/schema";
import { eq } from "drizzle-orm";

export const houseRouter = createRouter({
  get: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    // Find the user's house membership
    const member = await db.query.houseMembers.findFirst({
      where: eq(houseMembers.userId, userId),
    });

    if (!member) return null;

    const house = await db.query.houses.findFirst({
      where: eq(houses.id, member.houseId),
    });

    if (!house) return null;

    // Get all members with their wallets
    const allMembers = await db.query.houseMembers.findMany({
      where: eq(houseMembers.houseId, house.id),
    });

    const membersWithWallets = await Promise.all(
      allMembers.map(async (m) => {
        const wallet = await db.query.wallets.findFirst({
          where: eq(wallets.memberId, m.id),
        });
        return { ...m, wallet: wallet || { chymBalance: 0, chayBalance: 0 } };
      })
    );

    return { ...house, members: membersWithWallets };
  }),

  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Check if user already has a house
      const existing = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, userId),
      });
      if (existing) {
        throw new Error("User already belongs to a house");
      }

      // Create house
      const [house] = await db
        .insert(houses)
        .values({
          name: input.name || "Lunis House",
          ownerId: userId,
        })
        .$returningId();

      // Create member record for owner
      const [member] = await db
        .insert(houseMembers)
        .values({
          houseId: house.id,
          userId,
          nickname: ctx.user.name || "Chủ nhà",
          lifestyleRole: "dominant",
        })
        .$returningId();

      // Create wallet
      await db.insert(wallets).values({ memberId: member.id });

      return house;
    }),

  "member.update": adminQuery
    .input(
      z.object({
        memberId: z.number(),
        nickname: z.string().max(255).optional(),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]).optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.lifestyleRole !== undefined) updateData.lifestyleRole = input.lifestyleRole;
      if (input.gender !== undefined) updateData.gender = input.gender;

      await db
        .update(houseMembers)
        .set(updateData)
        .where(eq(houseMembers.id, input.memberId));

      return { success: true };
    }),

  "member.add": adminQuery
    .input(
      z.object({
        houseId: z.number(),
        nickname: z.string().min(1).max(255),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]),
        gender: z.enum(["male", "female", "other"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Create a placeholder member (no real user linked)
      const [member] = await db
        .insert(houseMembers)
        .values({
          houseId: input.houseId,
          userId: 0, // placeholder - will be linked when user joins
          nickname: input.nickname,
          lifestyleRole: input.lifestyleRole,
          gender: input.gender || "other",
        })
        .$returningId();

      await db.insert(wallets).values({ memberId: member.id });

      return member;
    }),
});
