import { useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Gift,
  Heart,
  Plus,
  Minus,
  Zap,
} from "lucide-react";
import { FAB } from "@/shared/components/FAB";
import { BottomSheet } from "@/shared/components/BottomSheet";
import { mockRewards, mockPrivileges, mockMembers } from "@/shared/mockData/mockData";
import { trpc } from "@/providers/trpc";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

type Rarity = "common" | "rare" | "epic" | "legendary";

type LocalReward = {
  id: number;
  houseId: number;
  title: string;
  description: string;
  cost: number;
  purchaseLimit?: number | null;
  purchaseLimitPerUser?: number | null;
  purchaseCount?: number;
  image: string;
  rarity: Rarity;
  isActive: boolean;
};

type LocalPrivilege = {
  id: number;
  houseId: number;
  title: string;
  description: string;
  image: string;
  rarity: Rarity;
  isActive: boolean;
};

export function ShopPage() {
  const { shopSubTab, setShopSubTab, showToast } = useAppStore();
  const { isAdmin } = useCurrentUser();
  const [rewards, setRewards] = useState<LocalReward[]>(mockRewards as LocalReward[]);
  const [privileges, setPrivileges] = useState<LocalPrivilege[]>(
    mockPrivileges as LocalPrivilege[]
  );
  const [wallet, setWallet] = useState(mockMembers[1].wallet);
  const [actionSheet, setActionSheet] = useState<string | null>(null);
  const [selectedPrivilegeId, setSelectedPrivilegeId] = useState<number | null>(null);
  const [selectedPrivilegeMemberId, setSelectedPrivilegeMemberId] = useState<number | null>(null);
  const [pointsInput, setPointsInput] = useState("10");
  const [reasonInput, setReasonInput] = useState("");
  const [editingRewardId, setEditingRewardId] = useState<number | null>(null);
  const [rewardForm, setRewardForm] = useState({
    title: "",
    description: "",
    cost: 0,
    purchaseLimit: "",
    purchaseLimitPerUser: "",
    rarity: "common" as Rarity,
  });
  const [editingPrivilegeId, setEditingPrivilegeId] = useState<number | null>(null);
  const [privilegeForm, setPrivilegeForm] = useState({
    title: "",
    description: "",
    rarity: "common" as Rarity,
  });
  // ─ Gift sheet ─
  const [giftSheetRewardId, setGiftSheetRewardId] = useState<number | null>(null);
  const [selectedGiftMemberId, setSelectedGiftMemberId] = useState<number | null>(null);
  const [giftMessage, setGiftMessage] = useState("");
  const [giftReason, setGiftReason] = useState("");
  const utils = trpc.useUtils();
  const houseQuery = trpc.house.get.useQuery(undefined, { retry: false });
  const houseId = houseQuery.data?.id ?? 1;
  const members = houseQuery.data?.members ?? mockMembers;
  const subMember = members.find((member) => member.lifestyleRole === "submissive") ?? members[0];
  const rewardsQuery = trpc.reward.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const privilegesQuery = trpc.privilege.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const walletQuery = trpc.wallet.get.useQuery(
    { memberId: subMember?.id ?? 0 },
    { enabled: !!houseQuery.data?.id && !!subMember?.id, retry: false }
  );
  const purchasesQuery = trpc.reward.myPurchases.useQuery(undefined, {
    enabled: !!houseQuery.data?.id,
    retry: false,
  });
  const addChymMutation = trpc.wallet.addChym.useMutation({
    onSuccess: async () => {
      await utils.wallet.get.invalidate();
    },
  });
  const removeChymMutation = trpc.wallet.removeChym.useMutation({
    onSuccess: async () => {
      await utils.wallet.get.invalidate();
    },
  });
  const createRewardMutation = trpc.reward.create.useMutation({
    onSuccess: async () => {
      await utils.reward.list.invalidate();
    },
  });
  const updateRewardMutation = trpc.reward.update.useMutation({
    onSuccess: async () => {
      await utils.reward.list.invalidate();
    },
  });
  const deleteRewardMutation = trpc.reward.delete.useMutation({
    onSuccess: async () => {
      await utils.reward.list.invalidate();
    },
  });
  const purchaseRewardMutation = trpc.reward.purchase.useMutation({
    onSuccess: async () => {
      await utils.wallet.get.invalidate();
      await utils.reward.list.invalidate();
      await utils.reward.myPurchases.invalidate();
      showToast("Đã mua phần thưởng!", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const giftRewardMutation = trpc.reward.gift.useMutation();
  const createPrivilegeMutation = trpc.privilege.create.useMutation({
    onSuccess: async () => {
      await utils.privilege.list.invalidate();
    },
  });
  const updatePrivilegeMutation = trpc.privilege.update.useMutation({
    onSuccess: async () => {
      await utils.privilege.list.invalidate();
    },
  });
  const deletePrivilegeMutation = trpc.privilege.delete.useMutation({
    onSuccess: async () => {
      await utils.privilege.list.invalidate();
    },
  });
  const assignPrivilegeMutation = trpc.privilege.assign.useMutation();
  const visibleRewards = rewardsQuery.data ?? rewards;
  const visiblePrivileges = privilegesQuery.data ?? privileges;
  const visibleWallet = walletQuery.data ?? wallet;
  const purchasedCount = purchasesQuery.data?.length ?? 0;
  const selectedGiftMember = members.find((member) => member.id === selectedGiftMemberId);
  const selectedPrivilegeMember = members.find((member) => member.id === selectedPrivilegeMemberId);
  const purchaseCountByRewardId = new Map<number, number>();
  for (const purchase of purchasesQuery.data ?? []) {
    purchaseCountByRewardId.set(
      purchase.rewardId,
      (purchaseCountByRewardId.get(purchase.rewardId) ?? 0) + 1,
    );
  }

  const rewardLimitState = (reward: (typeof visibleRewards)[number]) => {
    const totalLimit = reward.purchaseLimit ?? null;
    const perUserLimit = reward.purchaseLimitPerUser ?? null;
    const totalPurchased = reward.purchaseCount ?? 0;
    const userPurchased = purchaseCountByRewardId.get(reward.id) ?? 0;
    const remaining =
      totalLimit === null ? null : Math.max(0, totalLimit - totalPurchased);
    return {
      remaining,
      totalReached: remaining !== null && remaining <= 0,
      perUserReached: perUserLimit !== null && userPurchased >= perUserLimit,
    };
  };

  const handlePurchase = (reward: (typeof visibleRewards)[number]) => {
    const limit = rewardLimitState(reward);
    if (visibleWallet.chymBalance < reward.cost) {
      showToast("Không đủ Chym!", "error");
      return;
    }
    if (limit.totalReached) {
      showToast("Reward này đã hết lượt mua", "error");
      return;
    }
    if (limit.perUserReached) {
      showToast("Bạn đã đạt giới hạn mua reward này", "error");
      return;
    }
    if (houseQuery.data) {
      purchaseRewardMutation.mutate({ rewardId: reward.id });
      return;
    }
    setWallet((prev) => ({ ...prev, chymBalance: prev.chymBalance - reward.cost }));
    showToast("Đã mua phần thưởng!", "success");
  };

  const handleGift = (rewardId?: number) => {
    if (!rewardId) return;
    if (!houseQuery.data) {
      showToast("Tặng reward cần backend để lưu", "info");
      return;
    }
    setGiftSheetRewardId(rewardId);
    setSelectedGiftMemberId(subMember?.id ?? members[0]?.id ?? null);
    setGiftMessage("");
    setGiftReason("");
  };

  const openPrivilegeAssignSheet = (privilegeId: number) => {
    setSelectedPrivilegeId(privilegeId);
    setSelectedPrivilegeMemberId(subMember?.id ?? members[0]?.id ?? null);
    setActionSheet("privilege-assign");
  };

  const handleAssignPrivilege = () => {
    if (!selectedPrivilegeId || !selectedPrivilegeMemberId) return;
    if (!houseQuery.data) {
      showToast("Gán privilege cần backend để lưu", "info");
      return;
    }
    assignPrivilegeMutation.mutate(
      {
        privilegeId: selectedPrivilegeId,
        memberId: selectedPrivilegeMemberId,
      },
      {
        onSuccess: () => {
          setSelectedPrivilegeId(null);
          setSelectedPrivilegeMemberId(null);
          setActionSheet(null);
          showToast("Đã gán privilege!", "success");
        },
        onError: (err) => showToast(err.message, "error"),
      },
    );
  };

  const confirmGift = () => {
    if (!giftSheetRewardId || !selectedGiftMemberId) return;
    giftRewardMutation.mutate(
      {
        rewardId: giftSheetRewardId,
        memberId: selectedGiftMemberId,
        giftMessage: giftMessage.trim() || undefined,
        giftReason: giftReason.trim() || undefined,
      },
      {
        onSuccess: async () => {
          await utils.reward.myPurchases.invalidate();
          await utils.notification.list.invalidate();
          await utils.notification.unreadCount.invalidate();
          setGiftSheetRewardId(null);
          setSelectedGiftMemberId(null);
          showToast("Đã tặng phần thưởng!", "success");
        },
        onError: (err) => showToast(err.message, "error"),
      }
    );
  };

  const handleAddPoints = () => {
    const amount = parseInt(pointsInput) || 0;
    if (amount <= 0) return;
    if (houseQuery.data && subMember?.id) {
      addChymMutation.mutate({
        memberId: subMember.id,
        amount,
        reason: reasonInput || undefined,
      });
      setActionSheet(null);
      showToast(`Đã thêm ${amount} Chym!`, "success");
      return;
    }
    setWallet((prev) => ({ ...prev, chymBalance: prev.chymBalance + amount }));
    setActionSheet(null);
    showToast(`Đã thêm ${amount} Chym!`, "success");
  };

  const handleRemovePoints = () => {
    const amount = parseInt(pointsInput) || 0;
    if (amount <= 0) return;
    if (houseQuery.data && subMember?.id) {
      removeChymMutation.mutate({
        memberId: subMember.id,
        amount,
        reason: reasonInput || undefined,
      });
      setActionSheet(null);
      showToast(`Đã trừ ${amount} Chym!`, "success");
      return;
    }
    setWallet((prev) => ({
      ...prev,
      chymBalance: Math.max(0, prev.chymBalance - amount),
    }));
    setActionSheet(null);
    showToast(`Đã trừ ${amount} Chym!`, "success");
  };

  const resetRewardForm = () => {
    setEditingRewardId(null);
    setRewardForm({
      title: "",
      description: "",
      cost: 0,
      purchaseLimit: "",
      purchaseLimitPerUser: "",
      rarity: "common",
    });
  };

  const openRewardForm = (reward?: (typeof visibleRewards)[number]) => {
    if (reward) {
      setEditingRewardId(reward.id);
      setRewardForm({
        title: reward.title,
        description: reward.description ?? "",
        cost: reward.cost,
        purchaseLimit: reward.purchaseLimit?.toString() ?? "",
        purchaseLimitPerUser: reward.purchaseLimitPerUser?.toString() ?? "",
        rarity: reward.rarity,
      });
    } else {
      resetRewardForm();
    }
    setActionSheet("reward-form");
  };

  const submitRewardForm = () => {
    if (!rewardForm.title.trim()) return;
    if (!houseQuery.data) {
      if (editingRewardId) {
        setRewards((prev) =>
          prev.map((reward) =>
            reward.id === editingRewardId
              ? {
                  ...reward,
                  title: rewardForm.title,
                  description: rewardForm.description,
                  cost: rewardForm.cost,
                  purchaseLimit: rewardForm.purchaseLimit ? Number(rewardForm.purchaseLimit) : null,
                  purchaseLimitPerUser: rewardForm.purchaseLimitPerUser
                    ? Number(rewardForm.purchaseLimitPerUser)
                    : null,
                  rarity: rewardForm.rarity,
                }
              : reward
          )
        );
        showToast("Đã cập nhật reward tạm thời!", "success");
      } else {
        setRewards((prev) => [
          ...prev,
          {
            id: Date.now(),
            houseId: 1,
            title: rewardForm.title,
            description: rewardForm.description,
            cost: rewardForm.cost,
            purchaseLimit: rewardForm.purchaseLimit ? Number(rewardForm.purchaseLimit) : null,
            purchaseLimitPerUser: rewardForm.purchaseLimitPerUser
              ? Number(rewardForm.purchaseLimitPerUser)
              : null,
            image: "/shop/reward_gift.jpg",
            rarity: rewardForm.rarity,
            isActive: true,
          },
        ]);
        showToast("Đã tạo reward tạm thời!", "success");
      }
      resetRewardForm();
      setActionSheet(null);
      return;
    }

    if (editingRewardId) {
      updateRewardMutation.mutate({
        rewardId: editingRewardId,
        title: rewardForm.title,
        description: rewardForm.description || undefined,
        cost: rewardForm.cost,
        purchaseLimit: rewardForm.purchaseLimit ? Number(rewardForm.purchaseLimit) : null,
        purchaseLimitPerUser: rewardForm.purchaseLimitPerUser
          ? Number(rewardForm.purchaseLimitPerUser)
          : null,
        rarity: rewardForm.rarity,
      });
      showToast("Đã cập nhật reward!", "success");
    } else {
      createRewardMutation.mutate({
        houseId,
        title: rewardForm.title,
        description: rewardForm.description || undefined,
        cost: rewardForm.cost,
        purchaseLimit: rewardForm.purchaseLimit ? Number(rewardForm.purchaseLimit) : null,
        purchaseLimitPerUser: rewardForm.purchaseLimitPerUser
          ? Number(rewardForm.purchaseLimitPerUser)
          : null,
        image: "/shop/reward_gift.jpg",
        rarity: rewardForm.rarity,
      });
      showToast("Đã tạo reward!", "success");
    }

    resetRewardForm();
    setActionSheet(null);
  };

  const deleteReward = (rewardId: number) => {
    if (!houseQuery.data) {
      setRewards((prev) => prev.filter((reward) => reward.id !== rewardId));
      showToast("Đã xóa reward tạm thời!", "success");
      return;
    }
    deleteRewardMutation.mutate({ rewardId });
    showToast("Đã xóa reward!", "success");
  };

  const resetPrivilegeForm = () => {
    setEditingPrivilegeId(null);
    setPrivilegeForm({
      title: "",
      description: "",
      rarity: "common",
    });
  };

  const openPrivilegeForm = (privilege?: (typeof visiblePrivileges)[number]) => {
    if (privilege) {
      setEditingPrivilegeId(privilege.id);
      setPrivilegeForm({
        title: privilege.title,
        description: privilege.description ?? "",
        rarity: privilege.rarity,
      });
    } else {
      resetPrivilegeForm();
    }
    setActionSheet("privilege-form");
  };

  const submitPrivilegeForm = () => {
    if (!privilegeForm.title.trim()) return;
    if (!houseQuery.data) {
      if (editingPrivilegeId) {
        setPrivileges((prev) =>
          prev.map((privilege) =>
            privilege.id === editingPrivilegeId
              ? {
                  ...privilege,
                  title: privilegeForm.title,
                  description: privilegeForm.description,
                  rarity: privilegeForm.rarity,
                }
              : privilege
          )
        );
        showToast("Đã cập nhật privilege tạm thời!", "success");
      } else {
        setPrivileges((prev) => [
          ...prev,
          {
            id: Date.now(),
            houseId: 1,
            title: privilegeForm.title,
            description: privilegeForm.description,
            image: "/privileges/vip_pass.jpg",
            rarity: privilegeForm.rarity,
            isActive: true,
          },
        ]);
        showToast("Đã tạo privilege tạm thời!", "success");
      }
      resetPrivilegeForm();
      setActionSheet(null);
      return;
    }

    if (editingPrivilegeId) {
      updatePrivilegeMutation.mutate({
        privilegeId: editingPrivilegeId,
        title: privilegeForm.title,
        description: privilegeForm.description || undefined,
        rarity: privilegeForm.rarity,
      });
      showToast("Đã cập nhật privilege!", "success");
    } else {
      createPrivilegeMutation.mutate({
        houseId,
        title: privilegeForm.title,
        description: privilegeForm.description || undefined,
        image: "/privileges/vip_pass.jpg",
        rarity: privilegeForm.rarity,
      });
      showToast("Đã tạo privilege!", "success");
    }

    resetPrivilegeForm();
    setActionSheet(null);
  };

  const deletePrivilege = (privilegeId: number) => {
    if (!houseQuery.data) {
      setPrivileges((prev) => prev.filter((privilege) => privilege.id !== privilegeId));
      showToast("Đã xóa privilege tạm thời!", "success");
      return;
    }
    deletePrivilegeMutation.mutate({ privilegeId });
    showToast("Đã xóa privilege!", "success");
  };

  const selectedPrivilege = visiblePrivileges.find(
    (privilege) => privilege.id === selectedPrivilegeId
  );

  const rarityColors: Record<string, string> = {
    common: "#9CA3AF",
    rare: "#3B82F6",
    epic: "#A855F7",
    legendary: "#FFD700",
  };

  const rarityLabel: Record<Rarity, string> = {
    common: "Thường",
    rare: "Hiếm",
    epic: "Sử thi",
    legendary: "Huyền thoại",
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-4"
      >
        <div className="relative flex-shrink-0">
          <img
            src={subMember?.telegramAvatar || "/avatars/sub.jpg"}
            alt="Avatar"
            className="w-44 h-44 rounded-xl object-cover border-2 border-[#FF2A85]/30"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF2A85] flex items-center justify-center">
            <Heart className="w-3 h-3 text-white" />
          </div>
        </div>
        <div className="flex-1 grid grid-rows-2 gap-2">
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{visibleWallet.chymBalance}</p>
              <p className="text-xs text-white/50">Chym</p>
            </div>
            <Star className="w-6 h-6 text-[#A155FF]" />
          </div>
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{purchasedCount}</p>
              <p className="text-xs text-white/50">Đã mua</p>
            </div>
            <Gift className="w-6 h-6 text-[#A155FF]" />
          </div>
        </div>
      </motion.div>

      {/* Sub tabs */}
      <div className="flex bg-[#1A1A22] rounded-xl p-1 border border-white/5">
        {(["rewards", "privileges"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setShopSubTab(tab)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all capitalize ${
              shopSubTab === tab
                ? "bg-[#A155FF]/20 text-[#A155FF]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab === "rewards" ? "Reward" : "Privilege"}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {shopSubTab === "rewards" ? (
          <motion.div
            key="rewards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {visibleRewards.map((reward, i) => {
              const limit = rewardLimitState(reward);
              const purchaseDisabled =
                visibleWallet.chymBalance < reward.cost ||
                limit.totalReached ||
                limit.perUserReached ||
                purchaseRewardMutation.isPending;
              const purchaseLabel = limit.totalReached || limit.perUserReached ? "Hết lượt" : "Mua";

              return (
              <motion.div
                key={reward.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#1A1A22] rounded-xl border border-white/5 p-4"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={reward.image || "/shop/reward_star.jpg"}
                    alt={reward.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {reward.title}
                      </h3>
                      <span
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          color: rarityColors[reward.rarity],
                          backgroundColor: `${rarityColors[reward.rarity]}15`,
                        }}
                      >
                        {rarityLabel[reward.rarity]}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-1 line-clamp-2">
                      {reward.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs flex items-center gap-1 text-[#FFD700]">
                          <Star className="w-3 h-3" /> {reward.cost} Chym
                        </span>
                        {limit.remaining !== null ? (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                            Còn {limit.remaining} lượt
                          </span>
                        ) : null}
                        {reward.purchaseLimitPerUser != null ? (
                          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/55">
                            {reward.purchaseLimitPerUser} lượt/user
                          </span>
                        ) : null}
                      </div>
                      {isAdmin ? (
                        <button
                          onClick={() => handleGift(reward.id)}
                          className="px-4 py-1.5 rounded-lg bg-[#A155FF] text-white text-xs font-medium hover:bg-[#A155FF]/90 transition-colors"
                        >
                          Tặng
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(reward)}
                          disabled={purchaseDisabled}
                          className="px-4 py-1.5 rounded-lg bg-[#A155FF] text-white text-xs font-medium hover:bg-[#A155FF]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          {purchaseLabel}
                        </button>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => openRewardForm(reward)}
                        className="px-2 py-1 rounded-lg border border-white/10 text-[10px] text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => deleteReward(reward.id)}
                        className="px-2 py-1 rounded-lg border border-[#FF3B30]/20 text-[10px] text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
                      >
                        Xóa
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div
            key="privileges"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            {visiblePrivileges.map((priv, i) => (
              <motion.div
                key={priv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#1A1A22] rounded-xl border border-white/5 p-4 flex flex-col"
              >
                <img
                  src={priv.image || "/privileges/vip_pass.jpg"}
                  alt={priv.title}
                  className="w-full aspect-square rounded-lg object-cover mb-3"
                />
                <h3 className="font-semibold text-white text-xs text-center">
                  {priv.title}
                </h3>
                <p className="text-[10px] text-white/40 text-center mt-1 line-clamp-2">
                  {priv.description}
                </p>
                <button
                  onClick={() => {
                    if (isAdmin) {
                      openPrivilegeAssignSheet(priv.id);
                    } else {
                      setSelectedPrivilegeId(priv.id);
                      setActionSheet("privilege-view");
                    }
                  }}
                  className={`mt-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isAdmin
                      ? "border border-[#00F2FE]/30 text-[#00F2FE] hover:bg-[#00F2FE]/10"
                      : "border border-white/10 text-white/50 hover:bg-white/5"
                  }`}
                >
                  {isAdmin ? "Gán" : "Xem"}
                </button>
                {isAdmin && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openPrivilegeForm(priv)}
                      className="py-1.5 rounded-lg border border-white/10 text-[10px] text-white/60 hover:bg-white/5 transition-colors"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => deletePrivilege(priv.id)}
                      className="py-1.5 rounded-lg border border-[#FF3B30]/20 text-[10px] text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors"
                    >
                      Xóa
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <FAB
        actions={[
          {
            label: shopSubTab === "rewards" ? "Reward mới" : "Đặc quyền mới",
            icon: <Zap className="w-5 h-5 text-white" />,
            onClick: () => {
              if (shopSubTab === "rewards") openRewardForm();
              else openPrivilegeForm();
            },
            color: "#A155FF",
          },
          {
            label: "Trừ Chym",
            icon: <Minus className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("remove"),
            color: "#FF3B30",
          },
          {
            label: "Thêm Chym",
            icon: <Plus className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("add"),
            color: "#00F2FE",
          },
        ]}
      />

      {/* Action Sheets */}
      <BottomSheet
        isOpen={actionSheet === "reward-form"}
        onClose={() => {
          resetRewardForm();
          setActionSheet(null);
        }}
        title={editingRewardId ? "Sửa Reward" : "Reward mới"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Tiêu đề</label>
            <input
              type="text"
              value={rewardForm.title}
              onChange={(event) =>
                setRewardForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Nhập tên Reward..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Mô tả</label>
            <textarea
              value={rewardForm.description}
              onChange={(event) =>
                setRewardForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Nhập mô tả Reward..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Giá</label>
            <input
              type="number"
              min={0}
              value={rewardForm.cost}
              onChange={(event) =>
                setRewardForm((current) => ({
                  ...current,
                  cost: Number(event.target.value),
                }))
              }
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#A155FF]/50 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-2 block">Tổng lượt</label>
              <input
                type="number"
                min={0}
                value={rewardForm.purchaseLimit}
                onChange={(event) =>
                  setRewardForm((current) => ({
                    ...current,
                    purchaseLimit: event.target.value,
                  }))
                }
                placeholder="Không giới hạn"
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Lượt/user</label>
              <input
                type="number"
                min={0}
                value={rewardForm.purchaseLimitPerUser}
                onChange={(event) =>
                  setRewardForm((current) => ({
                    ...current,
                    purchaseLimitPerUser: event.target.value,
                  }))
                }
                placeholder="Không giới hạn"
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={submitRewardForm}
            disabled={!rewardForm.title.trim()}
            className="w-full py-3 rounded-xl bg-[#A155FF] text-white font-semibold text-sm hover:bg-[#A155FF]/90 disabled:opacity-50 transition-colors"
          >
            {editingRewardId ? "Lưu Reward" : "Tạo Reward"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "privilege-form"}
        onClose={() => {
          resetPrivilegeForm();
          setActionSheet(null);
        }}
        title={editingPrivilegeId ? "Sửa đặc quyền" : "Đặc quyền mới"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Tiêu đề</label>
            <input
              type="text"
              value={privilegeForm.title}
              onChange={(event) =>
                setPrivilegeForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Nhập tên đặc quyền..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Mô tả</label>
            <textarea
              value={privilegeForm.description}
              onChange={(event) =>
                setPrivilegeForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Nhập mô tả đặc quyền..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Độ hiếm</label>
            <select
              value={privilegeForm.rarity}
              onChange={(event) =>
                setPrivilegeForm((current) => ({
                  ...current,
                  rarity: event.target.value as typeof privilegeForm.rarity,
                }))
              }
              className="w-full px-3 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#00F2FE]/50 focus:outline-none"
            >
              <option value="common">Thường</option>
              <option value="rare">Hiếm</option>
              <option value="epic">Sử thi</option>
              <option value="legendary">Huyền thoại</option>
            </select>
          </div>
          <button
            onClick={submitPrivilegeForm}
            disabled={!privilegeForm.title.trim()}
            className="w-full py-3 rounded-xl bg-[#00F2FE] text-[#0D0D11] font-semibold text-sm hover:bg-[#00F2FE]/90 disabled:opacity-50 transition-colors"
          >
            {editingPrivilegeId ? "Lưu đặc quyền" : "Tạo đặc quyền"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "add"}
        onClose={() => setActionSheet(null)}
        title="Thêm Chym"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Số lượng</label>
            <input
              type="number"
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Lý do</label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Nhập lý do..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddPoints}
            className="w-full py-3 rounded-xl bg-[#00F2FE] text-[#0D0D11] font-semibold text-sm hover:bg-[#00F2FE]/90 transition-colors"
          >
            Thêm Chym
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "remove"}
        onClose={() => setActionSheet(null)}
        title="Trừ Chym"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Số lượng</label>
            <input
              type="number"
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF3B30]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Lý do</label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Nhập lý do..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF3B30]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleRemovePoints}
            className="w-full py-3 rounded-xl bg-[#FF3B30] text-white font-semibold text-sm hover:bg-[#FF3B30]/90 transition-colors"
          >
            Trừ Chym
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "privilege-view"}
        onClose={() => {
          setSelectedPrivilegeId(null);
          setActionSheet(null);
        }}
        title="Chi tiết đặc quyền"
      >
        {selectedPrivilege ? (
          <div className="space-y-4">
            <img
              src={selectedPrivilege.image || "/privileges/vip_pass.jpg"}
              alt={selectedPrivilege.title}
              className="w-full aspect-video rounded-xl object-cover"
            />
            <div>
              <h3 className="text-base font-semibold text-white">{selectedPrivilege.title}</h3>
              <p className="mt-2 text-sm text-white/60">
                {selectedPrivilege.description || "Chưa có mô tả."}
              </p>
            </div>
            <span
              className="inline-flex rounded-lg px-2 py-1 text-xs font-semibold uppercase"
              style={{
                color: rarityColors[selectedPrivilege.rarity],
                backgroundColor: `${rarityColors[selectedPrivilege.rarity]}15`,
              }}
            >
              {rarityLabel[selectedPrivilege.rarity]}
            </span>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "privilege-assign"}
        onClose={() => {
          setSelectedPrivilegeId(null);
          setSelectedPrivilegeMemberId(null);
          setActionSheet(null);
        }}
        title="Gán đặc quyền"
      >
        {selectedPrivilege ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[#00F2FE]/20 bg-[#00F2FE]/5 p-3">
              <img
                src={selectedPrivilege.image || "/privileges/vip_pass.jpg"}
                alt={selectedPrivilege.title}
                className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{selectedPrivilege.title}</p>
                <p className="text-xs text-white/40">
                  Gán cho {selectedPrivilegeMember?.nickname ?? "thành viên"}
                </p>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Người nhận</label>
              <select
                value={selectedPrivilegeMemberId ?? ""}
                onChange={(event) => setSelectedPrivilegeMemberId(Number(event.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#00F2FE]/50 focus:outline-none"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname || "Thành viên"} - {member.lifestyleRole}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAssignPrivilege}
              disabled={assignPrivilegeMutation.isPending || !selectedPrivilegeMemberId}
              className="w-full py-3 rounded-xl bg-[#00F2FE] text-[#0D0D11] font-semibold text-sm hover:bg-[#00F2FE]/90 disabled:opacity-50 transition-colors"
            >
              {assignPrivilegeMutation.isPending ? "Đang gán..." : "Gán đặc quyền"}
            </button>
          </div>
        ) : null}
      </BottomSheet>

      {/* ── Gift Reward Sheet ── */}
      <BottomSheet
        isOpen={giftSheetRewardId !== null}
        onClose={() => {
          setGiftSheetRewardId(null);
          setSelectedGiftMemberId(null);
        }}
        title="Tặng Phần Thưởng"
      >
        <div className="space-y-4">
          {/* Reward preview */}
          {giftSheetRewardId && (() => {
            const r = visibleRewards.find((rw) => rw.id === giftSheetRewardId);
            return r ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#A155FF]/5 border border-[#A155FF]/20">
                <img
                  src={r.image || "/shop/reward_star.jpg"}
                  alt={r.title}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{r.title}</p>
                  <p className="text-xs text-white/40">
                    Tặng cho {selectedGiftMember?.nickname ?? "thành viên"}
                  </p>
                </div>
              </div>
            ) : null;
          })()}

          <div>
            <label className="text-xs text-white/50 mb-2 block">
              Người nhận
            </label>
            <select
              value={selectedGiftMemberId ?? ""}
              onChange={(event) => setSelectedGiftMemberId(Number(event.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#A155FF]/50 focus:outline-none"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname || "Thành viên"} - {member.lifestyleRole}
                </option>
              ))}
            </select>
          </div>

          {/* Gift Message */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">
              Lời nhắn (tùy chọn)
            </label>
            <textarea
              id="gift-message-textarea"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
              placeholder="Viết lời nhắn kèm theo món quà..."
              rows={3}
              maxLength={2000}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none resize-none"
            />
            <p className="text-[10px] text-white/20 mt-1 text-right">{giftMessage.length}/2000</p>
          </div>

          {/* Gift Reason */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">
              Lý do tặng (tùy chọn)
            </label>
            <input
              id="gift-reason-input"
              type="text"
              value={giftReason}
              onChange={(e) => setGiftReason(e.target.value)}
              placeholder="Vì sao bạn muốn tặng reward này..."
              maxLength={2000}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
            />
          </div>

          {/* Confirm */}
          <button
            onClick={confirmGift}
            disabled={giftRewardMutation.isPending || !selectedGiftMemberId}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #A155FF, #FF2A85)" }}
          >
            <Gift className="w-4 h-4" />
            {giftRewardMutation.isPending ? "Đang gửi..." : "Xác nhận Tặng"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
