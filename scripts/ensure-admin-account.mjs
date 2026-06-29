import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = "scrypt";

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${PASSWORD_HASH_PREFIX}$${salt}$${Buffer.from(key).toString("hex")}`;
}

const databaseUrl = resolveDatabaseUrl();
const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
const adminName = process.env.ADMIN_NAME || "Root Admin";
const adminUsername = (process.env.ADMIN_USERNAME || "admin").trim();
const adminUnionId = process.env.ADMIN_UNION_ID || `local:${adminEmail}`;

const sql = postgres(databaseUrl, { max: 1 });

try {
  const [connection] = await sql`
    SELECT current_database() AS database, current_schema() AS schema, current_user AS user
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "userCredentials" (
      "id" serial PRIMARY KEY,
      "userId" bigint NOT NULL,
      "email" varchar(320) NOT NULL,
      "username" varchar(100),
      "phone" varchar(30),
      "passwordHash" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    ALTER TABLE "userCredentials"
      ADD COLUMN IF NOT EXISTS "username" varchar(100),
      ADD COLUMN IF NOT EXISTS "phone" varchar(30)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_user_idx"
    ON "userCredentials" ("userId")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_email_idx"
    ON "userCredentials" ("email")
  `;

  const existing = await sql`
    SELECT "id"
    FROM "users"
    WHERE lower("email") = ${adminEmail}
       OR "unionId" = ${adminUnionId}
    ORDER BY "id"
    LIMIT 1
  `;

  let userId = existing[0]?.id;

  if (!userId) {
    const [created] = await sql`
      INSERT INTO "users" ("unionId", "name", "email", "role", "lastSignInAt")
      VALUES (${adminUnionId}, ${adminName}, ${adminEmail}, 'admin', now())
      RETURNING "id"
    `;
    userId = created.id;
  } else {
    await sql`
      UPDATE "users"
      SET
        "unionId" = ${adminUnionId},
        "name" = ${adminName},
        "email" = ${adminEmail},
        "role" = 'admin',
        "updatedAt" = now()
      WHERE "id" = ${userId}
    `;
  }

  const passwordHash = await hashPassword(adminPassword);

  await sql`
    INSERT INTO "userCredentials" ("userId", "email", "username", "passwordHash")
    VALUES (${userId}, ${adminEmail}, ${adminUsername || null}, ${passwordHash})
    ON CONFLICT ("email") DO UPDATE SET
      "userId" = excluded."userId",
      "username" = excluded."username",
      "passwordHash" = excluded."passwordHash",
      "updatedAt" = now()
  `;

  const [verifiedUser] = await sql`
    SELECT "id", "email", "role"
    FROM "users"
    WHERE "id" = ${userId}
  `;

  const [verifiedCredential] = await sql`
    SELECT "id", "userId", "email", "username"
    FROM "userCredentials"
    WHERE "userId" = ${userId}
  `;

  console.log(
    JSON.stringify(
      {
        connection,
        user: verifiedUser,
        credential: verifiedCredential,
        login: { email: adminEmail, password: adminPassword },
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
