import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { renderTrpcPanel } from "@ajayche/trpc-panel";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createDevLoginHandler } from "./dev-auth";
import { createDemoAuthHandler } from "./demo-auth";
import {
  ensureGenderAvatarSchema,
  ensureTaskRewardSchema,
  ensureUserCredentialsSchema,
} from "./lib/schema-repair";

const app = new Hono<{ Bindings: HttpBindings }>();

function getPublicOrigin(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto.split(",")[0]}://${forwardedHost.split(",")[0]}`;
  }

  return new URL(req.url).origin;
}

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "lunis-house-backend",
  }),
);
app.get("/healthz", (c) => c.json({ ok: true }));

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization", "X-Platform"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
if (!env.isProduction) {
  app.get("/api/dev/login", createDevLoginHandler());
}
app.post("/api/auth/demo", createDemoAuthHandler());
app.get("/api/panel", (c) => {
  const trpcUrl = new URL("/api/trpc", getPublicOrigin(c.req.raw)).toString();
  return c.html(
    renderTrpcPanel(appRouter, {
      url: trpcUrl,
      transformer: "superjson",
    })
  );
});
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
    onError({ error, path, type }) {
      console.error("tRPC request failed", {
        path,
        type,
        code: error.code,
        message: error.message,
        cause: error.cause,
      });
    },
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");

  await ensureUserCredentialsSchema();
  await ensureTaskRewardSchema();
  await ensureGenderAvatarSchema();

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
