/**
 * demo-auth.ts
 *
 * Demo login system for local development and Render staging deployments.
 * Only active when DEMO_MODE=true is set in environment variables.
 *
 * Endpoint: POST /api/auth/demo
 * Body:     { "username": "demo_dom_1" | "demo_sub_1" | "demo_admin" }
 *
 * Returns a session JWT in an httpOnly cookie (kimi_sid).
 * Returns 403 if DEMO_MODE is not "true".
 */

import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { getSessionCookieOptions } from "./lib/cookies";
import { getDb } from "./queries/connection";
import { signSessionToken } from "./kimi/session";

// ─── Demo User Definitions ──────────────────────────────────────────────────

const DEMO_USERS = [
  {
    username: "demo_dom_1",
    unionId: "demo:demo_dom_1",
    name: "Demo Dominant",
    role: "user" as const,
    avatar: null as string | null,
  },
  {
    username: "demo_sub_1",
    unionId: "demo:demo_sub_1",
    name: "Demo Submissive",
    role: "user" as const,
    avatar: null as string | null,
  },
  {
    username: "demo_admin",
    unionId: "demo:demo_admin",
    name: "Demo Admin",
    role: "admin" as const,
    avatar: null as string | null,
  },
] as const;

type DemoUsername = (typeof DEMO_USERS)[number]["username"];

// ─── Upsert Helper ───────────────────────────────────────────────────────────

async function upsertDemoUser(
  unionId: string,
  name: string,
  role: "user" | "admin",
) {
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.unionId, unionId),
  });

  if (existing) {
    await db
      .update(users)
      .set({ lastSignInAt: new Date() })
      .where(eq(users.unionId, unionId));
    return existing;
  }

  const [created] = await db
    .insert(users)
    .values({
      unionId,
      name,
      role,
      lastSignInAt: new Date(),
    })
    .returning();

  return created;
}

// ─── Handler Factory ─────────────────────────────────────────────────────────

export function createDemoAuthHandler() {
  return async (c: Context) => {
    // Guard: only active when DEMO_MODE=true
    if (process.env.DEMO_MODE !== "true") {
      return c.json({ error: "Demo mode is not enabled" }, 403);
    }

    // Parse body
    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const username = body?.username as DemoUsername | undefined;

    // Validate demo username
    const demoUser = DEMO_USERS.find((u) => u.username === username);
    if (!demoUser) {
      return c.json(
        {
          error:
            "Invalid demo user. Allowed values: demo_dom_1, demo_sub_1, demo_admin",
        },
        400,
      );
    }

    // Upsert user row
    const user = await upsertDemoUser(
      demoUser.unionId,
      demoUser.name,
      demoUser.role,
    );

    // Sign JWT with JWT_SECRET (falls back to APP_SECRET for local dev)
    const jwtSecret = process.env.JWT_SECRET || process.env.APP_SECRET || "";
    const token = await signSessionToken({
      unionId: user.unionId,
      clientId: process.env.APP_ID || "demo-app",
    });

    // Store in httpOnly cookie — never localStorage
    setCookie(c, Session.cookieName, token, {
      ...getSessionCookieOptions(c.req.raw.headers),
      maxAge: Session.maxAgeMs / 1000,
    });

    return c.json({
      ok: true,
      user: {
        id: user.id,
        unionId: user.unionId,
        name: user.name,
        role: user.role,
      },
    });
  };
}
