import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { renderTrpcPanel } from "@ajayche/trpc-panel";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { createDevLoginHandler } from "./dev-auth";
import { createDemoAuthHandler } from "./demo-auth";
import { Paths } from "@contracts/constants";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(
  "/api/*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get("/api/dev/login", createDevLoginHandler());
app.post("/api/auth/demo", createDemoAuthHandler());
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.get("/api/panel", (c) => {
  const trpcUrl = new URL("/api/trpc", c.req.url).toString();
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
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
