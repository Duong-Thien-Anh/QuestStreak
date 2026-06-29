import path from "node:path";
import dotenv from "dotenv";

const backendEnvPath = path.resolve(import.meta.dirname, "../../.env");
const rootEnvPath = path.resolve(import.meta.dirname, "../../../.env");

dotenv.config({ path: backendEnvPath });
dotenv.config({ path: rootEnvPath });

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: process.env.KIMI_AUTH_URL ?? "",
  kimiOpenUrl: process.env.KIMI_OPEN_URL ?? "",
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  zaloAppId: process.env.ZALO_APP_ID ?? process.env.APP_ID ?? "",
  zaloOpenApiUrl: process.env.ZALO_OPEN_API_URL ?? "https://graph.zalo.me/v2.0/me",
  smtpUrl: process.env.SMTP_URL ?? "",
  smtpApiKey: process.env.SMTP_API_KEY ?? "",
  mailFrom: process.env.MAIL_FROM ?? "",
};
