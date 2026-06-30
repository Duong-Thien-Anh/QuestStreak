import { createHmac } from "node:crypto";
import * as cookie from "cookie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { Session } from "@contracts/constants";
import {
  registrationRequests,
  userCredentials,
  userPreferences,
  users,
} from "@db/schema";
import { appRouter } from "../router";
import { signSessionToken } from "../kimi/session";
import type { Platform, TrpcContext } from "../context";

vi.hoisted(() => {
  process.env.APP_SECRET = "test-secret";
  process.env.APP_ID = "test-app";
  process.env.TELEGRAM_BOT_TOKEN = "telegram-test-token";
});

type UserRow = {
  id: number;
  unionId: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
  role: "user" | "admin";
  lastSignInAt: Date;
};

type CredentialRow = {
  id: number;
  userId: number;
  email: string;
  username?: string | null;
  phone?: string | null;
  passwordHash: string;
};

type RegistrationRow = {
  id: number;
  name: string;
  email: string;
  username?: string | null;
  phone?: string | null;
  lifestyleRole: "dominant" | "submissive" | "switch";
  gender: "male" | "female";
  passwordHash: string;
  status: "pending" | "approved" | "rejected";
  rejectionReason?: string | null;
  reviewedBy?: number | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type PreferenceRow = {
  userId: number;
  language: "en" | "vi";
};

const state = vi.hoisted(() => ({
  users: [] as UserRow[],
  credentials: [] as CredentialRow[],
  registrations: [] as RegistrationRow[],
  preferences: [] as PreferenceRow[],
  nextUserId: 1,
  nextCredentialId: 1,
  nextRegistrationId: 1,
}));

vi.mock("../queries/connection", () => ({
  getDb: () => mockDb,
}));

vi.mock("../lib/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  buildApprovalEmail: (name: string) => `<p>${name} approved</p>`,
  buildRejectionEmail: (name: string, reason?: string) =>
    `<p>${name} rejected ${reason ?? ""}</p>`,
}));

function createInsertBuilder(table: unknown) {
  return {
    values(value: Record<string, unknown>) {
      const insert = async () => {
        if (table === users) {
          const row = {
            id: state.nextUserId++,
            avatar: null,
            email: null,
            role: "user",
            lastSignInAt: new Date(),
            ...value,
          } as UserRow;
          state.users.push(row);
          return [row];
        }

        if (table === userCredentials) {
          const row = {
            id: state.nextCredentialId++,
            username: null,
            phone: null,
            ...value,
          } as CredentialRow;
          state.credentials.push(row);
          return [row];
        }

        if (table === registrationRequests) {
          const row = {
            id: state.nextRegistrationId++,
            username: null,
            phone: null,
            status: "pending",
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...value,
          } as RegistrationRow;
          state.registrations.push(row);
          return [row];
        }

        if (table === userPreferences) {
          const row = value as PreferenceRow;
          state.preferences.push(row);
          return [row];
        }

        return [value];
      };

      return {
        returning: insert,
        then(resolve: (value: unknown) => void, reject: (error: unknown) => void) {
          insert().then(resolve, reject);
        },
      };
    },
  };
}

function createUpdateBuilder(table: unknown) {
  return {
    set(value: Record<string, unknown>) {
      return {
        where() {
          return {
            async returning() {
              if (table === users) {
                const row = state.users[0];
                if (!row) return [];
                Object.assign(row, value);
                return [row];
              }

              if (table === registrationRequests) {
                const row = state.registrations[0];
                if (!row) return [];
                Object.assign(row, value);
                return [row];
              }

              if (table === userPreferences) {
                const row = state.preferences[0];
                if (!row) return [];
                Object.assign(row, value);
                return [row];
              }

              return [];
            },
            then(resolve: (value: unknown) => void) {
              if (table === users && state.users[0]) {
                Object.assign(state.users[0], value);
              }
              if (table === registrationRequests && state.registrations[0]) {
                Object.assign(state.registrations[0], value);
              }
              resolve(undefined);
            },
          };
        },
      };
    },
  };
}

const mockDb: any = {
  query: {
    registrationRequests: {
      findFirst: vi.fn(async () => state.registrations[0]),
      findMany: vi.fn(async () => state.registrations),
    },
    userCredentials: {
      findFirst: vi.fn(async () => state.credentials[0]),
    },
    users: {
      findFirst: vi.fn(async () => state.users[0]),
    },
    userPreferences: {
      findFirst: vi.fn(async () => state.preferences[0]),
    },
    houseMembers: {
      findFirst: vi.fn(async () => undefined),
    },
  },
  insert: vi.fn((table: unknown) => createInsertBuilder(table)),
  update: vi.fn((table: unknown) => createUpdateBuilder(table)),
  select: vi.fn(() => ({
    from: (table: unknown) => ({
      where: () => ({
        limit: async () => (table === users ? state.users.slice(0, 1) : []),
      }),
    }),
  })),
};

function resetState() {
  state.users.length = 0;
  state.credentials.length = 0;
  state.registrations.length = 0;
  state.preferences.length = 0;
  state.nextUserId = 1;
  state.nextCredentialId = 1;
  state.nextRegistrationId = 1;
  vi.clearAllMocks();
}

function makeContext(input?: {
  user?: UserRow;
  headers?: Record<string, string>;
  platform?: Platform;
}): TrpcContext {
  return {
    req: new Request("http://localhost/api/trpc", {
      headers: input?.headers,
    }),
    resHeaders: new Headers(),
    platform: input?.platform ?? "web",
    user: input?.user as TrpcContext["user"],
  };
}

function caller(input?: Parameters<typeof makeContext>[0]) {
  return appRouter.createCaller(makeContext(input));
}

async function createCredentialUser(input?: Partial<UserRow & CredentialRow>) {
  const user: UserRow = {
    id: state.nextUserId++,
    unionId: input?.unionId ?? "local:test@example.com",
    name: input?.name ?? "Test User",
    email: input?.email ?? "test@example.com",
    avatar: null,
    role: input?.role ?? "user",
    lastSignInAt: new Date(),
  };
  const passwordHash = await import("../auth-router").then((mod) =>
    mod.hashPassword(input?.passwordHash ?? "correct-password"),
  );
  const credential: CredentialRow = {
    id: state.nextCredentialId++,
    userId: user.id,
    email: input?.email ?? "test@example.com",
    username: input?.username ?? "testuser",
    phone: input?.phone ?? "0900000000",
    passwordHash,
  };
  state.users.push(user);
  state.credentials.push(credential);
  return { user, credential };
}

function createRegistration(input?: Partial<RegistrationRow>) {
  const row: RegistrationRow = {
    id: state.nextRegistrationId++,
    name: "Pending User",
    email: "pending@example.com",
    username: "pending",
    phone: "0911111111",
    lifestyleRole: "submissive",
    gender: "female",
    passwordHash: "hash",
    status: "pending",
    rejectionReason: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...input,
  };
  state.registrations.push(row);
  return row;
}

function createTelegramInitData(input?: {
  user?: Record<string, unknown>;
  botToken?: string;
  authDate?: number;
}) {
  const params = new URLSearchParams({
    auth_date: String(input?.authDate ?? Math.floor(Date.now() / 1000)),
    query_id: "test-query",
    user: JSON.stringify(
      input?.user ?? {
        id: 123456,
        first_name: "Telegram",
        username: "tg_user",
      },
    ),
  });
  const checkString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(input?.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? "")
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("auth flow", () => {
  beforeEach(resetState);

  describe("auth.register", () => {
    it("creates a pending registration request", async () => {
      const result = await caller().auth.register({
        name: "New User",
        email: "New@Example.com",
        username: "newuser",
        phone: "0999999999",
        password: "password123",
        lifestyleRole: "switch",
        gender: "female",
      });

      expect(result.status).toBe("pending");
      expect(state.registrations[0]).toMatchObject({
        name: "New User",
        email: "new@example.com",
        username: "newuser",
        phone: "0999999999",
        lifestyleRole: "switch",
      });
      expect(state.registrations[0].passwordHash).toMatch(/^scrypt\$/);
    });

    it("rejects duplicate email from registration requests", async () => {
      createRegistration({ email: "new@example.com", status: "pending" });

      await expect(
        caller().auth.register({
          name: "New User",
          email: "new@example.com",
          password: "password123",
        }),
      ).rejects.toThrow("Yêu cầu đăng ký đang chờ duyệt");
    });

    it("rejects duplicate username through an existing credential", async () => {
      await createCredentialUser({ username: "taken" });
      mockDb.query.userCredentials.findFirst
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(state.credentials[0]!);

      await expect(
        caller().auth.register({
          name: "New User",
          email: "other@example.com",
          username: "taken",
          password: "password123",
        }),
      ).rejects.toThrow("Tên đăng nhập đã được đăng ký");
    });
  });

  describe("auth.login", () => {
    it("logs in by email", async () => {
      await createCredentialUser({ email: "test@example.com" });

      const ctx = makeContext();
      const result = await appRouter.createCaller(ctx).auth.login({
        identifier: "test@example.com",
        password: "correct-password",
      });

      expect(result.unionId).toBe("local:test@example.com");
      expect(ctx.resHeaders.get("set-cookie")).toContain(Session.cookieName);
    });

    it("logs in by username", async () => {
      await createCredentialUser({ username: "testuser" });

      const result = await caller().auth.login({
        identifier: "testuser",
        password: "correct-password",
      });

      expect(result.name).toBe("Test User");
    });

    it("logs in by phone", async () => {
      await createCredentialUser({ phone: "0900000000" });

      const result = await caller().auth.login({
        identifier: "0900000000",
        password: "correct-password",
      });

      expect(result.name).toBe("Test User");
    });

    it("rejects wrong password", async () => {
      await createCredentialUser();

      await expect(
        caller().auth.login({
          identifier: "test@example.com",
          password: "wrong-password",
        }),
      ).rejects.toThrow("Thông tin đăng nhập không đúng");
    });
  });

  describe("auth.telegramLogin", () => {
    it("accepts valid initData and returns a bearer token", async () => {
      const result = await caller().auth.telegramLogin({
        initData: createTelegramInitData(),
      });

      expect(result.token).toEqual(expect.any(String));
      expect(result.user).toMatchObject({
        unionId: "telegram:123456",
        name: "Telegram",
      });
      expect(state.users[0].unionId).toBe("telegram:123456");
    });

    it("rejects invalid initData", async () => {
      const initData = createTelegramInitData();

      await expect(
        caller().auth.telegramLogin({
          initData: initData.replace(/hash=[^&]+/, "hash=bad"),
        }),
      ).rejects.toThrow("Invalid Telegram initData signature");
    });

    it("rejects expired initData", async () => {
      const initData = createTelegramInitData({
        authDate: Math.floor(Date.now() / 1000) - 7200,
      });

      await expect(
        caller().auth.telegramLogin({ initData }),
      ).rejects.toThrow("Telegram initData expired");
    });
  });

  describe("admin registration procedures", () => {
    const adminUser: UserRow = {
      id: 99,
      unionId: "local:admin@example.com",
      name: "Admin",
      email: "admin@example.com",
      avatar: null,
      role: "admin",
      lastSignInAt: new Date(),
    };

    it("approves a pending registration", async () => {
      createRegistration();

      const result = await caller({ user: adminUser }).admin.approveRegistration({
        id: 1,
      });

      expect(result.success).toBe(true);
      expect(state.users[0]).toMatchObject({
        unionId: "local:pending@example.com",
        email: "pending@example.com",
      });
      expect(state.credentials[0]).toMatchObject({
        email: "pending@example.com",
        username: "pending",
      });
      expect(state.registrations[0].status).toBe("approved");
    });

    it("rejects an already approved request", async () => {
      createRegistration({ status: "approved" });

      await expect(
        caller({ user: adminUser }).admin.approveRegistration({ id: 1 }),
      ).rejects.toThrow("Yêu cầu này đã được xử lý");
    });

    it("rejects approval when credential email already exists", async () => {
      createRegistration();
      state.credentials.push({
        id: state.nextCredentialId++,
        userId: 500,
        email: "pending@example.com",
        username: null,
        phone: null,
        passwordHash: "hash",
      });

      await expect(
        caller({ user: adminUser }).admin.approveRegistration({ id: 1 }),
      ).rejects.toThrow("Email đã tồn tại trong hệ thống");
    });

    it("rejects a pending registration with a reason", async () => {
      createRegistration();

      const result = await caller({ user: adminUser }).admin.rejectRegistration({
        id: 1,
        reason: "Not enough context",
      });

      expect(result.success).toBe(true);
      expect(state.registrations[0]).toMatchObject({
        status: "rejected",
        rejectionReason: "Not enough context",
        reviewedBy: adminUser.id,
      });
    });

    it("rejects an already rejected request", async () => {
      createRegistration({ status: "rejected" });

      await expect(
        caller({ user: adminUser }).admin.rejectRegistration({ id: 1 }),
      ).rejects.toThrow("Yêu cầu này đã được xử lý");
    });
  });

  describe("auth middleware", () => {
    it("accepts a valid cookie session", async () => {
      const { user } = await createCredentialUser();
      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: "test-app",
      });

      const result = await caller({
        headers: {
          cookie: cookie.serialize(Session.cookieName, token),
        },
      }).auth.me();

      expect(result.id).toBe(user.id);
    });

    it("accepts a valid JWT bearer token for Telegram", async () => {
      const user: UserRow = {
        id: state.nextUserId++,
        unionId: "telegram:123",
        name: "Telegram User",
        email: null,
        avatar: null,
        role: "user",
        lastSignInAt: new Date(),
      };
      state.users.push(user);
      const token = await signSessionToken({
        unionId: user.unionId,
        clientId: "telegram-mini-app",
      });

      const result = await caller({
        platform: "telegram",
        headers: {
          authorization: `Bearer ${token}`,
        },
      }).auth.me();

      expect(result.id).toBe(user.id);
    });

    it("rejects missing auth", async () => {
      await expect(caller().auth.me()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    });
  });

  describe("admin middleware", () => {
    it("allows admin role", async () => {
      createRegistration();

      const result = await caller({
        user: {
          id: 1,
          unionId: "local:admin@example.com",
          name: "Admin",
          email: "admin@example.com",
          avatar: null,
          role: "admin",
          lastSignInAt: new Date(),
        },
      }).admin.listRegistrations({ status: "pending" });

      expect(result).toHaveLength(1);
    });

    it("rejects user role", async () => {
      await expect(
        caller({
          user: {
            id: 1,
            unionId: "local:user@example.com",
            name: "User",
            email: "user@example.com",
            avatar: null,
            role: "user",
            lastSignInAt: new Date(),
          },
        }).admin.listRegistrations({ status: "pending" }),
      ).rejects.toBeInstanceOf(TRPCError);

      await expect(
        caller({
          user: {
            id: 1,
            unionId: "local:user@example.com",
            name: "User",
            email: "user@example.com",
            avatar: null,
            role: "user",
            lastSignInAt: new Date(),
          },
        }).admin.listRegistrations({ status: "pending" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
});
