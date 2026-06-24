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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

function createDb(): PostgresJsDatabase<Schema> {
  if (process.env.NODE_ENV === "production") {
    // Production: Neon serverless (HTTP-based, no persistent connection)
    const sql = neon(DATABASE_URL!);
    return drizzleNeon(sql, { schema }) as unknown as PostgresJsDatabase<Schema>;
  } else {
    // Development: standard postgres driver → local PostgreSQL via Docker
    const client = postgresJs(DATABASE_URL!);
    return drizzlePostgres(client, { schema });
  }
}

export const db = createDb();
export type DB = typeof db;
