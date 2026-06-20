import { getDb } from "../api/queries/connection";
import {
  users,
  houses,
  houseMembers,
  wallets,
  habits,
  tasks,
  rewards,
  privileges,
  punishments,
  limits,
  agreements,
  journals,
  journalEntries,
  notes,
} from "./schema";

async function seed() {
  const db = getDb();

  // Check if data already exists
  const existingUsers = await db.query.users.findMany();
  if (existingUsers.length > 1) {
    console.log("Seed data already exists, skipping...");
    return;
  }

  console.log("Seeding database...");

  // Get the first user (created by auth)
  const firstUser = await db.query.users.findFirst();
  if (!firstUser) {
    console.log("No base user found. Please login first to create a user.");
    return;
  }

  const adminId = firstUser.id;

  // Create house
  const [house] = await db
    .insert(houses)
    .values({
      name: "Lunis House",
      ownerId: adminId,
    })
    .$returningId();

  console.log(`Created house: ${house.id}`);

  // Create admin member
  const [adminMember] = await db
    .insert(houseMembers)
    .values({
      houseId: house.id,
      userId: adminId,
      nickname: "Chủ Nhà",
      lifestyleRole: "dominant",
      gender: "male",
    })
    .$returningId();

  // Create sub member (placeholder user)
  const [subMember] = await db
    .insert(houseMembers)
    .values({
      houseId: house.id,
      userId: 0, // placeholder
      nickname: "Bé Sub",
      lifestyleRole: "submissive",
      gender: "female",
    })
    .$returningId();

  // Create wallets
  await db.insert(wallets).values({
    memberId: adminMember.id,
    chymBalance: 0,
    chayBalance: 0,
  });

  await db.insert(wallets).values({
    memberId: subMember.id,
    chymBalance: 100,
    chayBalance: 50,
  });

  console.log("Created wallets");

  // Create habits
  await db.insert(habits).values([
    {
      houseId: house.id,
      title: "Thức dậy đúng giờ",
      description: "Dậy trước 7h sáng mỗi ngày",
      type: "wanted",
      frequency: "daily",
      chymReward: 2,
      chayPenalty: 1,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Uống đủ nước",
      description: "Uống ít nhất 2 lít nước mỗi ngày",
      type: "wanted",
      frequency: "daily",
      chymReward: 1,
      chayPenalty: 0,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Không ăn vặt",
      description: "Không ăn đồ ngọt sau 8h tối",
      type: "unwanted",
      frequency: "daily",
      chymReward: 0,
      chayPenalty: 2,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Không chửi thề",
      description: "Giữ lễ phép trong giao tiếp",
      type: "unwanted",
      frequency: "daily",
      chymReward: 0,
      chayPenalty: 1,
      createdBy: adminMember.id,
    },
  ]);

  console.log("Created habits");

  // Create tasks
  await db.insert(tasks).values([
    {
      houseId: house.id,
      title: "Dọn dẹp phòng ngủ",
      description: "Quét dọn, thay ga giường, sắp xếp đồ đạc",
      category: "daily",
      chymReward: 3,
      chayPenalty: 2,
      status: "active",
      assignedTo: subMember.id,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Nấu cơm tối",
      description: "Chuẩn bị bữa tối cho 2 ngườii",
      category: "daily",
      chymReward: 5,
      chayPenalty: 3,
      status: "active",
      assignedTo: subMember.id,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Giặt quần áo",
      description: "Giặt và phơi quần áo trong tuần",
      category: "weekly",
      chymReward: 10,
      chayPenalty: 5,
      status: "active",
      assignedTo: subMember.id,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Viết báo cáo công việc",
      description: "Tổng hợp công việc trong tháng",
      category: "monthly",
      chymReward: 20,
      chayPenalty: 10,
      status: "active",
      assignedTo: subMember.id,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Nhiệm vụ đặc biệt: Massage",
      description: "Massage toàn thân 60 phút",
      category: "special",
      chymReward: 15,
      chayPenalty: 10,
      status: "active",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Siêu đặc biệt: Chụp ảnh concept",
      description: "Chụp bộ ảnh theo concept được chỉ định",
      category: "superSpecial",
      chymReward: 50,
      chayPenalty: 20,
      status: "active",
      createdBy: adminMember.id,
    },
  ]);

  console.log("Created tasks");

  // Create rewards
  await db.insert(rewards).values([
    {
      houseId: house.id,
      title: "Cà phê sáng",
      description: "Một ly cà phê yêu thích",
      cost: 5,
      rarity: "common",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Bữa tối ngoài",
      description: "Được ăn tối ở nhà hàng yêu thích",
      cost: 30,
      rarity: "rare",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Ngày nghỉ thoải mái",
      description: "Một ngày không phải làm task nào",
      cost: 100,
      rarity: "epic",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Quà bất ngờ",
      description: "Món quà bí mật do Chủ nhà chọn",
      cost: 50,
      rarity: "legendary",
      createdBy: adminMember.id,
    },
  ]);

  console.log("Created rewards");

  // Create privileges
  await db.insert(privileges).values([
    {
      houseId: house.id,
      title: "Được chọn bộ phim",
      description: "Chọn phim cho buổi tối cùng nhau",
      rarity: "common",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Thêm 30 phút giải trí",
      description: "Được thêm thờii gian chơi game/xem phim",
      rarity: "rare",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Một đêm không giới hạn",
      description: "Privilege đặc biệt...",
      rarity: "legendary",
      createdBy: adminMember.id,
    },
  ]);

  console.log("Created privileges");

  // Create punishments
  await db.insert(punishments).values([
    {
      houseId: house.id,
      title: "Viết 500 dòng",
      description: "Viết 'Em sẽ không tái phạm' 500 lần",
      chayCost: 6,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Cấm điện thoại 1 ngày",
      description: "Không sử dụng điện thoại trong 24h",
      chayCost: 10,
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      title: "Quỳ gối suy ngẫm",
      description: "Quỳ gối suy nghĩ về lỗi lầm",
      chayCost: 1,
      createdBy: adminMember.id,
    },
  ]);

  console.log("Created punishments");

  // Create limits
  await db.insert(limits).values([
    {
      houseId: house.id,
      content: "Không làm đau cơ thể vĩnh viễn",
      type: "limit",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      content: "Không chụp ảnh/video mặt",
      type: "limit",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      content: "Không công khai với ngườii ngoài",
      type: "limit",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      content: "Thích được ôm ấp nhẹ nhàng",
      type: "desire",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      content: "Thích được khen ngợi khi làm tốt",
      type: "desire",
      createdBy: adminMember.id,
    },
    {
      houseId: house.id,
      content: "Thích có thờii gian riêng buổi sáng",
      type: "desire",
      createdBy: adminMember.id,
    },
  ]);

  console.log("Created limits and desires");

  // Create agreement
  await db.insert(agreements).values({
    houseId: house.id,
    title: "Thỏa thuận cơ bản",
    purpose: "Thiết lập quy tắc cơ bản cho mối quan hệ",
    rules: JSON.stringify([
      { rule: "Tôn trọng giới hạn của nhau", context: "Không ép buộc vượt quá limit" },
      { rule: "Báo cáo trung thực", context: "Không nói dối về task" },
    ]),
    consequences: JSON.stringify([
      { trigger: "Vi phạm quy tắc", action: "Thêm 5 Chày" },
    ]),
    domSignature: true,
    subSignature: true,
    domSignedAt: new Date(),
    subSignedAt: new Date(),
    status: "active",
    createdBy: adminMember.id,
  });

  console.log("Created agreement");

  // Create journal
  const [journal] = await db
    .insert(journals)
    .values({
      houseId: house.id,
      memberId: subMember.id,
      name: "Nhật ký cảm xúc",
      prompt: "Hôm nay bạn cảm thấy thế nào?",
    })
    .$returningId();

  await db.insert(journalEntries).values([
    {
      journalId: journal.id,
      memberId: subMember.id,
      mood: "happy",
      content: "Hôm nay cảm thấy rất vui, hoàn thành hết task!",
    },
    {
      journalId: journal.id,
      memberId: subMember.id,
      mood: "loved",
      content: "Chủ nhà khen em nấu ăn ngon, em hạnh phúc quá!",
    },
  ]);

  console.log("Created journal with entries");

  // Create notes
  await db.insert(notes).values([
    {
      houseId: house.id,
      memberId: adminMember.id,
      title: "Ghi chú chung",
      content: "Nhà cần mua thêm gia vị",
      visibility: "public",
    },
    {
      houseId: house.id,
      memberId: adminMember.id,
      title: "Kế hoạch cuối tuần",
      content: "Dã ngoại công viên Thống Nhất",
      visibility: "public",
    },
  ]);

  console.log("Created notes");
  console.log("Seed complete!");
}

seed().catch(console.error);
