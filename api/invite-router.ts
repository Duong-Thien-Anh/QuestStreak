import { nanoid } from "nanoid";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, adminQuery, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  houseInvites,
  houseMembers,
  houses,
  logs,
  memberProgress,
  wallets,
} from "@db/schema";
import { createNotification } from "./lib/notifications";

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

function isInviteExpired(expiresAt: Date | null) {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
}

export const inviteRouter = createRouter({
  list: adminQuery
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

  create: adminQuery
    .input(
      z.object({
        houseId: z.number(),
        intendedNickname: z.string().min(1).max(255).optional(),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]).default("submissive"),
        gender: z.enum(["male", "female", "other"]).default("other"),
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

  revoke: adminQuery
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
      const invite = await db.query.houseInvites.findFirst({
        where: eq(houseInvites.code, input.code),
      });
      if (!invite) return null;

      const house = await db.query.houses.findFirst({
        where: eq(houses.id, invite.houseId),
      });

      return {
        houseName: house?.name ?? "Lunis House",
        intendedNickname: invite.intendedNickname,
        lifestyleRole: invite.lifestyleRole,
        gender: invite.gender,
        status: isInviteExpired(invite.expiresAt) && invite.status === "active" ? "expired" : invite.status,
        expiresAt: invite.expiresAt,
      };
    }),

  join: authedQuery
    .input(
      z.object({
        code: z.string().min(1).max(32),
        nickname: z.string().min(1).max(255).optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
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

      const invite = await db.query.houseInvites.findFirst({
        where: and(eq(houseInvites.code, input.code), eq(houseInvites.status, "active")),
      });
      if (!invite) throw new Error("Invite is invalid");

      if (isInviteExpired(invite.expiresAt)) {
        await db
          .update(houseInvites)
          .set({ status: "expired" })
          .where(eq(houseInvites.id, invite.id));
        throw new Error("Invite has expired");
      }

      const [member] = await db
        .insert(houseMembers)
        .values({
          houseId: invite.houseId,
          userId: ctx.user.id,
          nickname: input.nickname ?? invite.intendedNickname ?? ctx.user.name ?? "Thành viên mới",
          lifestyleRole: invite.lifestyleRole,
          gender: input.gender ?? invite.gender,
        })
        .returning();

      await db.insert(wallets).values({ memberId: member.id });
      await db.insert(memberProgress).values({ memberId: member.id });

      await db
        .update(houseInvites)
        .set({
          status: "accepted",
          acceptedBy: member.id,
          acceptedAt: new Date(),
        })
        .where(eq(houseInvites.id, invite.id));

      await db.insert(logs).values({
        houseId: invite.houseId,
        action: "MEMBER_JOINED_BY_INVITE",
        actorId: member.id,
        targetId: invite.id,
        details: JSON.stringify({ code: invite.code }),
      });

      await createNotification({
        houseId: invite.houseId,
        actorId: member.id,
        type: "system",
        title: "Thành viên mới đã vào house",
        message: member.nickname ?? ctx.user.name ?? "Thành viên mới",
        entityType: "member",
        entityId: member.id,
        metadata: { inviteId: invite.id },
      });

      return { success: true, member };
    }),
});

