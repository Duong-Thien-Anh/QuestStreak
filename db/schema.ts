import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  bigint,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── Users (managed by auth system) ────────────────────────────────

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Houses ────────────────────────────────────────────────────────

export const houses = mysqlTable("houses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).default("Lunis House").notNull(),
  ownerId: bigint("ownerId", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type House = typeof houses.$inferSelect;

// ─── House Members ─────────────────────────────────────────────────

export const houseMembers = mysqlTable("houseMembers", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  nickname: varchar("nickname", { length: 255 }),
  lifestyleRole: mysqlEnum("lifestyleRole", ["dominant", "submissive", "switch"])
    .default("submissive")
    .notNull(),
  gender: mysqlEnum("gender", ["male", "female", "other"])
    .default("other")
    .notNull(),
  telegramAvatar: text("telegramAvatar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type HouseMember = typeof houseMembers.$inferSelect;

// ─── Wallets ───────────────────────────────────────────────────────

export const wallets = mysqlTable("wallets", {
  id: serial("id").primaryKey(),
  memberId: bigint("memberId", { mode: "number", unsigned: true })
    .notNull()
    .unique(),
  chymBalance: int("chymBalance").default(0).notNull(),
  chayBalance: int("chayBalance").default(0).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Wallet = typeof wallets.$inferSelect;

// ─── Habits ────────────────────────────────────────────────────────

export const habits = mysqlTable("habits", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: mysqlEnum("type", ["wanted", "unwanted"]).default("wanted").notNull(),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly"])
    .default("daily")
    .notNull(),
  daysOfWeek: text("daysOfWeek"),
  chymReward: int("chymReward").default(0).notNull(),
  chayPenalty: int("chayPenalty").default(0).notNull(),
  icon: varchar("icon", { length: 50 }).default("heart"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Habit = typeof habits.$inferSelect;

// ─── Habit Checkins ────────────────────────────────────────────────

export const habitCheckins = mysqlTable("habitCheckins", {
  id: serial("id").primaryKey(),
  habitId: bigint("habitId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  checkedAt: timestamp("checkedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["done", "missed"]).default("done").notNull(),
});

export type HabitCheckin = typeof habitCheckins.$inferSelect;

// ─── Tasks ─────────────────────────────────────────────────────────

export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "daily",
    "weekly",
    "monthly",
    "special",
    "superSpecial",
  ])
    .default("daily")
    .notNull(),
  chymReward: int("chymReward").default(0).notNull(),
  chayPenalty: int("chayPenalty").default(0).notNull(),
  assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }),
  status: mysqlEnum("status", [
    "pending",
    "active",
    "submitted",
    "completed",
    "failed",
  ])
    .default("pending")
    .notNull(),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  linkedRewardId: bigint("linkedRewardId", {
    mode: "number",
    unsigned: true,
  }),
  linkedPunishmentId: bigint("linkedPunishmentId", {
    mode: "number",
    unsigned: true,
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;

// ─── Rewards ───────────────────────────────────────────────────────

export const rewards = mysqlTable("rewards", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  cost: int("cost").default(0).notNull(),
  image: text("image"),
  rarity: mysqlEnum("rarity", ["common", "rare", "epic", "legendary"])
    .default("common")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Reward = typeof rewards.$inferSelect;

// ─── Reward Purchases ──────────────────────────────────────────────

export const rewardPurchases = mysqlTable("rewardPurchases", {
  id: serial("id").primaryKey(),
  rewardId: bigint("rewardId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
  giftedBy: bigint("giftedBy", { mode: "number", unsigned: true }),
  status: mysqlEnum("status", ["active", "used", "expired"])
    .default("active")
    .notNull(),
});

export type RewardPurchase = typeof rewardPurchases.$inferSelect;

// ─── Privileges ────────────────────────────────────────────────────

export const privileges = mysqlTable("privileges", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  image: text("image"),
  rarity: mysqlEnum("rarity", ["common", "rare", "epic", "legendary"])
    .default("common")
    .notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Privilege = typeof privileges.$inferSelect;

// ─── Privilege Assignments ─────────────────────────────────────────

export const privilegeAssignments = mysqlTable("privilegeAssignments", {
  id: serial("id").primaryKey(),
  privilegeId: bigint("privilegeId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  assignedBy: bigint("assignedBy", { mode: "number", unsigned: true }).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["active", "used", "expired"])
    .default("active")
    .notNull(),
});

export type PrivilegeAssignment = typeof privilegeAssignments.$inferSelect;

// ─── Punishments ───────────────────────────────────────────────────

export const punishments = mysqlTable("punishments", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  chayCost: int("chayCost").default(0).notNull(),
  image: text("image"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Punishment = typeof punishments.$inferSelect;

// ─── Punishment Assignments ────────────────────────────────────────

export const punishmentAssignments = mysqlTable("punishmentAssignments", {
  id: serial("id").primaryKey(),
  punishmentId: bigint("punishmentId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  assignedBy: bigint("assignedBy", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["active", "redeemed", "forgiven"])
    .default("active")
    .notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  redeemedAt: timestamp("redeemedAt"),
  checklist: text("checklist"),
});

export type PunishmentAssignment = typeof punishmentAssignments.$inferSelect;

// ─── Limits ────────────────────────────────────────────────────────

export const limits = mysqlTable("limits", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["limit", "desire"]).default("limit").notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Limit = typeof limits.$inferSelect;

// ─── Agreements ────────────────────────────────────────────────────

export const agreements = mysqlTable("agreements", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  purpose: text("purpose"),
  rules: text("rules"),
  consequences: text("consequences"),
  domSignature: boolean("domSignature").default(false).notNull(),
  subSignature: boolean("subSignature").default(false).notNull(),
  domSignedAt: timestamp("domSignedAt"),
  subSignedAt: timestamp("subSignedAt"),
  status: mysqlEnum("status", ["pending", "active", "void"])
    .default("pending")
    .notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Agreement = typeof agreements.$inferSelect;

// ─── Journals ──────────────────────────────────────────────────────

export const journals = mysqlTable("journals", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  prompt: text("prompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Journal = typeof journals.$inferSelect;

// ─── Journal Entries ───────────────────────────────────────────────

export const journalEntries = mysqlTable("journalEntries", {
  id: serial("id").primaryKey(),
  journalId: bigint("journalId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  mood: mysqlEnum("mood", ["sad", "neutral", "happy", "excited", "loved"])
    .default("neutral")
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;

// ─── Notes ─────────────────────────────────────────────────────────

export const notes = mysqlTable("notes", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  memberId: bigint("memberId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  visibility: mysqlEnum("visibility", ["public", "private"])
    .default("private")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Note = typeof notes.$inferSelect;

// ─── Logs ──────────────────────────────────────────────────────────

export const logs = mysqlTable("logs", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  actorId: bigint("actorId", { mode: "number", unsigned: true }).notNull(),
  targetId: bigint("targetId", { mode: "number", unsigned: true }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Log = typeof logs.$inferSelect;
