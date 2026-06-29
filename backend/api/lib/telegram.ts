import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export type ParsedInitData = {
  user: TelegramUser;
  auth_date: number;
  hash: string;
};

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
): ParsedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("Telegram initData hash missing");
  }

  params.delete("hash");

  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expectedHash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  const expectedHashBuffer = Buffer.from(expectedHash);
  const hashBuffer = Buffer.from(hash);
  if (
    expectedHashBuffer.length !== hashBuffer.length ||
    !timingSafeEqual(expectedHashBuffer, hashBuffer)
  ) {
    throw new Error("Invalid Telegram initData signature");
  }

  const authDate = parseInt(params.get("auth_date") ?? "0");
  if (Date.now() / 1000 - authDate > 3600) {
    throw new Error("Telegram initData expired");
  }

  const user = JSON.parse(params.get("user") ?? "{}") as TelegramUser;
  return { user, auth_date: authDate, hash };
}
