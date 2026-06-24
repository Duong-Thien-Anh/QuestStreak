import { z } from "zod";
import { createRouter, authedQuery, domQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  limits,
  agreements,
  journals,
  journalEntries,
  notes,
  houseMembers,
} from "@db/schema";
import { eq, and } from "drizzle-orm";

export const notebookRouter = createRouter({
  // ─── Limits & Desires ─────────────────────────────────────────────

  "limits.list": authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.limits.findMany({
        where: eq(limits.houseId, input.houseId),
      });
    }),

  "limits.create": domQuery
    .input(
      z.object({
        houseId: z.number(),
        content: z.string().min(1),
        type: z.enum(["limit", "desire"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [item] = await db
        .insert(limits)
        .values({
          houseId: input.houseId,
          content: input.content,
          type: input.type,
          createdBy: actor?.id || 0,
        })
        .returning({ id: limits.id });

      return { id: item.id, ...input };
    }),

  "limits.delete": domQuery
    .input(z.object({ limitId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(limits).where(eq(limits.id, input.limitId));
      return { success: true };
    }),

  // ─── Agreements ────────────────────────────────────────────────────

  "agreements.list": authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.agreements.findMany({
        where: eq(agreements.houseId, input.houseId),
      });
    }),

  "agreements.create": authedQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        purpose: z.string().optional(),
        rules: z.string().optional(),
        consequences: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const actor = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [agreement] = await db
        .insert(agreements)
        .values({
          houseId: input.houseId,
          title: input.title,
          purpose: input.purpose,
          rules: input.rules,
          consequences: input.consequences,
          createdBy: actor?.id || 0,
        })
        .returning({ id: agreements.id });

      return { id: agreement.id, ...input };
    }),

  "agreements.sign": authedQuery
    .input(
      z.object({
        agreementId: z.number(),
        signAs: z.enum(["dom", "sub"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const agreement = await db.query.agreements.findFirst({
        where: eq(agreements.id, input.agreementId),
      });
      if (!agreement) throw new Error("Agreement not found");

      const updateData: Record<string, unknown> = {};
      if (input.signAs === "dom") {
        updateData.domSignature = true;
        updateData.domSignedAt = new Date();
      } else {
        updateData.subSignature = true;
        updateData.subSignedAt = new Date();
      }

      // Check if both signed
      const willBeActive =
        (input.signAs === "dom" || agreement.domSignature) &&
        (input.signAs === "sub" || agreement.subSignature);
      if (willBeActive) {
        updateData.status = "active";
      }

      await db
        .update(agreements)
        .set(updateData)
        .where(eq(agreements.id, input.agreementId));

      return { success: true, status: willBeActive ? "active" : "pending" };
    }),

  // ─── Journals ──────────────────────────────────────────────────────

  "journals.list": authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.journals.findMany({
        where: eq(journals.houseId, input.houseId),
      });
    }),

  "journals.create": authedQuery
    .input(
      z.object({
        houseId: z.number(),
        name: z.string().min(1).max(255),
        prompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [journal] = await db
        .insert(journals)
        .values({
          houseId: input.houseId,
          memberId: member?.id || 0,
          name: input.name,
          prompt: input.prompt,
        })
        .returning({ id: journals.id });

      return { id: journal.id, ...input };
    }),

  "journals.entries.list": authedQuery
    .input(z.object({ journalId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.journalEntries.findMany({
        where: eq(journalEntries.journalId, input.journalId),
      });
    }),

  "journals.entries.create": authedQuery
    .input(
      z.object({
        journalId: z.number(),
        mood: z.enum(["sad", "neutral", "happy", "excited", "loved"]),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [entry] = await db
        .insert(journalEntries)
        .values({
          journalId: input.journalId,
          memberId: member?.id || 0,
          mood: input.mood,
          content: input.content,
        })
        .returning({ id: journalEntries.id });

      return { id: entry.id, ...input };
    }),

  // ─── Notes ─────────────────────────────────────────────────────────

  "notes.list": authedQuery
    .input(z.object({ houseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });
      if (!member) return [];

      // Dom/switch sees all notes; Sub sees public notes.
      if (
        member.lifestyleRole === "dominant" ||
        member.lifestyleRole === "switch"
      ) {
        return db.query.notes.findMany({
          where: eq(notes.houseId, input.houseId),
        });
      }

      return db.query.notes.findMany({
        where: and(
          eq(notes.houseId, input.houseId),
          eq(notes.visibility, "public")
        ),
      });
    }),

  "notes.create": authedQuery
    .input(
      z.object({
        houseId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().optional(),
        visibility: z.enum(["public", "private"]).default("private"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const member = await db.query.houseMembers.findFirst({
        where: eq(houseMembers.userId, ctx.user.id),
      });

      const [note] = await db
        .insert(notes)
        .values({
          houseId: input.houseId,
          memberId: member?.id || 0,
          title: input.title,
          content: input.content,
          visibility: input.visibility,
        })
        .returning({ id: notes.id });

      return { id: note.id, ...input };
    }),

  "notes.update": authedQuery
    .input(
      z.object({
        noteId: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
        visibility: z.enum(["public", "private"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) updateData.content = input.content;
      if (input.visibility !== undefined) updateData.visibility = input.visibility;

      await db.update(notes).set(updateData).where(eq(notes.id, input.noteId));
      return { success: true };
    }),

  "notes.delete": authedQuery
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(notes).where(eq(notes.id, input.noteId));
      return { success: true };
    }),
});
