import { notifications } from "@db/schema";
import { getDb } from "../queries/connection";

type NotificationInsert = typeof notifications.$inferInsert;

export async function createNotification(input: {
  houseId: number;
  recipientId?: number | null;
  actorId?: number | null;
  type: NotificationInsert["type"];
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  metadata?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const [notification] = await db
    .insert(notifications)
    .values({
      houseId: input.houseId,
      recipientId: input.recipientId ?? null,
      actorId: input.actorId ?? null,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .returning();

  return notification;
}
