import { z } from "zod";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { houseMembers, notifications } from "@db/schema";

async function getCurrentMember(userId: number) {
  const db = getDb();
  return db.query.houseMembers.findFirst({
    where: eq(houseMembers.userId, userId),
  });
}

export const notificationRouter = createRouter({
  list: authedQuery
    .input(
      z.object({
        houseId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        unreadOnly: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const member = await getCurrentMember(ctx.user.id);
      if (!member || member.houseId !== input.houseId) return [];

      return db.query.notifications.findMany({
        where: and(
          eq(notifications.houseId, input.houseId),
          input.unreadOnly
            ? eq(notifications.recipientId, member.id)
            : or(isNull(notifications.recipientId), eq(notifications.recipientId, member.id)),
          input.unreadOnly ? isNull(notifications.readAt) : undefined
        ),
        orderBy: desc(notifications.createdAt),
        limit: input.limit,
      });
    }),

  unreadCount: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const member = await getCurrentMember(ctx.user.id);
      if (!member || member.houseId !== input.houseId) return { count: 0 };

      const unread = await db.query.notifications.findMany({
        where: and(
          eq(notifications.houseId, input.houseId),
          eq(notifications.recipientId, member.id),
          isNull(notifications.readAt)
        ),
      });

      return { count: unread.length };
    }),

  markRead: authedQuery
    .input(z.object({ notificationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await getCurrentMember(ctx.user.id);
      if (!member) throw new Error("Member not found");

      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.notificationId),
            eq(notifications.recipientId, member.id)
          )
        );

      return { success: true };
    }),

  markAllRead: authedQuery
    .input(z.object({ houseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await getCurrentMember(ctx.user.id);
      if (!member || member.houseId !== input.houseId) return { success: true };

      await db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.houseId, input.houseId),
            eq(notifications.recipientId, member.id),
            isNull(notifications.readAt)
          )
        );

      return { success: true };
    }),
});
