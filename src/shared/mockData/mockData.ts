// Mock data for Lunis House demo

export const mockHouse = {
  id: 1,
  name: "Lunis House",
  ownerId: 1,
};

export const mockMembers = [
  {
    id: 1,
    houseId: 1,
    userId: 1,
    nickname: "Chủ Nhà",
    lifestyleRole: "dominant" as const,
    gender: "male" as const,
    telegramAvatar: "/avatars/admin.jpg",
    wallet: { chymBalance: 0, chayBalance: 0 },
  },
  {
    id: 2,
    houseId: 1,
    userId: 2,
    nickname: "Bé Sub",
    lifestyleRole: "submissive" as const,
    gender: "female" as const,
    telegramAvatar: "/avatars/sub.jpg",
    wallet: { chymBalance: 100, chayBalance: 50 },
  },
];

export const mockTasks = [
  {
    id: 1,
    houseId: 1,
    title: "Dọn dẹp phòng ngủ",
    description: "Quét dọn, thay ga giường, sắp xếp đồ đạc",
    category: "daily" as const,
    chymReward: 3,
    chayPenalty: 2,
    status: "active" as const,
    assignedTo: 2,
  },
  {
    id: 2,
    houseId: 1,
    title: "Nấu cơm tối",
    description: "Chuẩn bị bữa tối cho 2 ngườii",
    category: "daily" as const,
    chymReward: 5,
    chayPenalty: 3,
    status: "active" as const,
    assignedTo: 2,
  },
  {
    id: 3,
    houseId: 1,
    title: "Giặt quần áo",
    description: "Giặt và phơi quần áo trong tuần",
    category: "weekly" as const,
    chymReward: 10,
    chayPenalty: 5,
    status: "active" as const,
    assignedTo: 2,
  },
  {
    id: 4,
    houseId: 1,
    title: "Viết báo cáo công việc",
    description: "Tổng hợp công việc trong tháng",
    category: "monthly" as const,
    chymReward: 20,
    chayPenalty: 10,
    status: "active" as const,
    assignedTo: 2,
  },
  {
    id: 5,
    houseId: 1,
    title: "Nhiệm vụ đặc biệt: Massage",
    description: "Massage toàn thân 60 phút",
    category: "special" as const,
    chymReward: 15,
    chayPenalty: 10,
    status: "active" as const,
    assignedTo: null,
  },
  {
    id: 6,
    houseId: 1,
    title: "Siêu đặc biệt: Chụp ảnh concept",
    description: "Chụp bộ ảnh theo concept được chỉ định",
    category: "superSpecial" as const,
    chymReward: 50,
    chayPenalty: 20,
    status: "active" as const,
    assignedTo: null,
  },
  {
    id: 7,
    houseId: 1,
    title: "Hoàn thành: Rửa bát",
    description: "Đã hoàn thành rửa bát hôm qua",
    category: "daily" as const,
    chymReward: 3,
    chayPenalty: 0,
    status: "completed" as const,
    assignedTo: 2,
  },
];

export const mockRewards = [
  { id: 1, houseId: 1, title: "Cà phê sáng", description: "Một ly cà phê yêu thích", cost: 5, image: "/shop/reward_coffee.jpg", rarity: "common" as const, isActive: true },
  { id: 2, houseId: 1, title: "Bữa tối ngoài", description: "Được ăn tối ở nhà hàng yêu thích", cost: 30, image: "/shop/reward_star.jpg", rarity: "rare" as const, isActive: true },
  { id: 3, houseId: 1, title: "Ngày nghỉ thoải mái", description: "Một ngày không phải làm task nào", cost: 100, image: "/shop/reward_gift.jpg", rarity: "epic" as const, isActive: true },
  { id: 4, houseId: 1, title: "Quà bất ngờ", description: "Món quà bí mật do Chủ nhà chọn", cost: 50, image: "/shop/reward_star.jpg", rarity: "legendary" as const, isActive: true },
];

export const mockPrivileges = [
  { id: 1, houseId: 1, title: "Được chọn bộ phim", description: "Chọn phim cho buổi tối cùng nhau", image: "/privileges/movie_ticket.jpg", rarity: "common" as const, isActive: true },
  { id: 2, houseId: 1, title: "Thêm 30 phút giải trí", description: "Được thêm thờii gian chơi game/xem phim", image: "/privileges/vip_pass.jpg", rarity: "rare" as const, isActive: true },
  { id: 3, houseId: 1, title: "Một đêm không giới hạn", description: "Privilege đặc biệt...", image: "/privileges/vip_pass.jpg", rarity: "legendary" as const, isActive: true },
];

export const mockPunishments = [
  { id: 1, houseId: 1, title: "Viết 500 dòng", description: "Viết 'Em sẽ không tái phạm' 500 lần", chayCost: 6, image: "/punishments/hourglass.jpg", isActive: true },
  { id: 2, houseId: 1, title: "Cấm điện thoại 1 ngày", description: "Không sử dụng điện thoại trong 24h", chayCost: 10, image: "/punishments/hourglass.jpg", isActive: true },
  { id: 3, houseId: 1, title: "Quỳ gối suy ngẫm", description: "Quỳ gối suy nghĩ về lỗi lầm", chayCost: 1, image: "/punishments/hourglass.jpg", isActive: true },
];

export const mockPunishmentAssignments = [
  {
    id: 1,
    punishmentId: 1,
    memberId: 2,
    assignedBy: 1,
    status: "active" as const,
    assignedAt: new Date(),
    checklist: [
      { label: "Viết 100 dòng đầu tiên", completed: false },
      { label: "Viết 100 dòng tiếp theo", completed: false },
      { label: "Viết 100 dòng tiếp theo", completed: false },
      { label: "Viết 100 dòng tiếp theo", completed: false },
      { label: "Viết 100 dòng cuối cùng", completed: false },
    ],
    punishment: mockPunishments[0],
  },
];

export const mockLimits = [
  { id: 1, houseId: 1, content: "Không làm đau cơ thể vĩnh viễn", type: "limit" as const },
  { id: 2, houseId: 1, content: "Không chụp ảnh/video mặt", type: "limit" as const },
  { id: 3, houseId: 1, content: "Không công khai với ngườii ngoài", type: "limit" as const },
];

export const mockDesires = [
  { id: 4, houseId: 1, content: "Thích được ôm ấp nhẹ nhàng", type: "desire" as const },
  { id: 5, houseId: 1, content: "Thích được khen ngợi khi làm tốt", type: "desire" as const },
  { id: 6, houseId: 1, content: "Thích có thờii gian riêng buổi sáng", type: "desire" as const },
];

export const mockAgreements = [
  {
    id: 1,
    houseId: 1,
    title: "Thỏa thuận cơ bản",
    purpose: "Thiết lập quy tắc cơ bản cho mối quan hệ",
    rules: [
      { rule: "Tôn trọng giới hạn của nhau", context: "Không ép buộc vượt quá limit" },
      { rule: "Báo cáo trung thực", context: "Không nói dối về task" },
    ],
    consequences: [
      { trigger: "Vi phạm quy tắc", action: "Thêm 5 Chày" },
    ],
    domSignature: true,
    subSignature: true,
    status: "active" as const,
    domSignedAt: new Date(),
    subSignedAt: new Date(),
  },
];

export const mockJournals = [
  {
    id: 1,
    houseId: 1,
    memberId: 2,
    name: "Nhật ký cảm xúc",
    prompt: "Hôm nay bạn cảm thấy thế nào?",
    entries: [
      { id: 1, journalId: 1, memberId: 2, mood: "happy" as const, content: "Hôm nay cảm thấy rất vui, hoàn thành hết task!", createdAt: new Date(Date.now() - 86400000) },
      { id: 2, journalId: 1, memberId: 2, mood: "loved" as const, content: "Chủ nhà khen em nấu ăn ngon, em hạnh phúc quá!", createdAt: new Date() },
    ],
  },
];

export const mockNotes = [
  { id: 1, houseId: 1, memberId: 1, title: "Ghi chú chung", content: "Nhà cần mua thêm gia vị", visibility: "public" as const },
  { id: 2, houseId: 1, memberId: 1, title: "Kế hoạch cuối tuần", content: "Dã ngoại công viên Thống Nhất", visibility: "public" as const },
];

export const taskCategories = [
  { key: "daily", label: "Daily", color: "#FF2A85" },
  { key: "weekly", label: "Weekly", color: "#A155FF" },
  { key: "monthly", label: "Monthly", color: "#00F2FE" },
  { key: "special", label: "Special", color: "#FFD700" },
  { key: "superSpecial", label: "Super Special", color: "#FF6B00" },
  { key: "completed", label: "Completed", color: "#52525B" },
];

export const moodEmojis: Record<string, { emoji: string; label: string; color: string }> = {
  sad: { emoji: "😢", label: "Buồn", color: "#3B82F6" },
  neutral: { emoji: "😐", label: "Bình thường", color: "#9CA3AF" },
  happy: { emoji: "🙂", label: "Vui", color: "#10B981" },
  excited: { emoji: "😁", label: "Hào hứng", color: "#F59E0B" },
  loved: { emoji: "😍", label: "Yêu thương", color: "#EC4899" },
};
