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
      CREATE TYPE "taskSubmissionStatus" AS ENUM ('submitted', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "taskSubmissions" (
      "id" serial PRIMARY KEY NOT NULL,
      "taskId" bigint NOT NULL,
      "memberId" bigint NOT NULL,
      "note" text,
      "proofUrl" text,
      "proofType" varchar(50),
      "status" "taskSubmissionStatus" DEFAULT 'submitted' NOT NULL,
      "reviewedBy" bigint,
      "reviewedAt" timestamp,
      "reviewNote" text,
      "submittedAt" timestamp DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "task_submissions_task_submitted_idx"
    ON "taskSubmissions" ("taskId", "submittedAt");
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "task_submissions_member_status_idx"
    ON "taskSubmissions" ("memberId", "status");
  `;

  console.log("Task submission schema applied.");
} finally {
  await sql.end();
}
