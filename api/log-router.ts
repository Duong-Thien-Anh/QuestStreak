import { z } from "zod";
import { createRouter, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { logs } from "@db/schema";
import { eq, desc } from "drizzle-orm";

export const logRouter = createRouter({
  list: domQuery
    .input(
      z.object({
        houseId: z.number(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.logs.findMany({
        where: eq(logs.houseId, input.houseId),
        orderBy: desc(logs.createdAt),
        limit: input.limit,
      });
    }),
});
