import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`
    ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "bonusXp" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "linkedAchievementId" bigint
  `;

  console.log("Task reward schema applied.");
} finally {
  await sql.end();
}
