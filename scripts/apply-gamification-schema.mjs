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
      CREATE TYPE "achievementCriteria" AS ENUM ('total_completions', 'current_streak', 'xp', 'level');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "streakSource" AS ENUM ('habit', 'task');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "memberProgress" (
      "id" serial PRIMARY KEY NOT NULL,
      "memberId" bigint NOT NULL,
      "xp" integer DEFAULT 0 NOT NULL,
      "level" integer DEFAULT 1 NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "memberProgress_memberId_unique" UNIQUE("memberId")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "streaks" (
      "id" serial PRIMARY KEY NOT NULL,
      "memberId" bigint NOT NULL,
      "sourceType" "streakSource" NOT NULL,
      "sourceId" bigint NOT NULL,
      "currentStreak" integer DEFAULT 0 NOT NULL,
      "longestStreak" integer DEFAULT 0 NOT NULL,
      "lastCompletedAt" timestamp,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "achievements" (
      "id" serial PRIMARY KEY NOT NULL,
      "key" varchar(100) NOT NULL,
      "title" varchar(255) NOT NULL,
      "description" text,
      "icon" varchar(50) DEFAULT 'trophy' NOT NULL,
      "xpReward" integer DEFAULT 0 NOT NULL,
      "criteriaType" "achievementCriteria" NOT NULL,
      "criteriaValue" integer NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "memberAchievements" (
      "id" serial PRIMARY KEY NOT NULL,
      "memberId" bigint NOT NULL,
      "achievementId" bigint NOT NULL,
      "unlockedAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "streaks_member_source_idx"
    ON "streaks" ("memberId", "sourceType", "sourceId");
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "achievements_key_idx"
    ON "achievements" ("key");
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "member_achievements_member_achievement_idx"
    ON "memberAchievements" ("memberId", "achievementId");
  `;

  await sql`
    INSERT INTO "memberProgress" ("memberId", "xp", "level")
    SELECT "id", 0, 1 FROM "houseMembers"
    ON CONFLICT ("memberId") DO NOTHING;
  `;

  await sql`
    INSERT INTO "achievements" ("key", "title", "description", "icon", "xpReward", "criteriaType", "criteriaValue")
    VALUES
      ('first_step', 'Bước đầu tiên', 'Hoàn thành habit hoặc task đầu tiên.', 'sparkles', 10, 'total_completions', 1),
      ('streak_3', 'Chuỗi 3 ngày', 'Giữ streak 3 ngày liên tiếp.', 'flame', 25, 'current_streak', 3),
      ('streak_7', 'Một tuần rực cháy', 'Giữ streak 7 ngày liên tiếp.', 'flame', 75, 'current_streak', 7),
      ('xp_100', '100 XP', 'Tích lũy 100 XP.', 'badge', 20, 'xp', 100),
      ('level_5', 'Level 5', 'Đạt level 5.', 'crown', 100, 'level', 5)
    ON CONFLICT ("key") DO NOTHING;
  `;

  console.log("Gamification schema applied.");
} finally {
  await sql.end();
}
