import { z } from "zod";
import { createRouter, authedQuery, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  punishments,
  punishmentAssignments,
  wallets,
  houseMembers,
  logs,
} from "@db/schema";
import { eq, and, inArray } from "drizzle-orm";

export const punishmentRouter = createRouter({
  list: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.punishments.findMany({
        where: eq(punishments.houseId, input.houseId),
      });
    }),

  create: domQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        chayCost: z.number().min(0).default(0),
        image: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [punishment] = await db
        .insert(punishments)
        .values({
          houseId: input.houseId,
          title: input.title,
          description: input.description,
          chayCost: input.chayCost,
          image: input.image,
          createdBy: actor?.id || 0,
        })
        .returning({ id: punishments.id });

      return { id: punishment.id, ...input };
    }),

  update: domQuery
    .input(
      z.object({
        punishmentId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        chayCost: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.chayCost !== undefined) updateData.chayCost = input.chayCost;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(punishments).set(updateData).where(eq(punishments.id, input.punishmentId));
      return { success: true };
    }),

  delete: domQuery
    .input(z.object({ punishmentId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(punishments).where(eq(punishments.id, input.punishmentId));
      return { success: true };
    }),

  assign: domQuery
    .input(
      z.object({
        punishmentId: z.number(),
        memberId: z.number(),
        checklist: z.array(z.object({ label: z.string(), completed: z.boolean() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(punishmentAssignments).values({
        punishmentId: input.punishmentId,
        memberId: input.memberId,
        assignedBy: actor?.id || 0,
        checklist: input.checklist ? JSON.stringify(input.checklist) : null,
      });

      return { success: true };
    }),

  myAssignments: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const member = await db.query.houseMembers.findFirst({
      where: eq(houseMembers.userId, ctx.user.id),
    });
    if (!member) return [];

    const assignments = await db.query.punishmentAssignments.findMany({
      where: and(
        eq(punishmentAssignments.memberId, member.id),
        eq(punishmentAssignments.status, "active")
      ),
    });
    return Promise.all(
      assignments.map(async (assignment) => ({
        ...assignment,
        punishment: await db.query.punishments.findFirst({
          where: eq(punishments.id, assignment.punishmentId),
        }),
      })),
    );
  }),

  allAssignments: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const members = await db.query.houseMembers.findMany({
        where: eq(houseMembers.houseId, input.houseId),
      });
      const memberIds = members.map((member) => member.id);
      if (memberIds.length === 0) return [];

      const assignments = await db.query.punishmentAssignments.findMany({
        where: inArray(punishmentAssignments.memberId, memberIds),
      });

      return Promise.all(
        assignments.map(async (assignment) => ({
          ...assignment,
          punishment: await db.query.punishments.findFirst({
            where: eq(punishments.id, assignment.punishmentId),
          }),
        })),
      );
    }),

  redeem: authedQuery
    .input(
      z.object({
        assignmentId: z.number(),
        checklist: z.array(z.object({ label: z.string(), completed: z.boolean() })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const assignment = await db.query.punishmentAssignments.findFirst({
        where: eq(punishmentAssignments.id, input.assignmentId),
      });
      if (!assignment) throw new Error("Assignment not found");
      if (assignment.status !== "active") throw new Error("Not active");

      const punishment = await db.query.punishments.findFirst({
        where: eq(punishments.id, assignment.punishmentId),
      });
      if (!punishment) throw new Error("Punishment not found");

      // Check if all items are completed
      const allCompleted = input.checklist.every((item) => item.completed);
      if (!allCompleted) throw new Error("Not all items completed");

      // Deduct Chay
      const wallet = await db.query.wallets.findFirst({
        where: eq(wallets.memberId, assignment.memberId),
      });
      if (wallet && punishment.chayCost > 0) {
        const newBalance = Math.max(0, wallet.chayBalance - punishment.chayCost);
        await db
          .update(wallets)
          .set({ chayBalance: newBalance })
          .where(eq(wallets.memberId, assignment.memberId));
      }

      await db
        .update(punishmentAssignments)
        .set({
          status: "redeemed",
          redeemedAt: new Date(),
          checklist: JSON.stringify(input.checklist),
        })
        .where(eq(punishmentAssignments.id, input.assignmentId));

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(logs).values({
        houseId: actor?.houseId || 0,
        action: "PUNISHMENT_REDEEMED",
        actorId: actor?.id || 0,
        targetId: assignment.memberId,
        details: JSON.stringify({
          assignmentId: assignment.id,
          chayCost: punishment.chayCost,
        }),
      });

      return { success: true };
    }),

  forgive: domQuery
    .input(z.object({ assignmentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(punishmentAssignments)
        .set({ status: "forgiven" })
        .where(eq(punishmentAssignments.id, input.assignmentId));

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      await db.insert(logs).values({
        houseId: actor?.houseId || 0,
        action: "PUNISHMENT_FORGIVEN",
        actorId: actor?.id || 0,
        targetId: input.assignmentId,
        details: JSON.stringify({ assignmentId: input.assignmentId }),
      });

      return { success: true };
    }),
});
