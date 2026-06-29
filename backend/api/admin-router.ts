import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { desc, eq, inArray, and } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  houses,
  houseMembers,
  memberProgress,
  registrationRequests,
  roomCodes,
  userCredentials,
  users,
  wallets,
} from "@db/schema";
import { sendMail, buildApprovalEmail, buildRejectionEmail } from "./lib/mailer";

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
      gender: "other",
    })
    .returning();
  await ensureMemberResources(member.id);
  return member;
}

export const adminRouter = createRouter({
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
      const existing = await db.query.userCredentials.findFirst({
        where: eq(userCredentials.email, email),
      });
      if (existing) throw new Error("Email đã tồn tại");

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
        username: input.username?.trim() || null,
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
        gender: z.enum(["male", "female", "other"]).default("other"),
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
        gender: z.enum(["male", "female", "other"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.nickname !== undefined) updateData.nickname = input.nickname;
      if (input.lifestyleRole !== undefined) {
        updateData.lifestyleRole = input.lifestyleRole;
      }
      if (input.gender !== undefined) updateData.gender = input.gender;

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
        username: req.username ?? undefined,
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
