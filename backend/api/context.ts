import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { HouseMember, User } from "@db/schema";
import { authenticateRequest, type AuthPlatform } from "./lib/auth";

export type Platform = AuthPlatform;

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  platform: Platform;
  user?: User;
  currentMember?: HouseMember;
};

function detectPlatform(req: Request): Platform {
  const explicitPlatform = req.headers.get("x-platform")?.toLowerCase();
  if (explicitPlatform === "telegram") return "telegram";
  if (explicitPlatform === "web") return "web";

  const url = new URL(req.url);
  if (
    url.searchParams.has("initData") ||
    req.headers.has("x-telegram-init-data")
  ) {
    return "telegram";
  }

  const userAgent = req.headers.get("user-agent")?.toLowerCase() ?? "";
  if (userAgent.includes("telegram")) return "telegram";

  return "web";
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const platform = detectPlatform(opts.req);
  const ctx: TrpcContext = {
    req: opts.req,
    resHeaders: opts.resHeaders,
    platform,
  };
  try {
    ctx.user = await authenticateRequest(opts.req.headers, platform);
  } catch {
    // Authentication is optional here
  }
  return ctx;
}
