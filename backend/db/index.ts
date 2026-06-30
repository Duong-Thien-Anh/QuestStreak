/**
 * Database client.
 *
 * Use the same postgres-js driver in every environment. The schema scripts also
 * use this driver, so production queries behave like the migration/repair tools.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgresJs from "postgres";
import "dotenv/config";
import * as schema from "./schema";

type Schema = typeof schema;

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NODE_ENV === "production" && process.env.DATABASE_URL_PROD) {
    return process.env.DATABASE_URL_PROD;
  }
  if (process.env.DATABASE_URL_LOCAL) return process.env.DATABASE_URL_LOCAL;
  if (process.env.DATABASE_URL_PROD) return process.env.DATABASE_URL_PROD;
  throw new Error("DATABASE_URL, DATABASE_URL_LOCAL, or DATABASE_URL_PROD environment variable is required");
}

const DATABASE_URL = resolveDatabaseUrl();

function withPublicSearchPath(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  if (!url.searchParams.has("options")) {
    url.searchParams.set("options", "-c search_path=public");
  }
  return url.toString();
}

function createDb(): PostgresJsDatabase<Schema> {
  const client = postgresJs(withPublicSearchPath(DATABASE_URL));
  return drizzle(client, { schema });
}

export const db = createDb();
export type DB = typeof db;
