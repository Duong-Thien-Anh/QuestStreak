import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { desc, eq, inArray, and } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  achievements,
  houses,
  houseAvatars,
  houseMembers,
  agreements,
  journalEntries,
  journals,
  limits,
  logs,
  memberProgress,
  memberAchievements,
  notes,
  notifications,
  privileges,
  privilegeAssignments,
  punishmentAssignments,
  punishments,
  registrationRequests,
  rewardGiftDetails,
  rewardPurchases,
  rewards,
  roomCodes,
  streaks,
  taskSubmissions,
  tasks,
  userCredentials,
  users,
  wallets,
  wheelSpins,
  wheels,
} from "@db/schema";
import { sendMail, buildApprovalEmail, buildRejectionEmail } from "./lib/mailer";
import { avatarForGender, supportedGenders } from "./lib/gender";
import { getDefaultTaskXp, setDefaultTaskXp } from "./lib/gamification";

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = "scrypt";

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${PASSWORD_HASH_PREFIX}$${salt}$${key.toString("hex")}`;
}

async function ensureMemberResources(memberId: number) {
  const db = getDb();
  const [wallet, progress] = await Promise.all([
    db.query.wallets.findFirst({ where: eq(wallets.memberId, memberId) }),
    db.query.memberProgress.findFirst({
      where: eq(memberProgress.memberId, memberId),
    }),
  ]);

  if (!wallet) {
    await db.insert(wallets).values({ memberId });
  }
  if (!progress) {
    await db.insert(memberProgress).values({ memberId });
  }
}

async function ensureRoomCode(houseId: number) {
  const db = getDb();
  const existing = await db.query.roomCodes.findFirst({
    where: eq(roomCodes.houseId, houseId),
  });
  if (existing) return existing;

  const code = `ROOT-${houseId}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const [created] = await db
    .insert(roomCodes)
    .values({ houseId, code })
    .returning();
  return created;
}

async function getAdminMember(userId: number) {
  const db = getDb();
  return db.query.houseMembers.findFirst({
    where: eq(houseMembers.userId, userId),
  });
}

async function ensureOwnerMember(input: {
  houseId: number;
  ownerId: number;
  ownerName?: string | null;
}) {
  const db = getDb();
  const existing = await db.query.houseMembers.findFirst({
    where: and(
      eq(houseMembers.houseId, input.houseId),
      eq(houseMembers.userId, input.ownerId),
    ),
  });
  if (existing) {
    await ensureMemberResources(existing.id);
    return existing;
  }

  const [member] = await db
    .insert(houseMembers)
    .values({
      houseId: input.houseId,
      userId: input.ownerId,
      nickname: input.ownerName || "Room Owner",
      lifestyleRole: "dominant",
      gender: "male",
      telegramAvatar: avatarForGender("male"),
    })
    .returning();
  await ensureMemberResources(member.id);
  return member;
}

export const adminRouter = createRouter({
  listAvatars: adminQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.houseAvatars.findMany({
        where: eq(houseAvatars.houseId, input.houseId),
        orderBy: [desc(houseAvatars.createdAt)],
      });
    }),

  addAvatar: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        url: z.string().url().max(2000),
        label: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await getAdminMember(ctx.user.id);
      const [avatar] = await db
        .insert(houseAvatars)
        .values({
          houseId: input.houseId,
          url: input.url.trim(),
          label: input.label?.trim() ?? null,
          addedBy: actor?.id ?? 0,
        })
        .returning();
      return avatar;
    }),

  addAvatarToRooms: adminQuery
    .input(
      z.object({
        houseIds: z.array(z.number()).min(1),
        url: z.string().url().max(2000),
        label: z.string().max(100).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await getAdminMember(ctx.user.id);
      const uniqueHouseIds = [...new Set(input.houseIds)];
      const created = await db
        .insert(houseAvatars)
        .values(
          uniqueHouseIds.map((houseId) => ({
            houseId,
            url: input.url.trim(),
            label: input.label?.trim() ?? null,
            addedBy: actor?.id ?? 0,
          })),
        )
        .returning();
      return created;
    }),

  deleteAvatar: adminQuery
    .input(z.object({ avatarId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(houseAvatars).where(eq(houseAvatars.id, input.avatarId));
      return { success: true };
    }),

  listUsers: adminQuery.query(async () => {
    const db = getDb();
    const [userRows, credentials] = await Promise.all([
      db.query.users.findMany({ orderBy: [desc(users.createdAt)] }),
      db.query.userCredentials.findMany(),
    ]);

    return userRows.map((user) => {
      const credential = credentials.find((item) => item.userId === user.id);
      return {
        id: user.id,
        unionId: user.unionId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        credentialEmail: credential?.email ?? null,
        username: credential?.username ?? null,
        phone: credential?.phone ?? null,
      };
    });
  }),

  listUserProfiles: adminQuery.query(async () => {
    const db = getDb();
    const [
      memberRows,
      userRows,
      roomRows,
      walletRows,
      progressRows,
      streakRows,
      taskRows,
      rewardRows,
      rewardPurchaseRows,
      privilegeRows,
      privilegeAssignmentRows,
      punishmentRows,
      punishmentAssignmentRows,
      logRows,
    ] = await Promise.all([
      db.query.houseMembers.findMany({ orderBy: [desc(houseMembers.createdAt)] }),
      db.query.users.findMany(),
      db.query.houses.findMany(),
      db.query.wallets.findMany(),
      db.query.memberProgress.findMany(),
      db.query.streaks.findMany({ orderBy: [desc(streaks.updatedAt)] }),
      db.query.tasks.findMany({ orderBy: [desc(tasks.createdAt)] }),
      db.query.rewards.findMany(),
      db.query.rewardPurchases.findMany({
        orderBy: [desc(rewardPurchases.purchasedAt)],
      }),
      db.query.privileges.findMany(),
      db.query.privilegeAssignments.findMany({
        orderBy: [desc(privilegeAssignments.assignedAt)],
      }),
      db.query.punishments.findMany(),
      db.query.punishmentAssignments.findMany({
        orderBy: [desc(punishmentAssignments.assignedAt)],
      }),
      db.query.logs.findMany({ orderBy: [desc(logs.createdAt)] }),
    ]);

    const userById = new Map(userRows.map((user) => [user.id, user]));
    const roomById = new Map(roomRows.map((room) => [room.id, room]));
    const rewardById = new Map(rewardRows.map((reward) => [reward.id, reward]));
    const privilegeById = new Map(
      privilegeRows.map((privilege) => [privilege.id, privilege]),
    );
    const punishmentById = new Map(
      punishmentRows.map((punishment) => [punishment.id, punishment]),
    );

    return memberRows.map((member) => {
      const user = userById.get(member.userId) ?? null;
      const wallet = walletRows.find((item) => item.memberId === member.id) ?? null;
      const progress =
        progressRows.find((item) => item.memberId === member.id) ?? null;
      const memberTasks = taskRows.filter((task) => task.assignedTo === member.id);
      const memberStreaks = streakRows.filter((streak) => streak.memberId === member.id);
      const memberRewardPurchases = rewardPurchaseRows
        .filter((purchase) => purchase.memberId === member.id)
        .slice(0, 8)
        .map((purchase) => ({
          ...purchase,
          rewardTitle:
            rewardById.get(purchase.rewardId)?.title ??
            `Reward #${purchase.rewardId}`,
        }));
      const activePrivileges = privilegeAssignmentRows
        .filter(
          (assignment) =>
            assignment.memberId === member.id && assignment.status === "active",
        )
        .slice(0, 8)
        .map((assignment) => ({
          ...assignment,
          privilegeTitle:
            privilegeById.get(assignment.privilegeId)?.title ??
            `Privilege #${assignment.privilegeId}`,
        }));
      const activePunishments = punishmentAssignmentRows
        .filter(
          (assignment) =>
            assignment.memberId === member.id && assignment.status === "active",
        )
        .slice(0, 8)
        .map((assignment) => ({
          ...assignment,
          punishmentTitle:
            punishmentById.get(assignment.punishmentId)?.title ??
            `Punishment #${assignment.punishmentId}`,
        }));
      const recentLogs = logRows
        .filter((log) => log.actorId === member.id || log.targetId === member.id)
        .slice(0, 8);

      return {
        member,
        user,
        room: roomById.get(member.houseId) ?? null,
        wallet: {
          chymBalance: wallet?.chymBalance ?? 0,
          chayBalance: wallet?.chayBalance ?? 0,
        },
        progress: {
          xp: progress?.xp ?? 0,
          level: progress?.level ?? 1,
        },
        streak: {
          current: memberStreaks.reduce(
            (max, streak) => Math.max(max, streak.currentStreak),
            0,
          ),
          longest: memberStreaks.reduce(
            (max, streak) => Math.max(max, streak.longestStreak),
            0,
          ),
          count: memberStreaks.length,
        },
        tasks: {
          total: memberTasks.length,
          active: memberTasks.filter((task) => task.status === "active").length,
          submitted: memberTasks.filter((task) => task.status === "submitted").length,
          completed: memberTasks.filter((task) => task.status === "completed").length,
          recent: memberTasks.slice(0, 5).map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            chymReward: task.chymReward,
            chayPenalty: task.chayPenalty,
          })),
        },
        rewards: memberRewardPurchases,
        privileges: activePrivileges,
        punishments: activePunishments,
        recentLogs,
      };
    });
  }),

  createLocalAccount: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().max(320),
        username: z.string().min(3).max(100).optional(),
        password: z.string().min(8),
        role: z.enum(["user", "admin"]).default("user"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      const username = input.username?.trim().toLowerCase() || null;
      const [existing, existingUsername] = await Promise.all([
        db.query.userCredentials.findFirst({
          where: eq(userCredentials.email, email),
        }),
        username
          ? db.query.userCredentials.findFirst({
              where: eq(userCredentials.username, username),
            })
          : Promise.resolve(undefined),
      ]);
      if (existing) throw new Error("Email đã tồn tại");
      if (existingUsername) throw new Error("Tên đăng nhập đã tồn tại");

      const [user] = await db
        .insert(users)
        .values({
          unionId: `local:${email}`,
          name: input.name.trim(),
          email,
          role: input.role,
          lastSignInAt: new Date(),
        })
        .returning();

      await db.insert(userCredentials).values({
        userId: user.id,
        email,
        username,
        passwordHash: await hashPassword(input.password),
      });

      return { success: true, userId: user.id };
    }),

  updateUserRole: adminQuery
    .input(z.object({ userId: z.number(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [user] = await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId))
        .returning();
      return user;
    }),

  updateUserAccount: adminQuery
    .input(
      z.object({
        userId: z.number(),
        name: z.string().min(1).max(255),
        email: z.string().email().max(320),
        username: z.string().min(3).max(100).optional(),
        phone: z.string().max(30).optional(),
        role: z.enum(["user", "admin"]),
        password: z.string().min(8).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      const username = input.username?.trim().toLowerCase() || null;
      const phone = input.phone?.trim() || null;

      const existingCredential = await db.query.userCredentials.findFirst({
        where: eq(userCredentials.email, email),
      });
      if (existingCredential && existingCredential.userId !== input.userId) {
        throw new Error("Email đã tồn tại");
      }
      const existingUsername = username
        ? await db.query.userCredentials.findFirst({
            where: eq(userCredentials.username, username),
          })
        : null;
      if (existingUsername && existingUsername.userId !== input.userId) {
        throw new Error("Tên đăng nhập đã tồn tại");
      }

      const [user] = await db
        .update(users)
        .set({
          name: input.name.trim(),
          email,
          role: input.role,
        })
        .where(eq(users.id, input.userId))
        .returning();
      if (!user) throw new Error("User not found");

      const currentCredential = await db.query.userCredentials.findFirst({
        where: eq(userCredentials.userId, input.userId),
      });
      const credentialData: {
        userId: number;
        email: string;
        username: string | null;
        phone: string | null;
        passwordHash?: string;
      } = {
        userId: input.userId,
        email,
        username,
        phone,
      };
      if (input.password) {
        credentialData.passwordHash = await hashPassword(input.password);
      }

      if (currentCredential) {
        await db
          .update(userCredentials)
          .set(credentialData)
          .where(eq(userCredentials.id, currentCredential.id));
      } else {
        await db.insert(userCredentials).values({
          ...credentialData,
          passwordHash: credentialData.passwordHash ?? (await hashPassword("Password123!")),
        });
      }

      return user;
    }),

  deleteUserAccount: adminQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.userId === ctx.user.id) {
        throw new Error("Không thể tự xóa tài khoản admin đang đăng nhập");
      }

      await db
        .update(houses)
        .set({ ownerId: ctx.user.id })
        .where(eq(houses.ownerId, input.userId));

      const memberships = await db.query.houseMembers.findMany({
        where: eq(houseMembers.userId, input.userId),
      });
      const memberIds = memberships.map((member) => member.id);

      if (memberIds.length > 0) {
        await db.delete(wallets).where(inArray(wallets.memberId, memberIds));
        await db
          .delete(memberProgress)
          .where(inArray(memberProgress.memberId, memberIds));
        await db.delete(streaks).where(inArray(streaks.memberId, memberIds));
        await db
          .delete(memberAchievements)
          .where(inArray(memberAchievements.memberId, memberIds));
        await db.delete(notes).where(inArray(notes.memberId, memberIds));
        await db.delete(journals).where(inArray(journals.memberId, memberIds));
        await db
          .delete(journalEntries)
          .where(inArray(journalEntries.memberId, memberIds));
        await db
          .delete(taskSubmissions)
          .where(inArray(taskSubmissions.memberId, memberIds));
        await db
          .delete(rewardPurchases)
          .where(inArray(rewardPurchases.memberId, memberIds));
        await db
          .delete(privilegeAssignments)
          .where(inArray(privilegeAssignments.memberId, memberIds));
        await db
          .delete(punishmentAssignments)
          .where(inArray(punishmentAssignments.memberId, memberIds));
        await db.delete(wheelSpins).where(inArray(wheelSpins.memberId, memberIds));
        await db
          .update(tasks)
          .set({ assignedTo: null })
          .where(inArray(tasks.assignedTo, memberIds));
        await db
          .update(wheels)
          .set({ assignedTo: null })
          .where(inArray(wheels.assignedTo, memberIds));
      }

      await db
        .delete(houseMembers)
        .where(eq(houseMembers.userId, input.userId));
      await db
        .delete(userCredentials)
        .where(eq(userCredentials.userId, input.userId));
      await db
        .delete(userCredentials)
        .where(eq(userCredentials.email, `deleted-user-${input.userId}@local.invalid`));
      await db.delete(users).where(eq(users.id, input.userId));

      return { success: true };
    }),

  listRooms: adminQuery.query(async () => {
    const db = getDb();
    const [roomRows, memberRows, userRows, codeRows] = await Promise.all([
      db.query.houses.findMany({ orderBy: [desc(houses.createdAt)] }),
      db.query.houseMembers.findMany(),
      db.query.users.findMany(),
      db.query.roomCodes.findMany(),
    ]);

    return roomRows.map((room) => {
      const owner = userRows.find((user) => user.id === room.ownerId) ?? null;
      const roomMemberRows = memberRows.filter(
        (member) => member.houseId === room.id,
      );
      const roomCode = codeRows.find((code) => code.houseId === room.id);
      return {
        ...room,
        roomCode: roomCode?.code ?? null,
        roomApprovalRequired: roomCode?.approvalRequired ?? false,
        owner,
        members: roomMemberRows.map((member) => ({
          ...member,
          user:
            userRows.find((user) => user.id === member.userId) ??
            null,
        })),
      };
    });
  }),

  createRoom: adminQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        ownerId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ownerId = input.ownerId ?? ctx.user.id;
      const owner = await db.query.users.findFirst({
        where: eq(users.id, ownerId),
      });
      if (!owner) throw new Error("Owner user not found");

      const [room] = await db
        .insert(houses)
        .values({
          name: input.name.trim(),
          ownerId,
        })
        .returning();

      await ensureRoomCode(room.id);
      await ensureOwnerMember({
        houseId: room.id,
        ownerId,
        ownerName: owner.name,
      });

      return room;
    }),

  updateRoom: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        name: z.string().min(1).max(255),
        ownerId: z.number().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: { name: string; ownerId?: number } = {
        name: input.name.trim(),
      };
      if (input.ownerId !== undefined) {
        const owner = await db.query.users.findFirst({
          where: eq(users.id, input.ownerId),
        });
        if (!owner) throw new Error("Owner user not found");
        updateData.ownerId = owner.id;
      }

      const [room] = await db
        .update(houses)
        .set(updateData)
        .where(eq(houses.id, input.houseId))
        .returning();

      if (input.ownerId !== undefined) {
        const owner = await db.query.users.findFirst({
          where: eq(users.id, input.ownerId),
        });
        await ensureOwnerMember({
          houseId: input.houseId,
          ownerId: input.ownerId,
          ownerName: owner?.name,
        });
      }

      return room;
    }),

  deleteRoom: adminQuery
    .input(z.object({ houseId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const members = await db.query.houseMembers.findMany({
        where: eq(houseMembers.houseId, input.houseId),
      });
      const memberIds = members.map((member) => member.id);
      if (memberIds.length > 0) {
        await db.delete(wallets).where(inArray(wallets.memberId, memberIds));
        await db
          .delete(memberProgress)
          .where(inArray(memberProgress.memberId, memberIds));
      }
      await db.delete(roomCodes).where(eq(roomCodes.houseId, input.houseId));
      await db
        .delete(houseMembers)
        .where(eq(houseMembers.houseId, input.houseId));
      await db.delete(houses).where(eq(houses.id, input.houseId));
      return { success: true };
    }),

  addRoomMember: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        userId: z.number().optional(),
        nickname: z.string().min(1).max(255),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]),
        gender: z.enum(supportedGenders).default("female"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const userId = input.userId ?? 0;
      if (userId !== 0) {
        const existing = await db.query.houseMembers.findFirst({
          where: and(
            eq(houseMembers.houseId, input.houseId),
            eq(houseMembers.userId, userId),
          ),
        });
        if (existing) throw new Error("User already belongs to this room");
      }

      const [member] = await db
        .insert(houseMembers)
        .values({
          houseId: input.houseId,
          userId,
          nickname: input.nickname.trim(),
          lifestyleRole: input.lifestyleRole,
          gender: input.gender,
          telegramAvatar: avatarForGender(input.gender),
        })
        .returning();
      await ensureMemberResources(member.id);
      return member;
    }),

  updateRoomMember: adminQuery
    .input(
      z.object({
        memberId: z.number(),
        nickname: z.string().max(255).optional(),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]).optional(),
        gender: z.enum(supportedGenders).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.lifestyleRole !== undefined) {
        updateData.lifestyleRole = input.lifestyleRole;
      }
      if (input.gender !== undefined) {
        updateData.gender = input.gender;
        updateData.telegramAvatar = avatarForGender(input.gender);
      }

      const db = getDb();
      const [member] = await db
        .update(houseMembers)
        .set(updateData)
        .where(eq(houseMembers.id, input.memberId))
        .returning();
      return member;
    }),

  removeRoomMember: adminQuery
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(wallets).where(eq(wallets.memberId, input.memberId));
      await db
        .delete(memberProgress)
        .where(eq(memberProgress.memberId, input.memberId));
      await db.delete(houseMembers).where(eq(houseMembers.id, input.memberId));
      return { success: true };
    }),

  listOperations: adminQuery.query(async () => {
    const db = getDb();
    const [
      roomRows,
      memberRows,
      userRows,
      walletRows,
      progressRows,
      streakRows,
      achievementRows,
      memberAchievementRows,
      taskRows,
      submissionRows,
      rewardRows,
      rewardPurchaseRows,
      rewardGiftRows,
      privilegeRows,
      privilegeAssignmentRows,
      punishmentRows,
      punishmentAssignmentRows,
      limitRows,
      agreementRows,
      journalRows,
      journalEntryRows,
      noteRows,
      notificationRows,
      logRows,
      wheelRows,
      wheelSpinRows,
    ] = await Promise.all([
      db.query.houses.findMany({ orderBy: [desc(houses.createdAt)] }),
      db.query.houseMembers.findMany(),
      db.query.users.findMany(),
      db.query.wallets.findMany(),
      db.query.memberProgress.findMany(),
      db.query.streaks.findMany({ orderBy: [desc(streaks.updatedAt)] }),
      db.query.achievements.findMany(),
      db.query.memberAchievements.findMany({
        orderBy: [desc(memberAchievements.unlockedAt)],
      }),
      db.query.tasks.findMany({ orderBy: [desc(tasks.createdAt)] }),
      db.query.taskSubmissions.findMany({
        orderBy: [desc(taskSubmissions.submittedAt)],
      }),
      db.query.rewards.findMany({ orderBy: [desc(rewards.createdAt)] }),
      db.query.rewardPurchases.findMany({
        orderBy: [desc(rewardPurchases.purchasedAt)],
      }),
      db.query.rewardGiftDetails.findMany({
        orderBy: [desc(rewardGiftDetails.createdAt)],
      }),
      db.query.privileges.findMany({ orderBy: [desc(privileges.createdAt)] }),
      db.query.privilegeAssignments.findMany({
        orderBy: [desc(privilegeAssignments.assignedAt)],
      }),
      db.query.punishments.findMany({ orderBy: [desc(punishments.createdAt)] }),
      db.query.punishmentAssignments.findMany({
        orderBy: [desc(punishmentAssignments.assignedAt)],
      }),
      db.query.limits.findMany({ orderBy: [desc(limits.createdAt)] }),
      db.query.agreements.findMany({ orderBy: [desc(agreements.createdAt)] }),
      db.query.journals.findMany({ orderBy: [desc(journals.createdAt)] }),
      db.query.journalEntries.findMany({
        orderBy: [desc(journalEntries.createdAt)],
      }),
      db.query.notes.findMany({ orderBy: [desc(notes.createdAt)] }),
      db.query.notifications.findMany({
        orderBy: [desc(notifications.createdAt)],
      }),
      db.query.logs.findMany({ orderBy: [desc(logs.createdAt)] }),
      db.query.wheels.findMany({ orderBy: [desc(wheels.createdAt)] }),
      db.query.wheelSpins.findMany({ orderBy: [desc(wheelSpins.spunAt)] }),
    ]);

    const userById = new Map(userRows.map((user) => [user.id, user]));
    const roomById = new Map(roomRows.map((room) => [room.id, room]));
    const memberById = new Map(memberRows.map((member) => [member.id, member]));
    const taskById = new Map(taskRows.map((task) => [task.id, task]));
    const rewardById = new Map(rewardRows.map((reward) => [reward.id, reward]));
    const privilegeById = new Map(
      privilegeRows.map((privilege) => [privilege.id, privilege]),
    );
    const punishmentById = new Map(
      punishmentRows.map((punishment) => [punishment.id, punishment]),
    );
    const wheelById = new Map(wheelRows.map((wheel) => [wheel.id, wheel]));
    const achievementById = new Map(
      achievementRows.map((achievement) => [achievement.id, achievement]),
    );

    const memberLabel = (memberId: number | null | undefined) => {
      if (!memberId) return null;
      const member = memberById.get(memberId);
      if (!member) return `Member #${memberId}`;
      const user = userById.get(member.userId);
      return member.nickname || user?.name || user?.email || `Member #${memberId}`;
    };
    const roomName = (houseId: number | null | undefined) =>
      houseId ? roomById.get(houseId)?.name ?? `Room #${houseId}` : null;

    const walletsWithMember = walletRows.map((wallet) => {
      const progress = progressRows.find((item) => item.memberId === wallet.memberId);
      const member = memberById.get(wallet.memberId);
      return {
        ...wallet,
        memberName: memberLabel(wallet.memberId),
        roomName: roomName(member?.houseId),
        xp: progress?.xp ?? 0,
        level: progress?.level ?? 1,
      };
    });
    const defaultTaskXp = await getDefaultTaskXp(db);

    return {
      summary: {
        tasks: taskRows.length,
        submissions: submissionRows.length,
        rewards: rewardRows.length,
        gifts: rewardGiftRows.length,
        rewardPurchases: rewardPurchaseRows.length,
        privileges: privilegeRows.length,
        privilegeAssignments: privilegeAssignmentRows.length,
        punishments: punishmentRows.length,
        punishmentAssignments: punishmentAssignmentRows.length,
        wallets: walletRows.length,
        streaks: streakRows.length,
        achievements: achievementRows.length,
        wheels: wheelRows.length,
        wheelSpins: wheelSpinRows.length,
        notes: noteRows.length,
        journals: journalRows.length,
        agreements: agreementRows.length,
        notifications: notificationRows.length,
        logs: logRows.length,
      },
      settings: {
        defaultTaskXp,
      },
      tasks: taskRows.map((task) => ({
        ...task,
        roomName: roomName(task.houseId),
        assignedMemberName: memberLabel(task.assignedTo),
        createdByName: memberLabel(task.createdBy),
      })),
      taskSubmissions: submissionRows.map((submission) => ({
        ...submission,
        taskTitle: taskById.get(submission.taskId)?.title ?? `Task #${submission.taskId}`,
        memberName: memberLabel(submission.memberId),
        reviewedByName: memberLabel(submission.reviewedBy),
      })),
      rewards: rewardRows.map((reward) => ({
        ...reward,
        roomName: roomName(reward.houseId),
        createdByName: memberLabel(reward.createdBy),
        purchaseCount: rewardPurchaseRows.filter((purchase) => purchase.rewardId === reward.id).length,
      })),
      rewardPurchases: rewardPurchaseRows.map((purchase) => ({
        ...purchase,
        rewardTitle: rewardById.get(purchase.rewardId)?.title ?? `Reward #${purchase.rewardId}`,
        memberName: memberLabel(purchase.memberId),
        giftedByName: memberLabel(purchase.giftedBy),
        gift: rewardGiftRows.find((gift) => gift.purchaseId === purchase.id) ?? null,
      })),
      privileges: privilegeRows.map((privilege) => ({
        ...privilege,
        roomName: roomName(privilege.houseId),
        createdByName: memberLabel(privilege.createdBy),
      })),
      privilegeAssignments: privilegeAssignmentRows.map((assignment) => ({
        ...assignment,
        privilegeTitle:
          privilegeById.get(assignment.privilegeId)?.title ??
          `Privilege #${assignment.privilegeId}`,
        memberName: memberLabel(assignment.memberId),
        assignedByName: memberLabel(assignment.assignedBy),
      })),
      punishments: punishmentRows.map((punishment) => ({
        ...punishment,
        roomName: roomName(punishment.houseId),
        createdByName: memberLabel(punishment.createdBy),
      })),
      punishmentAssignments: punishmentAssignmentRows.map((assignment) => ({
        ...assignment,
        punishmentTitle:
          punishmentById.get(assignment.punishmentId)?.title ??
          `Punishment #${assignment.punishmentId}`,
        memberName: memberLabel(assignment.memberId),
        assignedByName: memberLabel(assignment.assignedBy),
      })),
      wallets: walletsWithMember,
      streaks: streakRows.map((streak) => ({
        ...streak,
        memberName: memberLabel(streak.memberId),
        sourceTitle:
          streak.sourceType === "task"
            ? taskById.get(streak.sourceId)?.title ?? `Task #${streak.sourceId}`
            : `Source #${streak.sourceId}`,
      })),
      achievements: achievementRows,
      memberAchievements: memberAchievementRows.map((item) => ({
        ...item,
        memberName: memberLabel(item.memberId),
        achievementTitle:
          achievementById.get(item.achievementId)?.title ??
          `Achievement #${item.achievementId}`,
      })),
      wheels: wheelRows.map((wheel) => ({
        ...wheel,
        roomName: roomName(wheel.houseId),
        assignedMemberName: memberLabel(wheel.assignedTo),
        createdByName: memberLabel(wheel.createdBy),
      })),
      wheelSpins: wheelSpinRows.map((spin) => ({
        ...spin,
        wheelTitle: wheelById.get(spin.wheelId)?.title ?? `Wheel #${spin.wheelId}`,
        memberName: memberLabel(spin.memberId),
      })),
      notes: noteRows.map((note) => ({
        ...note,
        roomName: roomName(note.houseId),
        memberName: memberLabel(note.memberId),
      })),
      limits: limitRows.map((limit) => ({
        ...limit,
        roomName: roomName(limit.houseId),
        createdByName: memberLabel(limit.createdBy),
      })),
      agreements: agreementRows.map((agreement) => ({
        ...agreement,
        roomName: roomName(agreement.houseId),
        createdByName: memberLabel(agreement.createdBy),
      })),
      journals: journalRows.map((journal) => ({
        ...journal,
        roomName: roomName(journal.houseId),
        memberName: memberLabel(journal.memberId),
      })),
      journalEntries: journalEntryRows.map((entry) => ({
        ...entry,
        memberName: memberLabel(entry.memberId),
      })),
      notifications: notificationRows.map((notification) => ({
        ...notification,
        roomName: roomName(notification.houseId),
        recipientName: memberLabel(notification.recipientId),
        actorName: memberLabel(notification.actorId),
      })),
      logs: logRows.map((log) => ({
        ...log,
        roomName: roomName(log.houseId),
        actorName: memberLabel(log.actorId),
        targetName: memberLabel(log.targetId),
      })),
    };
  }),

  updateWalletProgress: adminQuery
    .input(
      z.object({
        memberId: z.number(),
        chymBalance: z.number().int().min(0),
        chayBalance: z.number().int().min(0),
        xp: z.number().int().min(0),
        level: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await ensureMemberResources(input.memberId);
      const [wallet] = await db
        .update(wallets)
        .set({
          chymBalance: input.chymBalance,
          chayBalance: input.chayBalance,
        })
        .where(eq(wallets.memberId, input.memberId))
        .returning();
      const [progress] = await db
        .update(memberProgress)
        .set({ xp: input.xp, level: input.level })
        .where(eq(memberProgress.memberId, input.memberId))
        .returning();
      const [actor, member] = await Promise.all([
        getAdminMember(ctx.user.id),
        db.query.houseMembers.findFirst({ where: eq(houseMembers.id, input.memberId) }),
      ]);
      if (actor && member) {
        await db.insert(logs).values({
          houseId: member.houseId,
          action: "ADMIN_WALLET_PROGRESS_UPDATED",
          actorId: actor.id,
          targetId: input.memberId,
          details: JSON.stringify(input),
        });
      }
      return { wallet, progress };
    }),

  updateTaskXpConfig: adminQuery
    .input(z.object({ defaultTaskXp: z.number().int().min(0) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const defaultTaskXp = await setDefaultTaskXp(input.defaultTaskXp, db);
      return { defaultTaskXp };
    }),

  updateStreak: adminQuery
    .input(
      z.object({
        streakId: z.number(),
        currentStreak: z.number().int().min(0),
        longestStreak: z.number().int().min(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [streak] = await db
        .update(streaks)
        .set({
          currentStreak: input.currentStreak,
          longestStreak: input.longestStreak,
        })
        .where(eq(streaks.id, input.streakId))
        .returning();
      return streak;
    }),

  createAchievement: adminQuery
    .input(
      z.object({
        key: z.string().min(1).max(100),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        icon: z.string().min(1).max(50).default("trophy"),
        xpReward: z.number().int().min(0).default(0),
        criteriaType: z.enum(["total_completions", "current_streak", "xp", "level"]),
        criteriaValue: z.number().int().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [achievement] = await db
        .insert(achievements)
        .values({
          key: input.key.trim(),
          title: input.title.trim(),
          description: input.description?.trim() || null,
          icon: input.icon.trim() || "trophy",
          xpReward: input.xpReward,
          criteriaType: input.criteriaType,
          criteriaValue: input.criteriaValue,
        })
        .returning();
      return achievement;
    }),

  updateAchievement: adminQuery
    .input(
      z.object({
        achievementId: z.number(),
        key: z.string().min(1).max(100),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        icon: z.string().min(1).max(50),
        xpReward: z.number().int().min(0),
        criteriaType: z.enum(["total_completions", "current_streak", "xp", "level"]),
        criteriaValue: z.number().int().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [achievement] = await db
        .update(achievements)
        .set({
          key: input.key.trim(),
          title: input.title.trim(),
          description: input.description?.trim() || null,
          icon: input.icon.trim() || "trophy",
          xpReward: input.xpReward,
          criteriaType: input.criteriaType,
          criteriaValue: input.criteriaValue,
        })
        .where(eq(achievements.id, input.achievementId))
        .returning();
      return achievement;
    }),

  deleteAchievement: adminQuery
    .input(z.object({ achievementId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .delete(memberAchievements)
        .where(eq(memberAchievements.achievementId, input.achievementId));
      await db.delete(achievements).where(eq(achievements.id, input.achievementId));
      return { success: true };
    }),

  updateTaskStatus: adminQuery
    .input(
      z.object({
        taskId: z.number(),
        status: z.enum(["pending", "active", "submitted", "completed", "failed"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [task] = await db
        .update(tasks)
        .set({
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
        })
        .where(eq(tasks.id, input.taskId))
        .returning();
      return task;
    }),

  createTask: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z
          .enum(["daily", "weekly", "monthly", "special", "superSpecial"])
          .default("daily"),
        chymReward: z.number().int().min(0).default(0),
        chayPenalty: z.number().int().min(0).default(0),
        bonusXp: z.number().int().min(0).default(0),
        assignedTo: z.number().optional(),
        createdBy: z.number(),
        status: z
          .enum(["pending", "active", "submitted", "completed", "failed"])
          .default("pending"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [task] = await db
        .insert(tasks)
        .values({
          houseId: input.houseId,
          title: input.title.trim(),
          description: input.description?.trim() || null,
          category: input.category,
          chymReward: input.chymReward,
          chayPenalty: input.chayPenalty,
          bonusXp: input.bonusXp,
          assignedTo: input.assignedTo ?? null,
          createdBy: input.createdBy,
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
        })
        .returning();
      return task;
    }),

  updateTask: adminQuery
    .input(
      z.object({
        taskId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        category: z.enum(["daily", "weekly", "monthly", "special", "superSpecial"]),
        chymReward: z.number().int().min(0),
        chayPenalty: z.number().int().min(0),
        bonusXp: z.number().int().min(0),
        assignedTo: z.number().optional(),
        status: z.enum(["pending", "active", "submitted", "completed", "failed"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [task] = await db
        .update(tasks)
        .set({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          category: input.category,
          chymReward: input.chymReward,
          chayPenalty: input.chayPenalty,
          bonusXp: input.bonusXp,
          assignedTo: input.assignedTo ?? null,
          status: input.status,
          completedAt: input.status === "completed" ? new Date() : null,
        })
        .where(eq(tasks.id, input.taskId))
        .returning();
      return task;
    }),

  deleteTask: adminQuery
    .input(z.object({ taskId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(taskSubmissions).where(eq(taskSubmissions.taskId, input.taskId));
      await db.delete(streaks).where(eq(streaks.sourceId, input.taskId));
      await db.delete(tasks).where(eq(tasks.id, input.taskId));
      return { success: true };
    }),

  updateTaskSubmissionStatus: adminQuery
    .input(
      z.object({
        submissionId: z.number(),
        status: z.enum(["submitted", "approved", "rejected"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [submission] = await db
        .update(taskSubmissions)
        .set({
          status: input.status,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(taskSubmissions.id, input.submissionId))
        .returning();
      return submission;
    }),

  updateCatalogActive: adminQuery
    .input(
      z.object({
        type: z.enum(["reward", "privilege", "punishment", "wheel"]),
        id: z.number(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      switch (input.type) {
        case "reward":
          return (
            await db
              .update(rewards)
              .set({ isActive: input.isActive })
              .where(eq(rewards.id, input.id))
              .returning()
          )[0];
        case "privilege":
          return (
            await db
              .update(privileges)
              .set({ isActive: input.isActive })
              .where(eq(privileges.id, input.id))
              .returning()
          )[0];
        case "punishment":
          return (
            await db
              .update(punishments)
              .set({ isActive: input.isActive })
              .where(eq(punishments.id, input.id))
              .returning()
          )[0];
        case "wheel":
          return (
            await db
              .update(wheels)
              .set({ isActive: input.isActive })
              .where(eq(wheels.id, input.id))
              .returning()
          )[0];
      }
    }),

  createCatalogItem: adminQuery
    .input(
      z.object({
        type: z.enum(["reward", "privilege", "punishment", "wheel"]),
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        createdBy: z.number(),
        cost: z.number().int().min(0).optional(),
        purchaseLimit: z.number().int().min(0).nullable().optional(),
        purchaseLimitPerUser: z.number().int().min(0).nullable().optional(),
        chayCost: z.number().int().min(0).optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
        assignedTo: z.number().optional(),
        options: z.string().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await getAdminMember(ctx.user.id);
      switch (input.type) {
        case "reward": {
          const [item] = await db
              .insert(rewards)
              .values({
                houseId: input.houseId,
                title: input.title.trim(),
                description: input.description?.trim() || null,
                cost: input.cost ?? 0,
                purchaseLimit: input.purchaseLimit ?? null,
                purchaseLimitPerUser: input.purchaseLimitPerUser ?? null,
                rarity: input.rarity ?? "common",
                isActive: input.isActive,
                createdBy: input.createdBy,
              })
              .returning();
          if (actor) {
            await db.insert(logs).values({
              houseId: item.houseId,
              action: "ADMIN_REWARD_CREATED",
              actorId: actor.id,
              targetId: item.id,
              details: JSON.stringify({ title: item.title }),
            });
          }
          return item;
        }
        case "privilege":
          return (
            await db
              .insert(privileges)
              .values({
                houseId: input.houseId,
                title: input.title.trim(),
                description: input.description?.trim() || null,
                rarity: input.rarity ?? "common",
                isActive: input.isActive,
                createdBy: input.createdBy,
              })
              .returning()
          )[0];
        case "punishment":
          return (
            await db
              .insert(punishments)
              .values({
                houseId: input.houseId,
                title: input.title.trim(),
                description: input.description?.trim() || null,
                chayCost: input.chayCost ?? 0,
                isActive: input.isActive,
                createdBy: input.createdBy,
              })
              .returning()
          )[0];
        case "wheel":
          return (
            await db
              .insert(wheels)
              .values({
                houseId: input.houseId,
                title: input.title.trim(),
                description: input.description?.trim() || null,
                options:
                  input.options?.trim() ||
                  JSON.stringify([
                    { label: "Option 1", weight: 1 },
                    { label: "Option 2", weight: 1 },
                  ]),
                assignedTo: input.assignedTo ?? null,
                isActive: input.isActive,
                createdBy: input.createdBy,
              })
              .returning()
          )[0];
      }
    }),

  updateCatalogItem: adminQuery
    .input(
      z.object({
        type: z.enum(["reward", "privilege", "punishment", "wheel"]),
        id: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        cost: z.number().int().min(0).optional(),
        purchaseLimit: z.number().int().min(0).nullable().optional(),
        purchaseLimitPerUser: z.number().int().min(0).nullable().optional(),
        chayCost: z.number().int().min(0).optional(),
        rarity: z.enum(["common", "rare", "epic", "legendary"]).optional(),
        assignedTo: z.number().optional(),
        options: z.string().optional(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await getAdminMember(ctx.user.id);
      switch (input.type) {
        case "reward": {
          const [item] = await db
              .update(rewards)
              .set({
                title: input.title.trim(),
                description: input.description?.trim() || null,
                cost: input.cost ?? 0,
                purchaseLimit: input.purchaseLimit ?? null,
                purchaseLimitPerUser: input.purchaseLimitPerUser ?? null,
                rarity: input.rarity ?? "common",
                isActive: input.isActive,
              })
              .where(eq(rewards.id, input.id))
              .returning();
          if (actor && item) {
            await db.insert(logs).values({
              houseId: item.houseId,
              action: "ADMIN_REWARD_UPDATED",
              actorId: actor.id,
              targetId: item.id,
              details: JSON.stringify({
                title: item.title,
                cost: item.cost,
                purchaseLimit: item.purchaseLimit,
                purchaseLimitPerUser: item.purchaseLimitPerUser,
                isActive: item.isActive,
              }),
            });
          }
          return item;
        }
        case "privilege":
          return (
            await db
              .update(privileges)
              .set({
                title: input.title.trim(),
                description: input.description?.trim() || null,
                rarity: input.rarity ?? "common",
                isActive: input.isActive,
              })
              .where(eq(privileges.id, input.id))
              .returning()
          )[0];
        case "punishment":
          return (
            await db
              .update(punishments)
              .set({
                title: input.title.trim(),
                description: input.description?.trim() || null,
                chayCost: input.chayCost ?? 0,
                isActive: input.isActive,
              })
              .where(eq(punishments.id, input.id))
              .returning()
          )[0];
        case "wheel":
          return (
            await db
              .update(wheels)
              .set({
                title: input.title.trim(),
                description: input.description?.trim() || null,
                options: input.options?.trim() || "[]",
                assignedTo: input.assignedTo ?? null,
                isActive: input.isActive,
              })
              .where(eq(wheels.id, input.id))
              .returning()
          )[0];
      }
    }),

  deleteCatalogItem: adminQuery
    .input(
      z.object({
        type: z.enum(["reward", "privilege", "punishment", "wheel"]),
        id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await getAdminMember(ctx.user.id);
      switch (input.type) {
        case "reward": {
          const reward = await db.query.rewards.findFirst({
            where: eq(rewards.id, input.id),
          });
          const purchases = await db.query.rewardPurchases.findMany({
            where: eq(rewardPurchases.rewardId, input.id),
          });
          const purchaseIds = purchases.map((purchase) => purchase.id);
          if (purchaseIds.length > 0) {
            await db
              .delete(rewardGiftDetails)
              .where(inArray(rewardGiftDetails.purchaseId, purchaseIds));
            await db
              .delete(rewardPurchases)
              .where(inArray(rewardPurchases.id, purchaseIds));
          }
          await db.delete(rewards).where(eq(rewards.id, input.id));
          if (actor && reward) {
            await db.insert(logs).values({
              houseId: reward.houseId,
              action: "ADMIN_REWARD_DELETED",
              actorId: actor.id,
              targetId: input.id,
              details: JSON.stringify({ title: reward.title }),
            });
          }
          break;
        }
        case "privilege":
          await db
            .delete(privilegeAssignments)
            .where(eq(privilegeAssignments.privilegeId, input.id));
          await db.delete(privileges).where(eq(privileges.id, input.id));
          break;
        case "punishment":
          await db
            .delete(punishmentAssignments)
            .where(eq(punishmentAssignments.punishmentId, input.id));
          await db.delete(punishments).where(eq(punishments.id, input.id));
          break;
        case "wheel":
          await db.delete(wheelSpins).where(eq(wheelSpins.wheelId, input.id));
          await db.delete(wheels).where(eq(wheels.id, input.id));
          break;
      }
      return { success: true };
    }),

  createRewardPurchase: adminQuery
    .input(
      z.object({
        rewardId: z.number(),
        memberId: z.number(),
        giftedBy: z.number().optional(),
        status: z.enum(["active", "used", "expired"]).default("active"),
        giftMessage: z.string().optional(),
        giftReason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [purchase] = await db
        .insert(rewardPurchases)
        .values({
          rewardId: input.rewardId,
          memberId: input.memberId,
          giftedBy: input.giftedBy ?? null,
          status: input.status,
        })
        .returning();
      if (input.giftMessage || input.giftReason) {
        await db.insert(rewardGiftDetails).values({
          purchaseId: purchase.id,
          giftMessage: input.giftMessage?.trim() || null,
          giftReason: input.giftReason?.trim() || null,
        });
      }
      return purchase;
    }),

  createPrivilegeAssignment: adminQuery
    .input(
      z.object({
        privilegeId: z.number(),
        memberId: z.number(),
        assignedBy: z.number(),
        status: z.enum(["active", "used", "expired"]).default("active"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [assignment] = await db
        .insert(privilegeAssignments)
        .values(input)
        .returning();
      return assignment;
    }),

  createPunishmentAssignment: adminQuery
    .input(
      z.object({
        punishmentId: z.number(),
        memberId: z.number(),
        assignedBy: z.number(),
        status: z.enum(["active", "redeemed", "forgiven"]).default("active"),
        checklist: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [assignment] = await db
        .insert(punishmentAssignments)
        .values({
          punishmentId: input.punishmentId,
          memberId: input.memberId,
          assignedBy: input.assignedBy,
          status: input.status,
          checklist: input.checklist?.trim() || null,
          redeemedAt: input.status === "redeemed" ? new Date() : null,
        })
        .returning();
      return assignment;
    }),

  updateRewardPurchaseStatus: adminQuery
    .input(
      z.object({
        purchaseId: z.number(),
        status: z.enum(["active", "used", "expired"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [purchase] = await db
        .update(rewardPurchases)
        .set({ status: input.status })
        .where(eq(rewardPurchases.id, input.purchaseId))
        .returning();
      return purchase;
    }),

  updatePrivilegeAssignmentStatus: adminQuery
    .input(
      z.object({
        assignmentId: z.number(),
        status: z.enum(["active", "used", "expired"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [assignment] = await db
        .update(privilegeAssignments)
        .set({ status: input.status })
        .where(eq(privilegeAssignments.id, input.assignmentId))
        .returning();
      return assignment;
    }),

  updatePunishmentAssignmentStatus: adminQuery
    .input(
      z.object({
        assignmentId: z.number(),
        status: z.enum(["active", "redeemed", "forgiven"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [assignment] = await db
        .update(punishmentAssignments)
        .set({
          status: input.status,
          redeemedAt: input.status === "redeemed" ? new Date() : null,
        })
        .where(eq(punishmentAssignments.id, input.assignmentId))
        .returning();
      return assignment;
    }),

  updateAgreementStatus: adminQuery
    .input(
      z.object({
        agreementId: z.number(),
        status: z.enum(["pending", "active", "void"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [agreement] = await db
        .update(agreements)
        .set({ status: input.status })
        .where(eq(agreements.id, input.agreementId))
        .returning();
      return agreement;
    }),

  createNote: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        memberId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().optional(),
        visibility: z.enum(["public", "private"]).default("private"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [note] = await db
        .insert(notes)
        .values({
          houseId: input.houseId,
          memberId: input.memberId,
          title: input.title.trim(),
          content: input.content?.trim() || null,
          visibility: input.visibility,
        })
        .returning();
      return note;
    }),

  updateNote: adminQuery
    .input(
      z.object({
        noteId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().optional(),
        visibility: z.enum(["public", "private"]),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [note] = await db
        .update(notes)
        .set({
          title: input.title.trim(),
          content: input.content?.trim() || null,
          visibility: input.visibility,
        })
        .where(eq(notes.id, input.noteId))
        .returning();
      return note;
    }),

  deleteOperationRecord: adminQuery
    .input(
      z.object({
        type: z.enum([
          "taskSubmission",
          "rewardPurchase",
          "privilegeAssignment",
          "punishmentAssignment",
          "wheelSpin",
          "note",
          "notification",
          "log",
        ]),
        id: z.number(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      switch (input.type) {
        case "taskSubmission":
          await db.delete(taskSubmissions).where(eq(taskSubmissions.id, input.id));
          break;
        case "rewardPurchase":
          await db
            .delete(rewardGiftDetails)
            .where(eq(rewardGiftDetails.purchaseId, input.id));
          await db
            .delete(rewardPurchases)
            .where(eq(rewardPurchases.id, input.id));
          break;
        case "privilegeAssignment":
          await db
            .delete(privilegeAssignments)
            .where(eq(privilegeAssignments.id, input.id));
          break;
        case "punishmentAssignment":
          await db
            .delete(punishmentAssignments)
            .where(eq(punishmentAssignments.id, input.id));
          break;
        case "wheelSpin":
          await db.delete(wheelSpins).where(eq(wheelSpins.id, input.id));
          break;
        case "note":
          await db.delete(notes).where(eq(notes.id, input.id));
          break;
        case "notification":
          await db.delete(notifications).where(eq(notifications.id, input.id));
          break;
        case "log":
          await db.delete(logs).where(eq(logs.id, input.id));
          break;
      }
      return { success: true };
    }),

  listRegistrations: adminQuery
    .input(
      z.object({
        status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const filter = input?.status ?? "pending";

      const rows = await db.query.registrationRequests.findMany({
        where: filter !== "all" ? eq(registrationRequests.status, filter as "pending" | "approved" | "rejected") : undefined,
        orderBy: [desc(registrationRequests.createdAt)],
      });

      return rows.map((request) => ({
        id: request.id,
        name: request.name,
        email: request.email,
        username: request.username,
        phone: request.phone,
        lifestyleRole: request.lifestyleRole,
        gender: request.gender,
        status: request.status,
        rejectionReason: request.rejectionReason,
        reviewedBy: request.reviewedBy,
        reviewedAt: request.reviewedAt,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      }));
    }),

  approveRegistration: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const req = await db.query.registrationRequests.findFirst({
        where: eq(registrationRequests.id, input.id),
      });

      if (!req) throw new Error("Không tìm thấy yêu cầu đăng ký");
      if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý");

      // Check email not already used
      const existingCred = await db.query.userCredentials.findFirst({
        where: eq(userCredentials.email, req.email),
      });
      if (existingCred) throw new Error("Email đã tồn tại trong hệ thống");
      const normalizedUsername = req.username?.trim().toLowerCase();
      const existingUsername = normalizedUsername
        ? await db.query.userCredentials.findFirst({
            where: eq(userCredentials.username, normalizedUsername),
          })
        : null;
      if (existingUsername) throw new Error("Tên đăng nhập đã tồn tại trong hệ thống");

      // Create user account
      const unionId = `local:${req.email}`;
      const [newUser] = await db
        .insert(users)
        .values({
          unionId,
          name: req.name,
          email: req.email,
          role: "user",
          lastSignInAt: new Date(),
        })
        .returning();

      // Create credentials
      await db.insert(userCredentials).values({
        userId: newUser.id,
        email: req.email,
        username: normalizedUsername ?? undefined,
        phone: req.phone ?? undefined,
        passwordHash: req.passwordHash,
      });

      // Update request status
      await db
        .update(registrationRequests)
        .set({ status: "approved", reviewedBy: ctx.user.id, reviewedAt: new Date() })
        .where(eq(registrationRequests.id, input.id));

      // Send approval email (non-blocking)
      sendMail({
        to: req.email,
        subject: "Tài khoản Lunis House đã được duyệt",
        html: buildApprovalEmail(req.name),
      }).catch(console.error);

      return { success: true, userId: newUser.id };
    }),

  rejectRegistration: adminQuery
    .input(z.object({ id: z.number(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      const req = await db.query.registrationRequests.findFirst({
        where: eq(registrationRequests.id, input.id),
      });

      if (!req) throw new Error("Không tìm thấy yêu cầu đăng ký");
      if (req.status !== "pending") throw new Error("Yêu cầu này đã được xử lý");

      await db
        .update(registrationRequests)
        .set({
          status: "rejected",
          rejectionReason: input.reason ?? null,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
        })
        .where(eq(registrationRequests.id, input.id));

      sendMail({
        to: req.email,
        subject: "Thông báo kết quả đăng ký tài khoản Lunis House",
        html: buildRejectionEmail(req.name, input.reason),
      }).catch(console.error);

      return { success: true };
    }),
});
