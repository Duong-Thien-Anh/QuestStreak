/**
 * Database client — switches driver automatically based on NODE_ENV:
 *   - development: `postgres` npm package → local PostgreSQL (Docker)
 *   - production:  `@neondatabase/serverless` → Neon
 *
 * The return type is cast to PostgresJsDatabase so all callers get
 * a single, consistent Drizzle interface regardless of the underlying driver.
 */

import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
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

function createDb(): PostgresJsDatabase<Schema> {
  if (process.env.NODE_ENV === "production") {
    // Production: Neon serverless (HTTP-based, no persistent connection)
    const sql = neon(DATABASE_URL);
    return drizzleNeon(sql, { schema }) as unknown as PostgresJsDatabase<Schema>;
  } else {
    // Development: standard postgres driver → local PostgreSQL via Docker
    const client = postgresJs(DATABASE_URL);
    return drizzlePostgres(client, { schema });
  }
}

export const db = createDb();
export type DB = typeof db;
