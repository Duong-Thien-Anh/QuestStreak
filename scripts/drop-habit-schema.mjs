import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(connectionString);

try {
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM "notifications"
      WHERE "type"::text = 'habit_checked_in'
         OR "entityType" = 'habit';
    `;

    await tx`
      DELETE FROM "streaks"
      WHERE "sourceType"::text = 'habit';
    `;

    await tx`DROP TABLE IF EXISTS "habitCheckins";`;
    await tx`DROP TABLE IF EXISTS "habits";`;
    await tx`DROP TYPE IF EXISTS "habitType";`;
    await tx`DROP TYPE IF EXISTS "frequency";`;
    await tx`DROP TYPE IF EXISTS "checkinStatus";`;

    await tx`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'streakSource'
            AND e.enumlabel = 'habit'
        ) THEN
          DROP TYPE IF EXISTS "streakSource_without_habit";
          CREATE TYPE "streakSource_without_habit" AS ENUM ('task');
          ALTER TABLE "streaks"
            ALTER COLUMN "sourceType" TYPE "streakSource_without_habit"
            USING "sourceType"::text::"streakSource_without_habit";
          DROP TYPE "streakSource";
          ALTER TYPE "streakSource_without_habit" RENAME TO "streakSource";
        END IF;
      END $$;
    `;

    await tx`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'notificationType'
            AND e.enumlabel = 'habit_checked_in'
        ) THEN
          DROP TYPE IF EXISTS "notificationType_without_habit";
          CREATE TYPE "notificationType_without_habit" AS ENUM (
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
          ALTER TABLE "notifications" ALTER COLUMN "type" DROP DEFAULT;
          ALTER TABLE "notifications"
            ALTER COLUMN "type" TYPE "notificationType_without_habit"
            USING "type"::text::"notificationType_without_habit";
          ALTER TABLE "notifications" ALTER COLUMN "type" SET DEFAULT 'system';
          DROP TYPE "notificationType";
          ALTER TYPE "notificationType_without_habit" RENAME TO "notificationType";
        END IF;
      END $$;
    `;
  });

  console.log("Habit schema removed.");
} finally {
  await sql.end();
}
