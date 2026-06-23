import * as cookie from "cookie";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { env } from "./lib/env";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { userCredentials, users } from "@db/schema";
import { eq } from "drizzle-orm";
import { signSessionToken } from "./kimi/session";
import { verifyZaloAccessToken } from "./zalo-auth";

const scrypt = promisify(scryptCallback);
const PASSWORD_HASH_PREFIX = "scrypt";

async function verifyPassword(password: string, storedHash: string) {
  const [prefix, salt, key] = storedHash.split("$");
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !key) return false;

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKey = Buffer.from(key, "hex");
  if (storedKey.length !== derivedKey.length) return false;
  return timingSafeEqual(storedKey, derivedKey);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey.toString("hex")}`;
}

export const authRouter = createRouter({
  zaloLogin: publicQuery
    .input(
      z.object({
        accessToken: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await verifyZaloAccessToken(input.accessToken);
      const unionId = `zalo:${profile.id}`;
      const existing = await db.query.users.findFirst({
        where: eq(users.unionId, unionId),
      });

      const user =
        existing ??
        (
          await db
            .insert(users)
            .values({
              unionId,
              name: profile.name,
              avatar: profile.avatar,
              role: "user",
              lastSignInAt: new Date(),
            })
            .returning()
        )[0];

      if (existing) {
        await db
          .update(users)
          .set({
            name: profile.name ?? existing.name,
            avatar: profile.avatar ?? existing.avatar,
            lastSignInAt: new Date(),
          })
          .where(eq(users.id, existing.id));
      }

      const token = await signSessionToken({
        unionId,
        clientId: env.zaloAppId || env.appId || "zalo-mini-app",
      });
      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        })
      );

      return {
        ...user,
        name: profile.name ?? user.name,
        avatar: profile.avatar ?? user.avatar,
      };
    }),
  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const normalizedEmail = input.email.trim().toLowerCase();
      const credential = await db.query.userCredentials.findFirst({
        where: eq(userCredentials.email, normalizedEmail),
      });

      if (!credential) {
        throw new Error("Email hoặc mật khẩu không đúng");
      }

      const passwordOk = await verifyPassword(input.password, credential.passwordHash);
      if (!passwordOk) {
        throw new Error("Email hoặc mật khẩu không đúng");
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, credential.userId),
      });

      if (!user) {
        throw new Error("Email hoặc mật khẩu không đúng");
      }

      await db
        .update(users)
        .set({ lastSignInAt: new Date() })
        .where(eq(users.id, user.id));

      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: env.appId || "local-app",
      });
      const opts = getSessionCookieOptions(ctx.req.headers);
      ctx.resHeaders.append(
        "set-cookie",
        cookie.serialize(Session.cookieName, token, {
          httpOnly: opts.httpOnly,
          path: opts.path,
          sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
          secure: opts.secure,
          maxAge: Session.maxAgeMs / 1000,
        })
      );

      return user;
    }),
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
