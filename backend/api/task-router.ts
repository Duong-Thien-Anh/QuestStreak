import { z } from "zod";
import { createRouter, authedQuery, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  achievements,
  memberAchievements,
  memberProgress,
  privileges,
  privilegeAssignments,
  punishments,
  punishmentAssignments,
  rewards,
  rewardGiftDetails,
  rewardPurchases,
  tasks,
  wallets,
  houseMembers,
  logs,
  taskSubmissions,
} from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { awardCompletionProgress, calculateLevel, ensureMemberProgress } from "./lib/gamification";
import { createNotification } from "./lib/notifications";

function isTaskLocked(task: { startDate: Date | null }) {
  return Boolean(task.startDate && task.startDate.getTime() > Date.now());
}

function taskLockedMessage(task: { startDate: Date | null }) {
  return `Task sẽ mở vào ${task.startDate?.toLocaleDateString("vi-VN") ?? "ngày đã chọn"}`;
}

export const taskRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        houseId: z.number(),
        category: z.enum(["daily", "weekly", "monthly", "special", "superSpecial", "completed", "failed"]).optional(),
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
      if (input.category === "failed") {
        return db.query.tasks.findMany({
          where: and(eq(tasks.houseId, input.houseId), eq(tasks.status, "failed")),
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

  create: domQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.enum(["daily", "weekly", "monthly", "special", "superSpecial"]),
        chymReward: z.number().min(0).default(0),
        chayPenalty: z.number().min(0).default(0),
        bonusXp: z.number().min(0).default(0),
        startDate: z.string().optional(),
        recurringDays: z.array(z.number().min(0).max(31)).optional(),
        dueDate: z.string().optional(),
        assignedTo: z.number().optional(),
        linkedRewardId: z.number().optional(),
        linkedAchievementId: z.number().optional(),
        linkedPrivilegeId: z.number().optional(),
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
          bonusXp: input.bonusXp,
          startDate: input.startDate ? new Date(input.startDate) : null,
          recurringDays: input.recurringDays ? JSON.stringify(input.recurringDays) : null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          assignedTo: input.assignedTo || null,
          status: input.assignedTo ? "active" : "pending",
          createdBy: actor?.id || 0,
          linkedRewardId: input.linkedRewardId || null,
          linkedAchievementId: input.linkedAchievementId || null,
          linkedPrivilegeId: input.linkedPrivilegeId || null,
          linkedPunishmentId: input.linkedPunishmentId || null,
        })
        .returning({ id: tasks.id });

      await createNotification({
        houseId: input.houseId,
        recipientId: input.assignedTo ?? null,
        actorId: actor?.id ?? null,
        type: input.assignedTo ? "task_assigned" : "task_created",
        title: input.assignedTo ? "Task mới được giao" : "Task mới được tạo",
        message: input.title,
        entityType: "task",
        entityId: task.id,
        metadata: {
          category: input.category,
          chymReward: input.chymReward,
          chayPenalty: input.chayPenalty,
          bonusXp: input.bonusXp,
          linkedRewardId: input.linkedRewardId,
          linkedAchievementId: input.linkedAchievementId,
          linkedPrivilegeId: input.linkedPrivilegeId,
          linkedPunishmentId: input.linkedPunishmentId,
        },
      });

      return { id: task.id, ...input };
    }),

  update: domQuery
    .input(
      z.object({
        taskId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        category: z.enum(["daily", "weekly", "monthly", "special", "superSpecial"]).optional(),
        chymReward: z.number().min(0).optional(),
        chayPenalty: z.number().min(0).optional(),
        bonusXp: z.number().min(0).optional(),
        assignedTo: z.number().nullable().optional(),
        linkedRewardId: z.number().nullable().optional(),
        linkedAchievementId: z.number().nullable().optional(),
        linkedPrivilegeId: z.number().nullable().optional(),
        linkedPunishmentId: z.number().nullable().optional(),
        startDate: z.string().optional(),
        recurringDays: z.array(z.number().min(0).max(31)).nullable().optional(),
        dueDate: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.chymReward !== undefined) updateData.chymReward = input.chymReward;
      if (input.chayPenalty !== undefined) updateData.chayPenalty = input.chayPenalty;
      if (input.bonusXp !== undefined) updateData.bonusXp = input.bonusXp;
      if (input.assignedTo !== undefined) {
        updateData.assignedTo = input.assignedTo;
        updateData.status = input.assignedTo ? "active" : "pending";
      }
      if (input.linkedRewardId !== undefined) updateData.linkedRewardId = input.linkedRewardId;
      if (input.linkedAchievementId !== undefined) updateData.linkedAchievementId = input.linkedAchievementId;
      if (input.linkedPrivilegeId !== undefined) updateData.linkedPrivilegeId = input.linkedPrivilegeId;
      if (input.linkedPunishmentId !== undefined) updateData.linkedPunishmentId = input.linkedPunishmentId;
      if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
      if (input.recurringDays !== undefined)
        updateData.recurringDays = input.recurringDays ? JSON.stringify(input.recurringDays) : null;
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;

      await db.update(tasks).set(updateData).where(eq(tasks.id, input.taskId));
      return { success: true };
    }),

  assign: domQuery
    .input(
      z.object({
        taskId: z.number(),
        memberId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (!task) throw new Error("Task not found");

      await db
        .update(tasks)
        .set({ assignedTo: input.memberId, status: "active" })
        .where(eq(tasks.id, input.taskId));

      await createNotification({
        houseId: task.houseId,
        recipientId: input.memberId,
        actorId: task.createdBy,
        type: "task_assigned",
        title: "Task được giao cho bạn",
        message: task.title,
        entityType: "task",
        entityId: task.id,
      });

      return { success: true };
    }),

  delete: domQuery
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

      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (!task) throw new Error("Task not found");
      if (isTaskLocked(task)) {
        throw new Error(taskLockedMessage(task));
      }

      await db
        .update(tasks)
        .set({ assignedTo: member.id, status: "active" })
        .where(eq(tasks.id, input.taskId));

      await createNotification({
        houseId: task.houseId,
        recipientId: task.createdBy,
        actorId: member.id,
        type: "task_assigned",
        title: "Task đã được nhận",
        message: task.title,
        entityType: "task",
        entityId: task.id,
      });

      return { success: true };
    }),

  submit: authedQuery
    .input(
      z.object({
        taskId: z.number(),
        note: z.string().max(2000).optional(),
        proofUrl: z.string().url().max(2000).optional(),
        proofType: z.string().max(50).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [member, task] = await Promise.all([
        db.query.houseMembers.findFirst({
          where: eq(houseMembers.userId, ctx.user.id),
        }),
        db.query.tasks.findFirst({
          where: eq(tasks.id, input.taskId),
        }),
      ]);
      if (!member) throw new Error("Member not found");
      if (!task) throw new Error("Task not found");
      if (isTaskLocked(task)) {
        throw new Error(taskLockedMessage(task));
      }
      if (task.assignedTo && task.assignedTo !== member.id) {
        throw new Error("Task is assigned to another member");
      }

      await db
        .update(tasks)
        .set({ status: "submitted" })
        .where(eq(tasks.id, input.taskId));

      const [submission] = await db
        .insert(taskSubmissions)
        .values({
          taskId: input.taskId,
          memberId: member.id,
          note: input.note ?? null,
          proofUrl: input.proofUrl ?? null,
          proofType: input.proofType ?? null,
        })
        .returning();

      await createNotification({
        houseId: task.houseId,
        recipientId: task.createdBy,
        actorId: member.id,
        type: "task_submitted",
        title: "Task chờ duyệt",
        message: input.note || task.title,
        entityType: "task",
        entityId: task.id,
        metadata: {
          submissionId: submission.id,
          hasProof: Boolean(input.proofUrl),
        },
      });

      return { success: true, submission };
    }),

  submissions: domQuery
    .input(z.object({ taskId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.taskSubmissions.findMany({
        where: eq(taskSubmissions.taskId, input.taskId),
        orderBy: desc(taskSubmissions.submittedAt),
      });
    }),

  review: domQuery
    .input(
      z.object({
        taskId: z.number(),
        decision: z.enum(["approve", "reject"]),
        reviewNote: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (!task) throw new Error("Task not found");
      if (input.decision === "approve" && task.status === "completed") {
        return { success: true };
      }

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
          details: JSON.stringify({
            taskId: task.id,
            reward: task.chymReward,
            bonusXp: task.bonusXp,
            linkedRewardId: task.linkedRewardId,
            linkedAchievementId: task.linkedAchievementId,
            linkedPrivilegeId: task.linkedPrivilegeId,
            linkedPunishmentId: task.linkedPunishmentId,
          }),
        });

        await createNotification({
          houseId: task.houseId,
          recipientId: task.assignedTo,
          actorId: actor?.id ?? null,
          type: "task_completed",
          title: "Task đã hoàn thành",
          message: task.title,
          entityType: "task",
          entityId: task.id,
          metadata: {
            reward: task.chymReward,
            bonusXp: task.bonusXp,
            linkedRewardId: task.linkedRewardId,
            linkedAchievementId: task.linkedAchievementId,
            linkedPrivilegeId: task.linkedPrivilegeId,
            linkedPunishmentId: task.linkedPunishmentId,
          },
        });

        const latestSubmission = await db.query.taskSubmissions.findFirst({
          where: eq(taskSubmissions.taskId, task.id),
          orderBy: desc(taskSubmissions.submittedAt),
        });
        if (latestSubmission) {
          await db
            .update(taskSubmissions)
            .set({
              status: "approved",
              reviewedBy: actor?.id ?? null,
              reviewedAt: new Date(),
              reviewNote: input.reviewNote ?? null,
            })
            .where(eq(taskSubmissions.id, latestSubmission.id));
        }

        if (task.assignedTo) {
          const progress = await awardCompletionProgress({
            memberId: task.assignedTo,
            sourceType: "task",
            sourceId: task.id,
            chymReward: task.chymReward,
            bonusXp: task.bonusXp,
          });

          const linkedAchievements: typeof progress.achievementsUnlocked = [];
          if (task.linkedAchievementId) {
            const linkedAchievement = await db.query.achievements.findFirst({
              where: eq(achievements.id, task.linkedAchievementId),
            });
            if (linkedAchievement) {
              const inserted = await db
                .insert(memberAchievements)
                .values({
                  memberId: task.assignedTo,
                  achievementId: linkedAchievement.id,
                })
                .onConflictDoNothing({
                  target: [memberAchievements.memberId, memberAchievements.achievementId],
                })
                .returning();

              if (inserted.length > 0) {
                linkedAchievements.push(linkedAchievement);
                if (linkedAchievement.xpReward > 0) {
                  const memberProgressRow = await ensureMemberProgress(db, task.assignedTo);
                  const xp = memberProgressRow.xp + linkedAchievement.xpReward;
                  await db
                    .update(memberProgress)
                    .set({ xp, level: calculateLevel(xp) })
                    .where(eq(memberProgress.memberId, task.assignedTo));
                }
              }
            }
          }

          if (task.linkedRewardId) {
            const linkedReward = await db.query.rewards.findFirst({
              where: and(
                eq(rewards.id, task.linkedRewardId),
                eq(rewards.houseId, task.houseId),
                eq(rewards.isActive, true)
              ),
            });
            if (linkedReward) {
              const [purchase] = await db
                .insert(rewardPurchases)
                .values({
                  rewardId: linkedReward.id,
                  memberId: task.assignedTo,
                  giftedBy: actor?.id ?? null,
                })
                .returning({ id: rewardPurchases.id });

              await db.insert(rewardGiftDetails).values({
                purchaseId: purchase.id,
                giftMessage: `Hoàn thành task: ${task.title}`,
                giftReason: "task_completion",
              });

              await createNotification({
                houseId: task.houseId,
                recipientId: task.assignedTo,
                actorId: actor?.id ?? null,
                type: "reward_gifted",
                title: "Phần thưởng đã được tặng",
                message: linkedReward.title,
                entityType: "reward",
                entityId: linkedReward.id,
                metadata: { taskId: task.id, purchaseId: purchase.id },
              });
            }
          }

          if (task.linkedPrivilegeId) {
            const linkedPrivilege = await db.query.privileges.findFirst({
              where: and(
                eq(privileges.id, task.linkedPrivilegeId),
                eq(privileges.houseId, task.houseId),
                eq(privileges.isActive, true)
              ),
            });
            if (linkedPrivilege) {
              const [assignment] = await db
                .insert(privilegeAssignments)
                .values({
                  privilegeId: linkedPrivilege.id,
                  memberId: task.assignedTo,
                  assignedBy: actor?.id ?? 0,
                })
                .returning({ id: privilegeAssignments.id });

              await createNotification({
                houseId: task.houseId,
                recipientId: task.assignedTo,
                actorId: actor?.id ?? null,
                type: "system",
                title: "Privilege đã được gán",
                message: linkedPrivilege.title,
                entityType: "privilege",
                entityId: linkedPrivilege.id,
                metadata: { taskId: task.id, assignmentId: assignment.id },
              });
            }
          }

          await Promise.all(
            [...progress.achievementsUnlocked, ...linkedAchievements].map((achievement) =>
              createNotification({
                houseId: task.houseId,
                recipientId: task.assignedTo,
                actorId: actor?.id ?? null,
                type: "achievement_unlocked",
                title: "Achievement đã mở khóa",
                message: achievement.title,
                entityType: "achievement",
                entityId: achievement.id,
                metadata: { key: achievement.key, xpReward: achievement.xpReward },
              })
            )
          );
        }
      } else {
        await db
          .update(tasks)
          .set({ status: "active" })
          .where(eq(tasks.id, input.taskId));

        const actor = await db.query.houseMembers.findFirst({
          where: eq(houseMembers.userId, ctx.user.id),
        });

        if (task.assignedTo && task.linkedPunishmentId) {
          const linkedPunishment = await db.query.punishments.findFirst({
            where: and(
              eq(punishments.id, task.linkedPunishmentId),
              eq(punishments.houseId, task.houseId),
              eq(punishments.isActive, true)
            ),
          });

          if (linkedPunishment) {
            const [assignment] = await db.insert(punishmentAssignments).values({
              punishmentId: linkedPunishment.id,
              memberId: task.assignedTo,
              assignedBy: actor?.id || 0,
              checklist: null,
            }).returning({ id: punishmentAssignments.id });

            await db.insert(logs).values({
              houseId: task.houseId,
              action: "PUNISHMENT_ASSIGNED",
              actorId: actor?.id || 0,
              targetId: task.assignedTo,
              details: JSON.stringify({
                taskId: task.id,
                punishmentId: linkedPunishment.id,
                assignmentId: assignment.id,
              }),
            });
          }
        }

        await createNotification({
          houseId: task.houseId,
          recipientId: task.assignedTo,
          actorId: actor?.id ?? null,
          type: "task_rejected",
          title: "Task cần làm lại",
          message: task.title,
          entityType: "task",
          entityId: task.id,
          metadata: {
            reviewNote: input.reviewNote,
            linkedPunishmentId: task.linkedPunishmentId,
          },
        });

        const latestSubmission = await db.query.taskSubmissions.findFirst({
          where: eq(taskSubmissions.taskId, task.id),
          orderBy: desc(taskSubmissions.submittedAt),
        });
        if (latestSubmission) {
          await db
            .update(taskSubmissions)
            .set({
              status: "rejected",
              reviewedBy: actor?.id ?? null,
              reviewedAt: new Date(),
              reviewNote: input.reviewNote ?? null,
            })
            .where(eq(taskSubmissions.id, latestSubmission.id));
        }
      }

      return { success: true };
    }),

  fail: domQuery
    .input(
      z.object({
        taskId: z.number(),
        reason: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, input.taskId),
      });
      if (!task) throw new Error("Task not found");

      await db
        .update(tasks)
        .set({ status: "failed", completedAt: null })
        .where(eq(tasks.id, input.taskId));

      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      if (task.assignedTo && task.chayPenalty > 0) {
        const wallet = await db.query.wallets.findFirst({
          where: eq(wallets.memberId, task.assignedTo),
        });
        if (wallet) {
          await db
            .update(wallets)
            .set({ chayBalance: wallet.chayBalance + task.chayPenalty })
            .where(eq(wallets.memberId, task.assignedTo));
        }
      }

      let punishmentAssignmentId: number | null = null;
      if (task.assignedTo && task.linkedPunishmentId) {
        const linkedPunishment = await db.query.punishments.findFirst({
          where: and(
            eq(punishments.id, task.linkedPunishmentId),
            eq(punishments.houseId, task.houseId),
            eq(punishments.isActive, true)
          ),
        });
        if (linkedPunishment) {
          const [assignment] = await db
            .insert(punishmentAssignments)
            .values({
              punishmentId: linkedPunishment.id,
              memberId: task.assignedTo,
              assignedBy: actor?.id || task.createdBy,
              checklist: null,
            })
            .returning({ id: punishmentAssignments.id });
          punishmentAssignmentId = assignment.id;
        }
      }

      await db.insert(logs).values({
        houseId: task.houseId,
        action: "TASK_FAILED",
        actorId: actor?.id || task.createdBy,
        targetId: task.assignedTo,
        details: JSON.stringify({
          taskId: task.id,
          chayPenalty: task.chayPenalty,
          linkedPunishmentId: task.linkedPunishmentId,
          punishmentAssignmentId,
          reason: input.reason,
        }),
      });

      await createNotification({
        houseId: task.houseId,
        recipientId: task.assignedTo,
        actorId: actor?.id ?? null,
        type: "task_rejected",
        title: "Task không hoàn thành",
        message: task.title,
        entityType: "task",
        entityId: task.id,
        metadata: {
          reason: input.reason,
          chayPenalty: task.chayPenalty,
          linkedPunishmentId: task.linkedPunishmentId,
          punishmentAssignmentId,
        },
      });

      return { success: true };
    }),

  toggleStatus: domQuery
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
