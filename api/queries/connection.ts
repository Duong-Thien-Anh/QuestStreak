/**
 * Database connection — returns the shared `db` instance from db/index.ts.
 * Driver is selected automatically based on NODE_ENV:
 *   - development: postgres-js -> local PostgreSQL
 *   - production:  @neondatabase/serverless -> Neon
 */
import { db } from "@db/index";

export function getDb() {
  return db;
}
