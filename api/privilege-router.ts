import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { privileges, privilegeAssignments, houseMembers } from "@db/schema";
import { eq } from "drizzle-orm";

export const privilegeRouter = createRouter({
  list: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.privileges.findMany({
        where: eq(privileges.houseId, input.houseId),
      });
    }),

  create: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        image: z.string().optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).default("common"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [priv] = await db
        .insert(privileges)
        .values({
          houseId: input.houseId,
          title: input.title,
          description: input.description,
          image: input.image,
          rarity: input.rarity,
          createdBy: actor?.id || 0,
        })
        .returning({ id: privileges.id });

      return { id: priv.id, ...input };
    }),

  update: adminQuery
    .input(
      z.object({
        privilegeId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.rarity !== undefined) updateData.rarity = input.rarity;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(privileges).set(updateData).where(eq(privileges.id, input.privilegeId));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ privilegeId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(privileges).where(eq(privileges.id, input.privilegeId));
      return { success: true };
    }),

  assign: adminQuery
    .input(
      z.object({
        privilegeId: z.number(),
        memberId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(privilegeAssignments).values({
        privilegeId: input.privilegeId,
        memberId: input.memberId,
        assignedBy: actor?.id || 0,
      });

      return { success: true };
    }),

  myAssignments: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const member = await db.query.houseMembers.findFirst({
      where: eq(houseMembers.userId, ctx.user.id),
    });
    if (!member) return [];

    return db.query.privilegeAssignments.findMany({
      where: eq(privilegeAssignments.memberId, member.id),
    });
  }),

  use: authedQuery
    .input(z.object({ assignmentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(privilegeAssignments)
        .set({ status: "used" })
        .where(eq(privilegeAssignments.id, input.assignmentId));
      return { success: true };
    }),
});
