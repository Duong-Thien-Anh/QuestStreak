import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { Session } from "@contracts/constants";
import {
  habits,
  houseMembers,
  houses,
  limits,
  notes,
  privileges,
  punishments,
  rewards,
  tasks,
  users,
  wallets,
  wheels,
} from "@db/schema";
import { and, eq } from "drizzle-orm";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { getDb } from "./queries/connection";
import { signSessionToken } from "./kimi/session";

const DEV_UNION_ID = "local-user";

async function ensureDevUser() {
  const db = getDb();
  const existing = await db.query.users.findFirst({
    where: eq(users.unionId, DEV_UNION_ID),
  });

  if (existing) return existing;

  await db.insert(users).values({
    unionId: DEV_UNION_ID,
    name: "Local Admin",
    email: "local@example.test",
    role: "admin",
    lastSignInAt: new Date(),
  });

  const created = await db.query.users.findFirst({
    where: eq(users.unionId, DEV_UNION_ID),
  });
  if (!created) throw new Error("Failed to create local dev user");
  return created;
}

async function ensureDevHouse(userId: number) {
  const db = getDb();
  const existingMember = await db.query.houseMembers.findFirst({
    where: eq(houseMembers.userId, userId),
  });

  if (existingMember) {
    const house = await db.query.houses.findFirst({
      where: eq(houses.id, existingMember.houseId),
    });
    if (house) return { house, ownerMember: existingMember };
  }

  const [house] = await db
    .insert(houses)
    .values({
      name: "Lunis House",
      ownerId: userId,
    })
    .returning({ id: houses.id });

  const [ownerMember] = await db
    .insert(houseMembers)
    .values({
      houseId: house.id,
      userId,
      nickname: "Chủ Nhà",
      lifestyleRole: "dominant",
      gender: "male",
      telegramAvatar: "/avatars/admin.jpg",
    })
    .returning({ id: houseMembers.id });

  await db.insert(wallets).values({
    memberId: ownerMember.id,
    chymBalance: 0,
    chayBalance: 0,
  });

  return { house, ownerMember };
}

async function ensureSubMember(houseId: number) {
  const db = getDb();
  const existing = await db.query.houseMembers.findFirst({
    where: and(
      eq(houseMembers.houseId, houseId),
      eq(houseMembers.lifestyleRole, "submissive"),
    ),
  });

  if (existing) return existing;

  const [member] = await db
    .insert(houseMembers)
    .values({
      houseId,
      userId: 0,
      nickname: "Bé Sub",
      lifestyleRole: "submissive",
      gender: "female",
      telegramAvatar: "/avatars/sub.jpg",
    })
    .returning({ id: houseMembers.id });

  await db.insert(wallets).values({
    memberId: member.id,
    chymBalance: 100,
    chayBalance: 50,
  });

  return member;
}

async function ensureStarterData(houseId: number, ownerMemberId: number, subMemberId: number) {
  const db = getDb();
  const existingTasks = await db.query.tasks.findMany({
    where: eq(tasks.houseId, houseId),
  });

  if (existingTasks.length === 0) {
    await db.insert(tasks).values([
      {
        houseId,
        title: "Dọn dẹp phòng ngủ",
        description: "Quét dọn, thay ga giường, sắp xếp đồ đạc",
        category: "daily",
        chymReward: 3,
        chayPenalty: 2,
        status: "active",
        assignedTo: subMemberId,
        createdBy: ownerMemberId,
      },
      {
        houseId,
        title: "Giặt quần áo",
        description: "Giặt và phơi quần áo trong tuần",
        category: "weekly",
        chymReward: 10,
        chayPenalty: 5,
        status: "active",
        assignedTo: subMemberId,
        createdBy: ownerMemberId,
      },
    ]);
  }

  const existingHabits = await db.query.habits.findMany({
    where: eq(habits.houseId, houseId),
  });

  if (existingHabits.length === 0) {
    await db.insert(habits).values([
      {
        houseId,
        title: "Thức dậy đúng giờ",
        description: "Dậy trước 7h sáng mỗi ngày",
        type: "wanted",
        frequency: "daily",
        chymReward: 2,
        chayPenalty: 1,
        icon: "heart",
        createdBy: ownerMemberId,
      },
      {
        houseId,
        title: "Không ăn vặt",
        description: "Không ăn đồ ngọt sau 8h tối",
        type: "unwanted",
        frequency: "daily",
        chymReward: 0,
        chayPenalty: 2,
        icon: "ban",
        createdBy: ownerMemberId,
      },
    ]);
  }

  const existingRewards = await db.query.rewards.findMany({
    where: eq(rewards.houseId, houseId),
  });

  if (existingRewards.length === 0) {
    await db.insert(rewards).values([
      {
        houseId,
        title: "Cà phê sáng",
        description: "Một ly cà phê yêu thích",
        cost: 5,
        image: "/shop/reward_coffee.jpg",
        rarity: "common",
        createdBy: ownerMemberId,
      },
      {
        houseId,
        title: "Ngày nghỉ thoải mái",
        description: "Một ngày không phải làm task nào",
        cost: 100,
        image: "/shop/reward_gift.jpg",
        rarity: "epic",
        createdBy: ownerMemberId,
      },
    ]);
  }

  const existingPrivileges = await db.query.privileges.findMany({
    where: eq(privileges.houseId, houseId),
  });

  if (existingPrivileges.length === 0) {
    await db.insert(privileges).values([
      {
        houseId,
        title: "Được chọn bộ phim",
        description: "Chọn phim cho buổi tối cùng nhau",
        image: "/privileges/movie_ticket.jpg",
        rarity: "common",
        createdBy: ownerMemberId,
      },
      {
        houseId,
        title: "Thêm 30 phút giải trí",
        description: "Được thêm thời gian chơi game/xem phim",
        image: "/privileges/vip_pass.jpg",
        rarity: "rare",
        createdBy: ownerMemberId,
      },
    ]);
  }

  const existingPunishments = await db.query.punishments.findMany({
    where: eq(punishments.houseId, houseId),
  });

  if (existingPunishments.length === 0) {
    await db.insert(punishments).values([
      {
        houseId,
        title: "Viết 500 dòng",
        description: "Viết 'Em sẽ không tái phạm' 500 lần",
        chayCost: 6,
        image: "/punishments/hourglass.jpg",
        createdBy: ownerMemberId,
      },
      {
        houseId,
        title: "Cấm điện thoại 1 ngày",
        description: "Không sử dụng điện thoại trong 24h",
        chayCost: 10,
        image: "/punishments/hourglass.jpg",
        createdBy: ownerMemberId,
      },
    ]);
  }

  const existingLimits = await db.query.limits.findMany({
    where: eq(limits.houseId, houseId),
  });

  if (existingLimits.length === 0) {
    await db.insert(limits).values([
      {
        houseId,
        content: "Không làm đau cơ thể vĩnh viễn",
        type: "limit",
        createdBy: ownerMemberId,
      },
      {
        houseId,
        content: "Thích được khen ngợi khi làm tốt",
        type: "desire",
        createdBy: ownerMemberId,
      },
    ]);
  }

  const existingNotes = await db.query.notes.findMany({
    where: eq(notes.houseId, houseId),
  });

  if (existingNotes.length === 0) {
    await db.insert(notes).values([
      {
        houseId,
        memberId: ownerMemberId,
        title: "Ghi chú chung",
        content: "Nhà cần mua thêm gia vị",
        visibility: "public",
      },
    ]);
  }

  const existingWheels = await db.query.wheels.findMany({
    where: eq(wheels.houseId, houseId),
  });

  if (existingWheels.length === 0) {
    await db.insert(wheels).values([
      {
        houseId,
        title: "Surprise Wheel",
        description: "Random mini reward or challenge",
        options: JSON.stringify([
          { label: "Thêm 5 Chym", weight: 2 },
          { label: "Một nhiệm vụ nhẹ", weight: 2 },
          { label: "Một lời khen ngay lập tức", weight: 1 },
          { label: "Thêm 3 Chay", weight: 1 },
        ]),
        assignedTo: subMemberId,
        createdBy: ownerMemberId,
      },
    ]);
  }
}

export function createDevLoginHandler() {
  return async (c: Context) => {
    if (env.isProduction) {
      return c.json({ error: "Dev login is disabled in production" }, 404);
    }

    const user = await ensureDevUser();
    const { house, ownerMember } = await ensureDevHouse(user.id);
    const subMember = await ensureSubMember(house.id);
    await ensureStarterData(house.id, ownerMember.id, subMember.id);

    const token = await signSessionToken({
      unionId: user.unionId,
      clientId: env.appId || "local-app",
    });

    setCookie(c, Session.cookieName, token, {
      ...getSessionCookieOptions(c.req.raw.headers),
      maxAge: Session.maxAgeMs / 1000,
    });

    return c.redirect("/", 302);
  };
}
