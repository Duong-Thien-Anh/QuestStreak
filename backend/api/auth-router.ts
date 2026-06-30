import * as cookie from "cookie";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { env } from "./lib/env";
import { supportedGenders } from "./lib/gender";
import { ensureUserCredentialsSchema } from "./lib/schema-repair";
import { verifyTelegramInitData } from "./lib/telegram";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { userCredentials, userPreferences, users, registrationRequests } from "@db/schema";
import { eq, or } from "drizzle-orm";
import { signSessionToken } from "./kimi/session";

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

function hasPostgresCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  while (current && typeof current === "object") {
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

export const authRouter = createRouter({
  telegramLogin: publicQuery
    .input(
      z.object({
        initData: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      if (!env.telegramBotToken) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Telegram bot token not configured",
        });
      }

      const db = getDb();
      const parsedData = verifyTelegramInitData(
        input.initData,
        env.telegramBotToken,
      );
      const profile = parsedData.user;
      const unionId = `telegram:${profile.id.toString()}`;
      const name =
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        profile.username ||
        `Telegram ${profile.id}`;

      const existing = await db.query.users.findFirst({
        where: eq(users.unionId, unionId),
      });

      const user = existing
        ? (
            await db
              .update(users)
              .set({
                name,
                avatar: profile.photo_url ?? existing.avatar,
                lastSignInAt: new Date(),
              })
              .where(eq(users.id, existing.id))
              .returning()
          )[0]
        : (
            await db
              .insert(users)
              .values({
                unionId,
                name,
                avatar: profile.photo_url ?? null,
                role: "user",
                lastSignInAt: new Date(),
              })
              .returning()
          )[0];

      const token = await signSessionToken({
        unionId,
        clientId: "telegram-mini-app",
      });

      return { token, user };
    }),

  zaloLogin: publicQuery
    .input(
      z.object({
        accessToken: z.string().min(1),
      })
    )
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Zalo login is no longer supported",
      });
    }),

  // ── Register (submit request, pending admin approval) ──────────────
  register: publicQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        email: z.string().email().max(320),
        username: z.string().min(3).max(100).optional(),
        phone: z.string().max(30).optional(),
        password: z.string().min(8),
        lifestyleRole: z.enum(["dominant", "submissive", "switch"]).default("submissive"),
        gender: z.enum(supportedGenders).default("female"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const normalizedEmail = input.email.trim().toLowerCase();

      // Reject if already has a pending/approved request or active credential
      const [existingReq, existingCred, existingUsername] = await Promise.all([
        db.query.registrationRequests.findFirst({
          where: eq(registrationRequests.email, normalizedEmail),
        }),
        db.query.userCredentials.findFirst({
          where: eq(userCredentials.email, normalizedEmail),
        }),
        input.username
          ? db.query.userCredentials.findFirst({
              where: eq(userCredentials.username, input.username.trim()),
            })
          : Promise.resolve(undefined),
      ]);

      if (existingCred) {
        throw new Error("Email đã được đăng ký");
      }
      if (existingUsername) {
        throw new Error("Tên đăng nhập đã được đăng ký");
      }
      if (existingReq && existingReq.status === "pending") {
        throw new Error("Yêu cầu đăng ký đang chờ duyệt");
      }
      if (existingReq && existingReq.status === "approved") {
        throw new Error("Email đã được đăng ký");
      }

      const passwordHash = await hashPassword(input.password);

      const [req] = await db
        .insert(registrationRequests)
        .values({
          name: input.name.trim(),
          email: normalizedEmail,
          username: input.username?.trim() || null,
          phone: input.phone?.trim() || null,
          lifestyleRole: input.lifestyleRole,
          gender: input.gender,
          passwordHash,
          status: "pending",
        })
        .returning();

      return { id: req.id, status: req.status };
    }),

  // ── Login (email / username / phone + password) ─────────────────────
  login: publicQuery
    .input(
      z.object({
        identifier: z.string().min(1),
        password: z.string().min(1),
        rememberMe: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const identifier = input.identifier.trim().toLowerCase();

      // Find credential by email, username, or phone
      const findCredential = () =>
        db.query.userCredentials.findFirst({
          where: or(
            eq(userCredentials.email, identifier),
            eq(userCredentials.username, identifier),
            eq(userCredentials.phone, identifier),
          ),
        });

      let credential;
      try {
        credential = await findCredential();
      } catch (error) {
        // 42P01 = table does not exist, 42703 = column does not exist (missing username/phone)
        if (!hasPostgresCode(error, "42P01") && !hasPostgresCode(error, "42703")) throw error;
        await ensureUserCredentialsSchema();
        try {
          credential = await findCredential();
        } catch (retryError) {
          console.error("auth.login failed after userCredentials schema repair", retryError);
          throw retryError;
        }
      }

      if (!credential) {
        throw new Error("Thông tin đăng nhập không đúng");
      }

      const passwordOk = await verifyPassword(input.password, credential.passwordHash);
      if (!passwordOk) {
        throw new Error("Thông tin đăng nhập không đúng");
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, credential.userId),
      });

      if (!user) {
        throw new Error("Thông tin đăng nhập không đúng");
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
          ...(input.rememberMe ? { maxAge: Session.maxAgeMs / 1000 } : {}),
        })
      );

      return user;
    }),

  me: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const preferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, ctx.user.id),
    });

    return {
      ...ctx.user,
      language: preferences?.language ?? "vi",
    };
  }),
  updatePreferences: authedQuery
    .input(
      z.object({
        language: z.enum(["en", "vi"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db.query.userPreferences.findFirst({
        where: eq(userPreferences.userId, ctx.user.id),
      });

      const [preferences] = existing
        ? await db
            .update(userPreferences)
            .set({ language: input.language })
            .where(eq(userPreferences.userId, ctx.user.id))
            .returning()
        : await db
            .insert(userPreferences)
            .values({ userId: ctx.user.id, language: input.language })
            .returning();

      return {
        ...ctx.user,
        language: preferences.language,
      };
    }),
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
