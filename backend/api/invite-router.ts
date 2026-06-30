import { nanoid } from "nanoid";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery, domQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  houseInvites,
  houseMembers,
  houses,
  logs,
  memberProgress,
  roomCodes,
  roomJoinRequests,
  wallets,
} from "@db/schema";
import { createNotification } from "./lib/notifications";
import { avatarForGender, supportedGenders } from "./lib/gender";

function createInviteCode() {
  return nanoid(12);
}

async function getCurrentMember(userId: number) {
  const db = getDb();
  return db.query.houseMembers.findFirst({
    where: eq(houseMembers.userId, userId),
  });
}

async function createUniqueInviteCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createInviteCode();
    const existing = await db.query.houseInvites.findFirst({
      where: eq(houseInvites.code, code),
    });
    if (!existing) return code;
  }

  throw new Error("Failed to generate invite code");
}

export const inviteRouter = createRouter({
  list: domQuery
    .input(
      z.object({
        houseId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.houseInvites.findMany({
        where: eq(houseInvites.houseId, input.houseId),
        orderBy: desc(houseInvites.createdAt),
      });
    }),

  create: domQuery
    .input(
      z.object({
        houseId: z.number(),
        intendedNickname: z.string().min(1).max(255).optional(),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]).default("submissive"),
        gender: z.enum(supportedGenders).default("female"),
        expiresInDays: z.number().int().min(1).max(90).default(7),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await getCurrentMember(ctx.user.id);
      if (!actor || actor.houseId !== input.houseId) {
        throw new Error("House membership not found");
      }

      const code = await createUniqueInviteCode();
      const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);

      const [invite] = await db
        .insert(houseInvites)
        .values({
          houseId: input.houseId,
          code,
          invitedBy: actor.id,
          intendedNickname: input.intendedNickname ?? null,
          lifestyleRole: input.lifestyleRole,
          gender: input.gender,
          expiresAt,
        })
        .returning();

      await db.insert(logs).values({
        houseId: input.houseId,
        action: "INVITE_CREATED",
        actorId: actor.id,
        targetId: invite.id,
        details: JSON.stringify({
          code,
          intendedNickname: input.intendedNickname,
          lifestyleRole: input.lifestyleRole,
          expiresAt,
        }),
      });

      await createNotification({
        houseId: input.houseId,
        actorId: actor.id,
        type: "system",
        title: "Invite mới đã được tạo",
        message: input.intendedNickname ?? "Invite code sẵn sàng để chia sẻ",
        entityType: "invite",
        entityId: invite.id,
        metadata: { code, expiresAt },
      });

      return invite;
    }),

  revoke: domQuery
    .input(z.object({ inviteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const invite = await db.query.houseInvites.findFirst({
        where: eq(houseInvites.id, input.inviteId),
      });
      if (!invite) throw new Error("Invite not found");
      if (invite.status !== "active") return { success: true };

      const actor = await getCurrentMember(ctx.user.id);
      if (!actor || actor.houseId !== invite.houseId) {
        throw new Error("House membership not found");
      }

      await db
        .update(houseInvites)
        .set({ status: "revoked" })
        .where(eq(houseInvites.id, input.inviteId));

      return { success: true };
    }),

  preview: publicQuery
    .input(z.object({ code: z.string().min(1).max(32) }))
    .query(async ({ input }) => {
      const db = getDb();
      const roomCode = await db.query.roomCodes.findFirst({
        where: eq(roomCodes.code, input.code),
      });
      if (roomCode) {
        const room = await db.query.houses.findFirst({
          where: eq(houses.id, roomCode.houseId),
        });
        return {
          houseName: room?.name ?? "Lunis House",
          intendedNickname: null,
          lifestyleRole: "submissive" as const,
          gender: "female" as const,
          status: "active" as const,
          expiresAt: null,
          requiresApproval: roomCode.approvalRequired,
        };
      }
      return null;
    }),

  join: authedQuery
    .input(
      z.object({
        code: z.string().min(1).max(32),
        nickname: z.string().min(1).max(255).optional(),
        gender: z.enum(supportedGenders).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existingMember = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (existingMember) {
        throw new Error("User already belongs to a house");
      }

      const roomCode = await db.query.roomCodes.findFirst({
        where: eq(roomCodes.code, input.code),
      });
      if (roomCode) {
        const room = await db.query.houses.findFirst({
          where: eq(houses.id, roomCode.houseId),
        });
        if (!room) throw new Error("Room is invalid");

        if (roomCode.approvalRequired) {
          const existingRequest = await db.query.roomJoinRequests.findFirst({
            where: and(
              eq(roomJoinRequests.houseId, room.id),
              eq(roomJoinRequests.userId, ctx.user.id),
            ),
          });
          const requestData = {
            houseId: room.id,
            userId: ctx.user.id,
            nickname: input.nickname ?? ctx.user.name ?? "Thành viên mới",
            gender: input.gender ?? "female",
            status: "pending" as const,
            reviewedBy: null,
            reviewedAt: null,
          };

          const [request] =
            existingRequest && existingRequest.houseId === room.id
              ? await db
                  .update(roomJoinRequests)
                  .set(requestData)
                  .where(eq(roomJoinRequests.id, existingRequest.id))
                  .returning()
              : await db.insert(roomJoinRequests).values(requestData).returning();

          await db.insert(logs).values({
            houseId: room.id,
            action: "MEMBER_JOIN_REQUESTED_BY_ROOM_CODE",
            actorId: request.id,
            details: JSON.stringify({ code: input.code, userId: ctx.user.id }),
          });

          await createNotification({
            houseId: room.id,
            recipientId: room.ownerId,
            actorId: request.id,
            type: "system",
            title: "Có yêu cầu tham gia phòng mới",
            message: request.nickname,
            entityType: "roomJoinRequest",
            entityId: request.id,
            metadata: { code: input.code, userId: ctx.user.id },
          });

          return { ...request, joinStatus: "pending" as const };
        }

        const gender = input.gender ?? "female";
        const [member] = await db
          .insert(houseMembers)
          .values({
            houseId: room.id,
            userId: ctx.user.id,
            nickname: input.nickname ?? ctx.user.name ?? "Thành viên mới",
            lifestyleRole: "submissive",
            gender,
            telegramAvatar: avatarForGender(gender),
          })
          .returning();

        await db.insert(wallets).values({ memberId: member.id });
        await db.insert(memberProgress).values({ memberId: member.id });

        await db.insert(logs).values({
          houseId: room.id,
          action: "MEMBER_JOINED_BY_ROOM_CODE",
          actorId: member.id,
          details: JSON.stringify({ code: input.code }),
        });

        await createNotification({
          houseId: room.id,
          actorId: member.id,
          type: "system",
          title: "Thành viên mới đã tham gia phòng",
          message: member.nickname,
          entityType: "member",
          entityId: member.id,
          metadata: { code: input.code },
        });

        return { ...member, joinStatus: "joined" as const };
      }

      throw new Error("Room code is invalid");
    }),
});
