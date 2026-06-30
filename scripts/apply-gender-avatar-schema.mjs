import { resolveDatabaseUrl } from "./_db-url.mjs";
import postgres from "postgres";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql`ALTER TABLE "registrationRequests" ALTER COLUMN "gender" SET DEFAULT 'female'`;
  await sql`ALTER TABLE "roomJoinRequests" ALTER COLUMN "gender" SET DEFAULT 'female'`;
  await sql`ALTER TABLE "houseMembers" ALTER COLUMN "gender" SET DEFAULT 'female'`;
  await sql`ALTER TABLE "houseInvites" ALTER COLUMN "gender" SET DEFAULT 'female'`;

  await sql`UPDATE "registrationRequests" SET "gender" = 'female' WHERE "gender" = 'other'`;
  await sql`UPDATE "roomJoinRequests" SET "gender" = 'female' WHERE "gender" = 'other'`;
  await sql`UPDATE "houseMembers" SET "gender" = 'female' WHERE "gender" = 'other'`;
  await sql`UPDATE "houseInvites" SET "gender" = 'female' WHERE "gender" = 'other'`;

  await sql`
    UPDATE "houseMembers"
    SET "telegramAvatar" = CASE
      WHEN "gender" = 'male' THEN '/avatars/admin.jpg'
      ELSE '/avatars/sub.jpg'
    END
  `;

  console.log("Gender avatar schema applied.");
} finally {
  await sql.end();
}
