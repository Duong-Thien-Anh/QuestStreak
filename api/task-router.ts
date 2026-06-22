import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { tasks, wallets, houseMembers, logs } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export const taskRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        houseId: z.number(),
        category: z.enum(["daily", "weekly", "monthly", "special", "superSpecial", "completed"]).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      if (input.category === "completed") {
        return db.query.tasks.findMany({
          where: and(eq(tasks.houseId, input.houseId), eq(tasks.status, "completed")),
          orderBy: desc(tasks.updatedAt),
        });
      }
      if (input.category) {
        return db.query.tasks.findMany({
          where: and(eq(tasks.houseId, input.houseId), eq(tasks.category, input.category)),
          orderBy: desc(tasks.createdAt),
        });
      }
      return db.query.tasks.findMany({
        where: eq(tasks.houseId, input.houseId),
        orderBy: desc(tasks.createdAt),
      });
    }),

  create: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.enum(["daily", "weekly", "monthly", "special", "superSpecial"]),
        chymReward: z.number().min(0).default(0),
        chayPenalty: z.number().min(0).default(0),
        dueDate: z.string().optional(),
        assignedTo: z.number().optional(),
        linkedRewardId: z.number().optional(),
        linkedPunishmentId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [task] = await db
        .insert(tasks)
        .values({
          houseId: input.houseId,
          title: input.title,
          description: input.description,
          category: input.category,
          chymReward: input.chymReward,
          chayPenalty: input.chayPenalty,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          assignedTo: input.assignedTo || null,
          status: input.assignedTo ? "active" : "pending",
          createdBy: actor?.id || 0,
          linkedRewardId: input.linkedRewardId || null,
          linkedPunishmentId: input.linkedPunishmentId || null,
        })
        .returning({ id: tasks.id });

      return { id: task.id, ...input };
    }),

  update: adminQuery
    .input(
      z.object({
        taskId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        chymReward: z.number().min(0).optional(),
        chayPenalty: z.number().min(0).optional(),
        dueDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.chymReward !== undefined) updateData.chymReward = input.chymReward;
      if (input.chayPenalty !== undefined) updateData.chayPenalty = input.chayPenalty;
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;

      await db.update(tasks).set(updateData).where(eq(tasks.id, input.taskId));
      return { success: true };
    }),

  assign: adminQuery
    .input(
      z.object({
        taskId: z.number(),
        memberId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(tasks)
        .set({ assignedTo: input.memberId, status: "active" })
        .where(eq(tasks.id, input.taskId));

      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(tasks).where(eq(tasks.id, input.taskId));
      return { success: true };
    }),

  accept: authedQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (!member) throw new Error("Member not found");

      await db
        .update(tasks)
        .set({ assignedTo: member.id, status: "active" })
        .where(eq(tasks.id, input.taskId));

      return { success: true };
    }),

  submit: authedQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(tasks)
        .set({ status: "submitted" })
        .where(eq(tasks.id, input.taskId));
      return { success: true };
    }),

  review: adminQuery
    .input(
      z.object({
        taskId: z.number(),
        decision: z.enum(["approve", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (!task) throw new Error("Task not found");

      if (input.decision === "approve") {
        // Credit Chym
        if (task.chymReward > 0 && task.assignedTo) {
          const wallet = await db.query.wallets.findFirst({
            where: eq(wallets.memberId, task.assignedTo),
          });
          if (wallet) {
            await db
              .update(wallets)
              .set({ chymBalance: wallet.chymBalance + task.chymReward })
              .where(eq(wallets.memberId, task.assignedTo));
          }
        }

        await db
          .update(tasks)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(tasks.id, input.taskId));

        const actor = await db.query.houseMembers.findFirst({
          where: eq(houseMembers.userId, ctx.user.id),
        });

        await db.insert(logs).values({
          houseId: task.houseId,
          action: "TASK_COMPLETED",
          actorId: actor?.id || 0,
          targetId: task.assignedTo,
          details: JSON.stringify({ taskId: task.id, reward: task.chymReward }),
        });
      } else {
        await db
          .update(tasks)
          .set({ status: "active" })
          .where(eq(tasks.id, input.taskId));
      }

      return { success: true };
    }),

  toggleStatus: adminQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (!task) throw new Error("Task not found");

      const newStatus = task.status === "active" ? "pending" : "active";
      await db
        .update(tasks)
        .set({ status: newStatus })
        .where(eq(tasks.id, input.taskId));

      return { success: true, newStatus };
    }),
});
