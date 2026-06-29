import * as cookie from "cookie";
import type { User } from "@db/schema";
import { Session } from "@contracts/constants";
import { verifySessionToken } from "../kimi/session";
import { findUserByUnionId } from "../queries/users";

export type AuthPlatform = "web" | "telegram";

function getBearerToken(headers: Headers) {
  const authHeader =
    headers.get("Authorization") ?? headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return undefined;
  }
  return authHeader.slice(7);
}

function getCookieToken(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  return cookies[Session.cookieName];
}

async function findUserFromToken(token: string) {
  const claim = await verifySessionToken(token);
  if (!claim) {
    return undefined;
  }
  return findUserByUnionId(claim.unionId);
}

export async function authenticateRequest(
  headers: Headers,
  platform?: AuthPlatform,
): Promise<User | undefined> {
  void platform;

  const bearerToken = getBearerToken(headers);
  if (bearerToken) {
    return findUserFromToken(bearerToken);
  }

  const cookieToken = getCookieToken(headers);
  if (!cookieToken) {
    return undefined;
  }

  return findUserFromToken(cookieToken);
}
