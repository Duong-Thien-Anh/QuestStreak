import postgres from "postgres";
import { env } from "./env";

export async function ensureUserCredentialsSchema() {
  if (!env.databaseUrl) {
    return;
  }

  const sql = postgres(env.databaseUrl, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS public."userCredentials" (
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
      ALTER TABLE public."userCredentials"
        ADD COLUMN IF NOT EXISTS "username" varchar(100),
        ADD COLUMN IF NOT EXISTS "phone" varchar(30),
        ADD COLUMN IF NOT EXISTS "createdAt" timestamp NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "updatedAt" timestamp NOT NULL DEFAULT now()
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_user_idx"
      ON public."userCredentials" ("userId")
    `;

    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "user_credentials_email_idx"
      ON public."userCredentials" ("email")
    `;
  } finally {
    await sql.end();
  }
}

export async function ensureTaskRewardSchema() {
  if (!env.databaseUrl) {
    return;
  }

  const sql = postgres(env.databaseUrl, { max: 1 });
  try {
    await sql`
      ALTER TABLE public."tasks"
        ADD COLUMN IF NOT EXISTS "bonusXp" integer DEFAULT 0 NOT NULL,
        ADD COLUMN IF NOT EXISTS "linkedAchievementId" bigint
    `;
  } finally {
    await sql.end();
  }
}

export async function ensureGenderAvatarSchema() {
  if (!env.databaseUrl) {
    return;
  }

  const sql = postgres(env.databaseUrl, { max: 1 });
  try {
    await sql`
      ALTER TABLE public."registrationRequests" ALTER COLUMN "gender" SET DEFAULT 'female'
    `;
    await sql`
      ALTER TABLE public."roomJoinRequests" ALTER COLUMN "gender" SET DEFAULT 'female'
    `;
    await sql`
      ALTER TABLE public."houseMembers" ALTER COLUMN "gender" SET DEFAULT 'female'
    `;
    await sql`
      ALTER TABLE public."houseInvites" ALTER COLUMN "gender" SET DEFAULT 'female'
    `;

    await sql`UPDATE public."registrationRequests" SET "gender" = 'female' WHERE "gender" = 'other'`;
    await sql`UPDATE public."roomJoinRequests" SET "gender" = 'female' WHERE "gender" = 'other'`;
    await sql`UPDATE public."houseMembers" SET "gender" = 'female' WHERE "gender" = 'other'`;
    await sql`UPDATE public."houseInvites" SET "gender" = 'female' WHERE "gender" = 'other'`;

    await sql`
      UPDATE public."houseMembers"
      SET "telegramAvatar" = CASE
        WHEN "gender" = 'male' THEN '/avatars/admin.jpg'
        ELSE '/avatars/sub.jpg'
      END
    `;
  } finally {
    await sql.end();
  }
}
