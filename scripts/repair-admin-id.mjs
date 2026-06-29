import "dotenv/config";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const sql = postgres(resolveDatabaseUrl(), { max: 1 });

try {
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM "userCredentials"
      WHERE "userId" = 1
        AND email <> 'admin@example.com'
    `;

    await tx`UPDATE "roomJoinRequests" SET "reviewedBy" = 1 WHERE "reviewedBy" = 6`;
    await tx`UPDATE "registrationRequests" SET "reviewedBy" = 1 WHERE "reviewedBy" = 6`;
    await tx`UPDATE "taskSubmissions" SET "reviewedBy" = 1 WHERE "reviewedBy" = 6`;
    await tx`UPDATE "houseInvites" SET "acceptedBy" = 1 WHERE "acceptedBy" = 6`;

    await tx`
      UPDATE users
      SET id = 1, "updatedAt" = now()
      WHERE id = 6
        AND NOT EXISTS (SELECT 1 FROM users WHERE id = 1)
    `;

    await tx`
      UPDATE "userCredentials"
      SET id = 1, "userId" = 1, "updatedAt" = now()
      WHERE email = 'admin@example.com'
    `;

    await tx`
      SELECT setval(
        pg_get_serial_sequence('users', 'id'),
        COALESCE((SELECT max(id) FROM users), 1),
        true
      )
    `;

    await tx`
      SELECT setval(
        pg_get_serial_sequence('"userCredentials"', 'id'),
        COALESCE((SELECT max(id) FROM "userCredentials"), 1),
        true
      )
    `;
  });

  const users = await sql`
    SELECT id, "unionId", name, email, role
    FROM users
    ORDER BY id
  `;
  const credentials = await sql`
    SELECT id, "userId", email, username
    FROM "userCredentials"
    ORDER BY id
  `;
  const refs = await sql`
    SELECT
      h.id AS "houseId",
      h.name,
      h."ownerId",
      hm.id AS "memberId",
      hm."userId",
      hm.nickname
    FROM houses h
    LEFT JOIN "houseMembers" hm ON hm."houseId" = h.id
    ORDER BY h.id, hm.id
  `;
  const sequences = await sql`
    SELECT sequencename, last_value
    FROM pg_sequences
    WHERE schemaname = 'public'
      AND sequencename IN ('users_id_seq', 'userCredentials_id_seq')
    ORDER BY sequencename
  `;

  console.log(JSON.stringify({ users, credentials, refs, sequences }, null, 2));
} finally {
  await sql.end();
}
