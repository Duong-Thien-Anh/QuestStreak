import "dotenv/config";
import { defineConfig } from "drizzle-kit";

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.DATABASE_URL_LOCAL) return process.env.DATABASE_URL_LOCAL;
  if (process.env.DATABASE_URL_PROD) return process.env.DATABASE_URL_PROD;
  throw new Error("DATABASE_URL, DATABASE_URL_LOCAL, or DATABASE_URL_PROD is required to run drizzle commands");
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
