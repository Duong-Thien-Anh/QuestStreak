import { z } from "zod";
import { nanoid } from "nanoid";
import { createRouter, authedQuery, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  houses,
  houseAvatars,
  houseMembers,
  wallets,
  memberProgress,
  roomCodes,
  roomJoinRequests,
} from "@db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { avatarForGender, supportedGenders } from "./lib/gender";

function createRoomCode() {
  return nanoid(10);
}

async function createUniqueRoomCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();
    const existing = await db.query.roomCodes.findFirst({
      where: eq(roomCodes.code, code),
    });
    if (!existing) return code;
  }

  throw new Error("Failed to generate room code");
}

async function createOwnedHouseForUser(input: {
  userId: number;
  userName?: string | null;
  name?: string;
}) {
  const db = getDb();
  const [house] = await db
    .insert(houses)
    .values({
      name: input.name || "Lunis House",
      ownerId: input.userId,
    })
    .returning({ id: houses.id });

  await db.insert(roomCodes).values({
    houseId: house.id,
    code: await createUniqueRoomCode(),
  });

  const [member] = await db
    .insert(houseMembers)
    .values({
      houseId: house.id,
      userId: input.userId,
      nickname: input.userName || "Chủ nhà",
      lifestyleRole: "dominant",
      gender: "male",
      telegramAvatar: avatarForGender("male"),
    })
    .returning({ id: houseMembers.id });

  await db.insert(wallets).values({ memberId: member.id });
  await db.insert(memberProgress).values({ memberId: member.id });

  return house;
}

export const houseRouter = createRouter({
  "avatars.list": authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.houseAvatars.findMany({
        where: eq(houseAvatars.houseId, input.houseId),
        orderBy: [asc(houseAvatars.createdAt)],
      });
    }),

  get: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    // Find the user's house membership
    let member = await db.query.houseMembers.findFirst({
      where: eq(houseMembers.userId, userId),
    });

    if (!member && ctx.user.role === "admin") {
      const ownedHouse = await db.query.houses.findFirst({
        where: eq(houses.ownerId, userId),
      });

      if (ownedHouse) {
        const [createdMember] = await db
          .insert(houseMembers)
          .values({
            houseId: ownedHouse.id,
            userId,
            nickname: ctx.user.name || "Root Admin",
            lifestyleRole: "dominant",
            gender: "male",
            telegramAvatar: avatarForGender("male"),
          })
          .returning({ id: houseMembers.id });

        await db.insert(wallets).values({ memberId: createdMember.id });
        await db.insert(memberProgress).values({ memberId: createdMember.id });
      } else {
        await createOwnedHouseForUser({
          userId,
          userName: ctx.user.name,
          name: "Admin Control Room",
        });
      }

      member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, userId),
      });
    }

    if (!member) return null;

    const house = await db.query.houses.findFirst({
      where: eq(houses.id, member.houseId),
    });

    if (!house) return null;

    let roomCode = await db.query.roomCodes.findFirst({
      where: eq(roomCodes.houseId, house.id),
    });
    if (!roomCode) {
      const code = await createUniqueRoomCode();
      [roomCode] = await db
        .insert(roomCodes)
        .values({ houseId: house.id, code })
        .returning();
    }

    // Get all members with their wallets
    const allMembers = await db.query.houseMembers.findMany({
      where: eq(houseMembers.houseId, house.id),
    });

    const membersWithWallets = await Promise.all(
      allMembers.map(async (m) => {
        const wallet = await db.query.wallets.findFirst({
          where: eq(wallets.memberId, m.id),
        });
        const progress = await db.query.memberProgress.findFirst({
          where: eq(memberProgress.memberId, m.id),
        });
        return {
          ...m,
          wallet: {
            ...(wallet || { chymBalance: 0, chayBalance: 0 }),
            xp: progress?.xp ?? 0,
            level: progress?.level ?? 1,
          },
        };
      })
    );

    const canManageRoom =
      member.lifestyleRole === "dominant" || member.lifestyleRole === "switch";
    const pendingJoinRequests = canManageRoom
      ? await db.query.roomJoinRequests.findMany({
          where: eq(roomJoinRequests.houseId, house.id),
          orderBy: [desc(roomJoinRequests.createdAt)],
        })
      : [];

    return {
      ...house,
      roomCode: roomCode.code,
      roomApprovalRequired: roomCode.approvalRequired,
      pendingJoinRequests,
      members: membersWithWallets,
    };
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

      return createOwnedHouseForUser({
        userId,
        userName: ctx.user.name,
        name: input.name,
      });
    }),

  update: domQuery
    .input(
      z.object({
        houseId: z.number(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (
        ctx.user.role !== "admin" &&
        (!ctx.currentMember || ctx.currentMember.houseId !== input.houseId)
      ) {
        throw new Error("House membership not found");
      }

      const [house] = await db
        .update(houses)
        .set({ name: input.name })
        .where(eq(houses.id, input.houseId))
        .returning();

      return house;
    }),

  "roomCode.rotate": domQuery
    .input(
      z.object({
        houseId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (
        ctx.user.role !== "admin" &&
        (!ctx.currentMember || ctx.currentMember.houseId !== input.houseId)
      ) {
        throw new Error("House membership not found");
      }

      const roomCode = await createUniqueRoomCode();
      const existing = await db.query.roomCodes.findFirst({
        where: eq(roomCodes.houseId, input.houseId),
      });

      if (existing) {
        const [updated] = await db
          .update(roomCodes)
          .set({ code: roomCode })
          .where(eq(roomCodes.houseId, input.houseId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(roomCodes)
        .values({ houseId: input.houseId, code: roomCode })
        .returning();
      return created;
    }),

  "approval.update": domQuery
    .input(
      z.object({
        houseId: z.number(),
        approvalRequired: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (
        ctx.user.role !== "admin" &&
        (!ctx.currentMember || ctx.currentMember.houseId !== input.houseId)
      ) {
        throw new Error("House membership not found");
      }

      const existing = await db.query.roomCodes.findFirst({
        where: eq(roomCodes.houseId, input.houseId),
      });

      if (existing) {
        const [updated] = await db
          .update(roomCodes)
          .set({ approvalRequired: input.approvalRequired })
          .where(eq(roomCodes.houseId, input.houseId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(roomCodes)
        .values({
          houseId: input.houseId,
          code: await createUniqueRoomCode(),
          approvalRequired: input.approvalRequired,
        })
        .returning();
      return created;
    }),

  "joinRequest.review": domQuery
    .input(
      z.object({
        requestId: z.number(),
        decision: z.enum(["approve", "reject"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const request = await db.query.roomJoinRequests.findFirst({
        where: eq(roomJoinRequests.id, input.requestId),
      });
      if (!request) throw new Error("Join request not found");
      if (
        ctx.user.role !== "admin" &&
        (!ctx.currentMember || ctx.currentMember.houseId !== request.houseId)
      ) {
        throw new Error("House membership not found");
      }

      if (request.status !== "pending") {
        throw new Error("Join request already reviewed");
      }

      if (input.decision === "reject") {
        await db
          .update(roomJoinRequests)
          .set({
            status: "rejected",
            reviewedBy: ctx.currentMember?.id ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(roomJoinRequests.id, input.requestId));
        return { success: true, status: "rejected" as const };
      }

      const existingMember = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, request.userId),
      });

      if (!existingMember) {
        const [member] = await db
          .insert(houseMembers)
          .values({
            houseId: request.houseId,
            userId: request.userId,
            nickname: request.nickname ?? "Thành viên mới",
            lifestyleRole: "submissive",
            gender: request.gender,
            telegramAvatar: avatarForGender(request.gender === "male" ? "male" : "female"),
          })
          .returning({ id: houseMembers.id });

        await db.insert(wallets).values({ memberId: member.id });
        await db.insert(memberProgress).values({ memberId: member.id });
      }

      await db
        .update(roomJoinRequests)
        .set({
          status: "approved",
          reviewedBy: ctx.currentMember?.id ?? null,
          reviewedAt: new Date(),
        })
        .where(eq(roomJoinRequests.id, input.requestId));

      return { success: true, status: "approved" as const };
    }),

  "member.update": domQuery
    .input(
      z.object({
        memberId: z.number(),
        nickname: z.string().max(255).optional(),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]).optional(),
        gender: z.enum(supportedGenders).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.lifestyleRole !== undefined) updateData.lifestyleRole = input.lifestyleRole;
      if (input.gender !== undefined) {
        updateData.gender = input.gender;
        updateData.telegramAvatar = avatarForGender(input.gender);
      }

      await db
        .update(houseMembers)
        .set(updateData)
        .where(eq(houseMembers.id, input.memberId));

      return { success: true };
    }),

  "member.remove": domQuery
    .input(z.object({ memberId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.id, input.memberId),
      });
      if (!member) throw new Error("Member not found");
      if (
        ctx.user.role !== "admin" &&
        (!ctx.currentMember || ctx.currentMember.houseId !== member.houseId)
      ) {
        throw new Error("House membership not found");
      }
      if (member.userId === ctx.user.id) {
        throw new Error("You cannot remove yourself from the room");
      }

      const house = await db.query.houses.findFirst({
        where: eq(houses.id, member.houseId),
      });
      if (house?.ownerId === member.userId) {
        throw new Error("Room owner cannot be removed");
      }

      await db.delete(wallets).where(eq(wallets.memberId, input.memberId));
      await db
        .delete(memberProgress)
        .where(eq(memberProgress.memberId, input.memberId));
      await db.delete(houseMembers).where(eq(houseMembers.id, input.memberId));

      return { success: true };
    }),

  "member.selfUpdate": authedQuery
    .input(
      z.object({
        nickname: z.string().max(255).optional(),
        gender: z.enum(supportedGenders).optional(),
        telegramAvatar: z.string().max(2048).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.gender !== undefined) {
        updateData.gender = input.gender;
        if (input.telegramAvatar === undefined) {
          updateData.telegramAvatar = avatarForGender(input.gender);
        }
      }
      if (input.telegramAvatar !== undefined) {
        updateData.telegramAvatar = input.telegramAvatar;
      }

      await db
        .update(houseMembers)
        .set(updateData)
        .where(eq(houseMembers.userId, ctx.user.id));

      return { success: true };
    }),

  "member.add": domQuery
    .input(
      z.object({
        houseId: z.number(),
        nickname: z.string().min(1).max(255),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]),
        gender: z.enum(supportedGenders).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // Create a placeholder member (no real user linked)
      const gender = input.gender ?? "female";
      const [member] = await db
        .insert(houseMembers)
        .values({
          houseId: input.houseId,
          userId: 0, // placeholder - will be linked when user joins
          nickname: input.nickname,
          lifestyleRole: input.lifestyleRole,
          gender,
          telegramAvatar: avatarForGender(gender),
        })
        .returning({ id: houseMembers.id });

      await db.insert(wallets).values({ memberId: member.id });

      return member;
    }),
});
