import {
  pgTable,
  pgEnum,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const registrationStatusEnum = pgEnum("registrationStatus", ["pending", "approved", "rejected"]);
export const lifestyleRoleEnum = pgEnum("lifestyleRole", ["dominant", "submissive", "switch"]);
export const genderEnum = pgEnum("gender", ["male", "female", "other"]);
export const languageEnum = pgEnum("language", ["en", "vi"]);
export const taskCategoryEnum = pgEnum("taskCategory", ["daily", "weekly", "monthly", "special", "superSpecial"]);
export const taskStatusEnum = pgEnum("taskStatus", ["pending", "active", "submitted", "completed", "failed"]);
export const taskSubmissionStatusEnum = pgEnum("taskSubmissionStatus", [
  "submitted",
  "approved",
  "rejected",
]);
export const rarityEnum = pgEnum("rarity", ["common", "rare", "epic", "legendary"]);
export const purchaseStatusEnum = pgEnum("purchaseStatus", ["active", "used", "expired"]);
export const assignmentStatusEnum = pgEnum("assignmentStatus", ["active", "redeemed", "forgiven"]);
export const privilegeStatusEnum = pgEnum("privilegeStatus", ["active", "used", "expired"]);
export const limitTypeEnum = pgEnum("limitType", ["limit", "desire"]);
export const agreementStatusEnum = pgEnum("agreementStatus", ["pending", "active", "void"]);
export const moodEnum = pgEnum("mood", ["sad", "neutral", "happy", "excited", "loved"]);
export const visibilityEnum = pgEnum("visibility", ["public", "private"]);
export const inviteStatusEnum = pgEnum("inviteStatus", ["active", "accepted", "revoked", "expired"]);
export const joinRequestStatusEnum = pgEnum("joinRequestStatus", [
  "pending",
  "approved",
  "rejected",
]);
export const streakSourceEnum = pgEnum("streakSource", ["task"]);
export const notificationTypeEnum = pgEnum("notificationType", [
  "task_created",
  "task_assigned",
  "task_submitted",
  "task_completed",
  "task_rejected",
  "achievement_unlocked",
  "reward_gifted",
  "wallet_updated",
  "system",
]);
export const achievementCriteriaEnum = pgEnum("achievementCriteria", [
  "total_completions",
  "current_streak",
  "xp",
  "level",
]);

// ─── Users (managed by auth system) ────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userPreferences = pgTable(
  "userPreferences",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" }).notNull(),
    language: languageEnum("language").default("vi").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("user_preferences_user_idx").on(table.userId)],
);

export type UserPreference = typeof userPreferences.$inferSelect;

// ─── User Login Credentials ──────────────────────────────────────

export const userCredentials = pgTable(
  "userCredentials",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number" }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 100 }),
    phone: varchar("phone", { length: 30 }),
    passwordHash: text("passwordHash").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("user_credentials_user_idx").on(table.userId),
    uniqueIndex("user_credentials_email_idx").on(table.email),
  ]
);

export type UserCredential = typeof userCredentials.$inferSelect;

// ─── Registration Requests ────────────────────────────────────────

export const registrationRequests = pgTable(
  "registrationRequests",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 100 }),
    phone: varchar("phone", { length: 30 }),
    lifestyleRole: lifestyleRoleEnum("lifestyleRole").default("submissive").notNull(),
    gender: genderEnum("gender").default("female").notNull(),
    passwordHash: text("passwordHash").notNull(),
    status: registrationStatusEnum("status").default("pending").notNull(),
    rejectionReason: text("rejectionReason"),
    reviewedBy: bigint("reviewedBy", { mode: "number" }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("reg_requests_email_idx").on(table.email),
    index("reg_requests_status_idx").on(table.status),
  ]
);

export type RegistrationRequest = typeof registrationRequests.$inferSelect;

// ─── Houses ────────────────────────────────────────────────────────

export const houses = pgTable("houses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).default("Lunis House").notNull(),
  ownerId: bigint("ownerId", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type House = typeof houses.$inferSelect;

export const roomCodes = pgTable(
  "roomCodes",
  {
    id: serial("id").primaryKey(),
    houseId: bigint("houseId", { mode: "number" }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    approvalRequired: boolean("approvalRequired").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("room_codes_house_idx").on(table.houseId),
    uniqueIndex("room_codes_code_idx").on(table.code),
  ],
);

export type RoomCode = typeof roomCodes.$inferSelect;

export const roomJoinRequests = pgTable(
  "roomJoinRequests",
  {
    id: serial("id").primaryKey(),
    houseId: bigint("houseId", { mode: "number" }).notNull(),
    userId: bigint("userId", { mode: "number" }).notNull(),
    nickname: varchar("nickname", { length: 255 }),
    gender: genderEnum("gender").default("female").notNull(),
    status: joinRequestStatusEnum("status").default("pending").notNull(),
    reviewedBy: bigint("reviewedBy", { mode: "number" }),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("room_join_requests_house_user_idx").on(table.houseId, table.userId),
    index("room_join_requests_house_status_idx").on(table.houseId, table.status),
  ],
);

export type RoomJoinRequest = typeof roomJoinRequests.$inferSelect;

// ─── House Members ─────────────────────────────────────────────────

export const houseMembers = pgTable("houseMembers", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  nickname: varchar("nickname", { length: 255 }),
  lifestyleRole: lifestyleRoleEnum("lifestyleRole").default("submissive").notNull(),
  gender: genderEnum("gender").default("female").notNull(),
  telegramAvatar: text("telegramAvatar"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type HouseMember = typeof houseMembers.$inferSelect;

// ─── House Invites ────────────────────────────────────────────────

export const houseInvites = pgTable(
  "houseInvites",
  {
    id: serial("id").primaryKey(),
    houseId: bigint("houseId", { mode: "number" }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    invitedBy: bigint("invitedBy", { mode: "number" }).notNull(),
    intendedNickname: varchar("intendedNickname", { length: 255 }),
    lifestyleRole: lifestyleRoleEnum("lifestyleRole").default("submissive").notNull(),
    gender: genderEnum("gender").default("female").notNull(),
    status: inviteStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expiresAt"),
    acceptedBy: bigint("acceptedBy", { mode: "number" }),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("house_invites_code_idx").on(table.code),
    index("house_invites_house_status_idx").on(table.houseId, table.status),
  ]
);

export type HouseInvite = typeof houseInvites.$inferSelect;

// ─── Wallets ───────────────────────────────────────────────────────

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  memberId: bigint("memberId", { mode: "number" }).notNull().unique(),
  chymBalance: integer("chymBalance").default(0).notNull(),
  chayBalance: integer("chayBalance").default(0).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Wallet = typeof wallets.$inferSelect;

// ─── Member Progress ──────────────────────────────────────────────

export const memberProgress = pgTable("memberProgress", {
  id: serial("id").primaryKey(),
  memberId: bigint("memberId", { mode: "number" }).notNull().unique(),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type MemberProgress = typeof memberProgress.$inferSelect;

// ─── Streaks ───────────────────────────────────────────────────────

export const streaks = pgTable(
  "streaks",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("memberId", { mode: "number" }).notNull(),
    sourceType: streakSourceEnum("sourceType").notNull(),
    sourceId: bigint("sourceId", { mode: "number" }).notNull(),
    currentStreak: integer("currentStreak").default(0).notNull(),
    longestStreak: integer("longestStreak").default(0).notNull(),
    lastCompletedAt: timestamp("lastCompletedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("streaks_member_source_idx").on(table.memberId, table.sourceType, table.sourceId),
  ]
);

export type Streak = typeof streaks.$inferSelect;

// ─── Achievements ─────────────────────────────────────────────────

export const achievements = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 100 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }).default("trophy").notNull(),
    xpReward: integer("xpReward").default(0).notNull(),
    criteriaType: achievementCriteriaEnum("criteriaType").notNull(),
    criteriaValue: integer("criteriaValue").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("achievements_key_idx").on(table.key)]
);

export type Achievement = typeof achievements.$inferSelect;

// ─── Member Achievements ──────────────────────────────────────────

export const memberAchievements = pgTable(
  "memberAchievements",
  {
    id: serial("id").primaryKey(),
    memberId: bigint("memberId", { mode: "number" }).notNull(),
    achievementId: bigint("achievementId", { mode: "number" }).notNull(),
    unlockedAt: timestamp("unlockedAt").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("member_achievements_member_achievement_idx").on(table.memberId, table.achievementId),
  ]
);

export type MemberAchievement = typeof memberAchievements.$inferSelect;

// ─── Tasks ─────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: taskCategoryEnum("category").default("daily").notNull(),
  chymReward: integer("chymReward").default(0).notNull(),
  chayPenalty: integer("chayPenalty").default(0).notNull(),
  bonusXp: integer("bonusXp").default(0).notNull(),
  assignedTo: bigint("assignedTo", { mode: "number" }),
  status: taskStatusEnum("status").default("pending").notNull(),
  startDate: timestamp("startDate"),
  recurringDays: text("recurringDays"),
  dueDate: timestamp("dueDate"),
  completedAt: timestamp("completedAt"),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  linkedRewardId: bigint("linkedRewardId", { mode: "number" }),
  linkedAchievementId: bigint("linkedAchievementId", { mode: "number" }),
  linkedPunishmentId: bigint("linkedPunishmentId", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Task = typeof tasks.$inferSelect;

// ─── Task Submissions ─────────────────────────────────────────────

export const taskSubmissions = pgTable(
  "taskSubmissions",
  {
    id: serial("id").primaryKey(),
    taskId: bigint("taskId", { mode: "number" }).notNull(),
    memberId: bigint("memberId", { mode: "number" }).notNull(),
    note: text("note"),
    proofUrl: text("proofUrl"),
    proofType: varchar("proofType", { length: 50 }),
    status: taskSubmissionStatusEnum("status").default("submitted").notNull(),
    reviewedBy: bigint("reviewedBy", { mode: "number" }),
    reviewedAt: timestamp("reviewedAt"),
    reviewNote: text("reviewNote"),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  },
  (table) => [
    index("task_submissions_task_submitted_idx").on(table.taskId, table.submittedAt),
    index("task_submissions_member_status_idx").on(table.memberId, table.status),
  ]
);

export type TaskSubmission = typeof taskSubmissions.$inferSelect;

// ─── Rewards ───────────────────────────────────────────────────────

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  cost: integer("cost").default(0).notNull(),
  image: text("image"),
  rarity: rarityEnum("rarity").default("common").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Reward = typeof rewards.$inferSelect;

// ─── Reward Purchases ──────────────────────────────────────────────

export const rewardPurchases = pgTable("rewardPurchases", {
  id: serial("id").primaryKey(),
  rewardId: bigint("rewardId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  purchasedAt: timestamp("purchasedAt").defaultNow().notNull(),
  giftedBy: bigint("giftedBy", { mode: "number" }),
  status: purchaseStatusEnum("status").default("active").notNull(),
});

export type RewardPurchase = typeof rewardPurchases.$inferSelect;

// ─── Reward Gift Details ──────────────────────────────────────────

export const rewardGiftDetails = pgTable(
  "rewardGiftDetails",
  {
    id: serial("id").primaryKey(),
    purchaseId: bigint("purchaseId", { mode: "number" }).notNull(),
    giftMessage: text("giftMessage"),
    giftReason: text("giftReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("reward_gift_details_purchase_idx").on(table.purchaseId)]
);

export type RewardGiftDetail = typeof rewardGiftDetails.$inferSelect;

// ─── Privileges ────────────────────────────────────────────────────

export const privileges = pgTable("privileges", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  image: text("image"),
  rarity: rarityEnum("rarity").default("common").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Privilege = typeof privileges.$inferSelect;

// ─── Privilege Assignments ─────────────────────────────────────────

export const privilegeAssignments = pgTable("privilegeAssignments", {
  id: serial("id").primaryKey(),
  privilegeId: bigint("privilegeId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  assignedBy: bigint("assignedBy", { mode: "number" }).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  status: privilegeStatusEnum("status").default("active").notNull(),
});

export type PrivilegeAssignment = typeof privilegeAssignments.$inferSelect;

// ─── Punishments ───────────────────────────────────────────────────

export const punishments = pgTable("punishments", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  chayCost: integer("chayCost").default(0).notNull(),
  image: text("image"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Punishment = typeof punishments.$inferSelect;

// ─── Punishment Assignments ────────────────────────────────────────

export const punishmentAssignments = pgTable("punishmentAssignments", {
  id: serial("id").primaryKey(),
  punishmentId: bigint("punishmentId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  assignedBy: bigint("assignedBy", { mode: "number" }).notNull(),
  status: assignmentStatusEnum("status").default("active").notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  redeemedAt: timestamp("redeemedAt"),
  checklist: text("checklist"),
});

export type PunishmentAssignment = typeof punishmentAssignments.$inferSelect;

// ─── Limits ────────────────────────────────────────────────────────

export const limits = pgTable("limits", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  content: text("content").notNull(),
  type: limitTypeEnum("type").default("limit").notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Limit = typeof limits.$inferSelect;

// ─── Agreements ────────────────────────────────────────────────────

export const agreements = pgTable("agreements", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  purpose: text("purpose"),
  rules: text("rules"),
  consequences: text("consequences"),
  domSignature: boolean("domSignature").default(false).notNull(),
  subSignature: boolean("subSignature").default(false).notNull(),
  domSignedAt: timestamp("domSignedAt"),
  subSignedAt: timestamp("subSignedAt"),
  status: agreementStatusEnum("status").default("pending").notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Agreement = typeof agreements.$inferSelect;

// ─── Journals ──────────────────────────────────────────────────────

export const journals = pgTable("journals", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  prompt: text("prompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Journal = typeof journals.$inferSelect;

// ─── Journal Entries ───────────────────────────────────────────────

export const journalEntries = pgTable("journalEntries", {
  id: serial("id").primaryKey(),
  journalId: bigint("journalId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  mood: moodEnum("mood").default("neutral").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type JournalEntry = typeof journalEntries.$inferSelect;

// ─── Notes ─────────────────────────────────────────────────────────

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content"),
  visibility: visibilityEnum("visibility").default("private").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Note = typeof notes.$inferSelect;

// ─── Notifications ────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    houseId: bigint("houseId", { mode: "number" }).notNull(),
    recipientId: bigint("recipientId", { mode: "number" }),
    actorId: bigint("actorId", { mode: "number" }),
    type: notificationTypeEnum("type").default("system").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    entityType: varchar("entityType", { length: 50 }),
    entityId: bigint("entityId", { mode: "number" }),
    metadata: text("metadata"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("notifications_house_created_idx").on(table.houseId, table.createdAt),
    index("notifications_recipient_read_idx").on(table.recipientId, table.readAt),
  ]
);

export type Notification = typeof notifications.$inferSelect;

// ─── Logs ──────────────────────────────────────────────────────────

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  actorId: bigint("actorId", { mode: "number" }).notNull(),
  targetId: bigint("targetId", { mode: "number" }),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Log = typeof logs.$inferSelect;

// ─── Wheels ────────────────────────────────────────────────────────

export const wheels = pgTable("wheels", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  options: text("options").notNull(),            // JSON array of { label, weight }
  assignedTo: bigint("assignedTo", { mode: "number" }),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: bigint("createdBy", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Wheel = typeof wheels.$inferSelect;

// ─── Wheel Spins ───────────────────────────────────────────────────

export const wheelSpins = pgTable("wheelSpins", {
  id: serial("id").primaryKey(),
  wheelId: bigint("wheelId", { mode: "number" }).notNull(),
  memberId: bigint("memberId", { mode: "number" }).notNull(),
  result: varchar("result", { length: 255 }).notNull(),
  spunAt: timestamp("spunAt").defaultNow().notNull(),
});

export type WheelSpin = typeof wheelSpins.$inferSelect;
