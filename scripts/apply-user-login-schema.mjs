import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { resolveDatabaseUrl } from "./_db-url.mjs";

const scrypt = promisify(scryptCallback);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(key).toString("hex")}`;
}

const databaseUrl = resolveDatabaseUrl();
const adminEmail = (process.env.LOGIN_ADMIN_EMAIL || "local@example.test").trim().toLowerCase();
const adminPassword = process.env.LOGIN_ADMIN_PASSWORD || "Password123!";
const adminName = process.env.LOGIN_ADMIN_NAME || "Local Admin";
const adminUnionId = process.env.LOGIN_ADMIN_UNION_ID || "local-password-admin";

const sql = postgres(databaseUrl, { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS "userCredentials" (
      "id" serial PRIMARY KEY,
      "userId" bigint NOT NULL,
      "email" varchar(320) NOT NULL,
      "passwordHash" text NOT NULL,
      "createdAt" timestamp NOT NULL DEFAULT now(),
      "updatedAt" timestamp NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_user_idx"
    ON "userCredentials" ("userId")
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_email_idx"
    ON "userCredentials" ("email")
  `;

  const existingByEmail = await sql`
    SELECT "id"
    FROM "users"
    WHERE lower("email") = ${adminEmail}
    LIMIT 1
  `;

  let userId = existingByEmail[0]?.id;

  if (!userId) {
    const inserted = await sql`
      INSERT INTO "users" ("unionId", "name", "email", "role", "lastSignInAt")
      VALUES (${adminUnionId}, ${adminName}, ${adminEmail}, 'admin', now())
      ON CONFLICT ("unionId") DO UPDATE SET
        "name" = excluded."name",
        "email" = excluded."email",
        "role" = 'admin',
        "updatedAt" = now()
      RETURNING "id"
    `;
    userId = inserted[0].id;
  } else {
    await sql`
      UPDATE "users"
      SET "role" = 'admin', "updatedAt" = now()
      WHERE "id" = ${userId}
    `;
  }

  const passwordHash = await hashPassword(adminPassword);
  await sql`
    INSERT INTO "userCredentials" ("userId", "email", "passwordHash")
    VALUES (${userId}, ${adminEmail}, ${passwordHash})
    ON CONFLICT ("email") DO UPDATE SET
      "userId" = excluded."userId",
      "passwordHash" = excluded."passwordHash",
      "updatedAt" = now()
  `;

  console.log("User login schema is ready.");
  console.log(`Admin login: ${adminEmail}`);
  if (!process.env.LOGIN_ADMIN_PASSWORD) {
    console.log("Default password: Password123!");
  }
} finally {
  await sql.end();
}
