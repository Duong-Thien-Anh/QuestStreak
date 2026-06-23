import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(connectionString);

try {
  await sql`
    DO $$
    BEGIN
      ALTER TYPE "notificationType" ADD VALUE IF NOT EXISTS 'reward_gifted';
    EXCEPTION WHEN undefined_object THEN
      CREATE TYPE "notificationType" AS ENUM (
        'task_created',
        'task_assigned',
        'task_submitted',
        'task_completed',
        'task_rejected',
        'achievement_unlocked',
        'reward_gifted',
        'wallet_updated',
        'system'
      );
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "rewardGiftDetails" (
      "id" serial PRIMARY KEY NOT NULL,
      "purchaseId" bigint NOT NULL,
      "giftMessage" text,
      "giftReason" text,
      "createdAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "reward_gift_details_purchase_idx"
    ON "rewardGiftDetails" ("purchaseId");
  `;

  console.log("Reward gifting schema applied.");
} finally {
  await sql.end();
}
