import "dotenv/config";

export function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.DATABASE_URL_LOCAL) return process.env.DATABASE_URL_LOCAL;
  if (process.env.DATABASE_URL_PROD) return process.env.DATABASE_URL_PROD;
  throw new Error(
    "DATABASE_URL, DATABASE_URL_LOCAL, or DATABASE_URL_PROD is required",
  );
}
