import { z } from "zod";
import { createRouter, authedQuery, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { houseMembers, logs, wheelSpins, wheels } from "@db/schema";
import { and, desc, eq } from "drizzle-orm";

const wheelOption = z.object({
  label: z.string().min(1).max(255),
  weight: z.number().min(1).default(1),
});

function pickWeightedOption(options: Array<z.infer<typeof wheelOption>>) {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = Math.random() * total;

  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option;
  }

  return options.at(-1) ?? options[0];
}

export const wheelRouter = createRouter({
  list: authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.wheels.findMany({
        where: and(eq(wheels.houseId, input.houseId), eq(wheels.isActive, true)),
        orderBy: desc(wheels.createdAt),
      });
    }),

  create: domQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        options: z.array(wheelOption).min(2),
        assignedTo: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [wheel] = await db
        .insert(wheels)
        .values({
          houseId: input.houseId,
          title: input.title,
          description: input.description,
          options: JSON.stringify(input.options),
          assignedTo: input.assignedTo ?? null,
          createdBy: actor?.id ?? 0,
        })
        .returning({ id: wheels.id });

      return { id: wheel.id, ...input };
    }),


  update: domQuery
    .input(
      z.object({
        wheelId: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        options: z.array(wheelOption).min(2).optional(),
        assignedTo: z.number().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.options !== undefined) updateData.options = JSON.stringify(input.options);
      if (input.assignedTo !== undefined) updateData.assignedTo = input.assignedTo;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      await db.update(wheels).set(updateData).where(eq(wheels.id, input.wheelId));
      return { success: true };
    }),

  delete: domQuery
    .input(z.object({ wheelId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(wheels).set({ isActive: false }).where(eq(wheels.id, input.wheelId));
      return { success: true };
    }),

  spin: authedQuery
    .input(z.object({ wheelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wheel = await db.query.wheels.findFirst({
        where: eq(wheels.id, input.wheelId),
      });
      if (!wheel || !wheel.isActive) throw new Error("Wheel not found");

      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (!member) throw new Error("Member not found");

      const parsed = JSON.parse(wheel.options) as Array<z.infer<typeof wheelOption>>;
      const options = z.array(wheelOption).min(2).parse(parsed);
      const result = pickWeightedOption(options);

      await db.insert(wheelSpins).values({
        wheelId: wheel.id,
        memberId: member.id,
        result: result.label,
      });

      await db.insert(logs).values({
        houseId: wheel.houseId,
        action: "WHEEL_SPUN",
        actorId: member.id,
        targetId: wheel.assignedTo,
        details: JSON.stringify({ wheelId: wheel.id, result: result.label }),
      });

      return { result: result.label };
    }),

  spins: authedQuery
    .input(z.object({ wheelId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.wheelSpins.findMany({
        where: eq(wheelSpins.wheelId, input.wheelId),
        orderBy: desc(wheelSpins.spunAt),
      });
    }),
});
