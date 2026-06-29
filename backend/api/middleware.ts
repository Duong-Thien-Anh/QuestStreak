import { ErrorMessages } from "@contracts/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { houseMembers } from "@db/schema";
import { getDb } from "./queries/connection";
import { authenticateRequest } from "./lib/auth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

const requireAuth = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  let user = ctx.user;

  if (!user) {
    try {
      user = await authenticateRequest(ctx.req.headers, ctx.platform);
    } catch {
      user = undefined;
    }
    if (!user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: ErrorMessages.unauthenticated,
      });
    }
  }

  return next({ ctx: { ...ctx, user } });
});

function requireRole(role: string) {
  return t.middleware(async (opts) => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== role) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: ErrorMessages.insufficientRole,
      });
    }

    return next({ ctx: { ...ctx, user: ctx.user } });
  });
}

export const authedQuery = t.procedure.use(requireAuth);
export const adminQuery = authedQuery.use(requireRole("admin"));

const requireDom = t.middleware(async (opts) => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: ErrorMessages.unauthenticated,
    });
  }

  const db = getDb();
  const member = await db.query.houseMembers.findFirst({
    where: eq(houseMembers.userId, ctx.user.id),
  });

  const isRootAdmin = ctx.user.role === "admin";
  const canManageAsMember =
    member?.lifestyleRole === "dominant" || member?.lifestyleRole === "switch";

  if (!isRootAdmin && !canManageAsMember) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: ErrorMessages.insufficientRole,
    });
  }

  return next({ ctx: { ...ctx, user: ctx.user, currentMember: member } });
});

export const domQuery = authedQuery.use(requireDom);
