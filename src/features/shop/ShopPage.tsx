import { useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Gift,
  Sparkles,
  Plus,
  Minus,
  Zap,
} from "lucide-react";
import { FAB } from "@/shared/components/FAB";
import { BottomSheet } from "@/shared/components/BottomSheet";
import { mockRewards, mockPrivileges, mockMembers } from "@/shared/mockData/mockData";

export function ShopPage() {
  const { mockSystemRole, shopSubTab, setShopSubTab, showToast } =
    useAppStore();
  const isAdmin = mockSystemRole === "admin";
  const [rewards, setRewards] = useState(mockRewards);
  const [privileges] = useState(mockPrivileges);
  const [wallet, setWallet] = useState(mockMembers[1].wallet);
  const [actionSheet, setActionSheet] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState("10");
  const [reasonInput, setReasonInput] = useState("");

  const handlePurchase = (cost: number) => {
    if (wallet.chymBalance < cost) {
      showToast("Không đủ Chym!", "error");
      return;
    }
    setWallet((prev) => ({ ...prev, chymBalance: prev.chymBalance - cost }));
    showToast("Đã mua phần thưởng!", "success");
  };

  const handleGift = () => {
    showToast("Đã tặng phần thưởng!", "success");
  };

  const handleAddPoints = () => {
    const amount = parseInt(pointsInput) || 0;
    if (amount <= 0) return;
    setWallet((prev) => ({ ...prev, chymBalance: prev.chymBalance + amount }));
    setActionSheet(null);
    showToast(`Đã thêm ${amount} Chym!`, "success");
  };

  const handleRemovePoints = () => {
    const amount = parseInt(pointsInput) || 0;
    if (amount <= 0) return;
    setWallet((prev) => ({
      ...prev,
      chymBalance: Math.max(0, prev.chymBalance - amount),
    }));
    setActionSheet(null);
    showToast(`Đã trừ ${amount} Chym!`, "success");
  };

  const handleQuickGrant = () => {
    if (!reasonInput.trim()) return;
    const newReward = {
      id: rewards.length + 1,
      houseId: 1,
      title: reasonInput,
      description: "Quick grant from admin",
      cost: 0,
      image: "/shop/reward_gift.jpg",
      rarity: "common" as const,
      isActive: true,
    };
    setRewards([...rewards, newReward]);
    setActionSheet(null);
    setReasonInput("");
    showToast("Đã tặng nhanh!", "success");
  };

  const rarityColors: Record<string, string> = {
    common: "#9CA3AF",
    rare: "#3B82F6",
    epic: "#A855F7",
    legendary: "#FFD700",
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
            src="/avatars/sub.jpg"
            alt="Avatar"
            className="w-20 h-20 rounded-xl object-cover border-2 border-[#A155FF]/30"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#A155FF] flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
        </div>
        <div className="flex-1 grid grid-rows-2 gap-2">
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{wallet.chymBalance}</p>
              <p className="text-xs text-white/50">Chym</p>
            </div>
            <Star className="w-6 h-6 text-[#A155FF]" />
          </div>
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">0</p>
              <p className="text-xs text-white/50">Purchased</p>
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
            {tab}
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
            {rewards.map((reward, i) => (
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
                        {reward.rarity}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-1 line-clamp-2">
                      {reward.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs flex items-center gap-1 text-[#FFD700]">
                        <Star className="w-3 h-3" /> {reward.cost} Chym
                      </span>
                      {isAdmin ? (
                        <button
                          onClick={handleGift}
                          className="px-4 py-1.5 rounded-lg bg-[#A155FF] text-white text-xs font-medium hover:bg-[#A155FF]/90 transition-colors"
                        >
                          Gift
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePurchase(reward.cost)}
                          disabled={wallet.chymBalance < reward.cost}
                          className="px-4 py-1.5 rounded-lg bg-[#A155FF] text-white text-xs font-medium hover:bg-[#A155FF]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Purchase
                        </button>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 flex-shrink-0">
                      <span className="text-white/30 text-lg">⋯</span>
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="privileges"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            {privileges.map((priv, i) => (
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
                  className={`mt-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isAdmin
                      ? "border border-[#00F2FE]/30 text-[#00F2FE] hover:bg-[#00F2FE]/10"
                      : "border border-white/10 text-white/50 hover:bg-white/5"
                  }`}
                >
                  {isAdmin ? "Assign" : "View"}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <FAB
        actions={[
          {
            label: "Quick Grant",
            icon: <Zap className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("quickgrant"),
            color: "#A155FF",
          },
          {
            label: "Remove Points",
            icon: <Minus className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("remove"),
            color: "#FF3B30",
          },
          {
            label: "Add Points",
            icon: <Plus className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("add"),
            color: "#00F2FE",
          },
        ]}
      />

      {/* Action Sheets */}
      <BottomSheet
        isOpen={actionSheet === "add"}
        onClose={() => setActionSheet(null)}
        title="Add Points"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Amount</label>
            <input
              type="number"
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Reason</label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleAddPoints}
            className="w-full py-3 rounded-xl bg-[#00F2FE] text-[#0D0D11] font-semibold text-sm hover:bg-[#00F2FE]/90 transition-colors"
          >
            Add Chym
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "remove"}
        onClose={() => setActionSheet(null)}
        title="Remove Points"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Amount</label>
            <input
              type="number"
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF3B30]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Reason</label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Enter reason..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF3B30]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleRemovePoints}
            className="w-full py-3 rounded-xl bg-[#FF3B30] text-white font-semibold text-sm hover:bg-[#FF3B30]/90 transition-colors"
          >
            Remove Chym
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "quickgrant"}
        onClose={() => setActionSheet(null)}
        title="Quick Grant"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">
              Reward Title
            </label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Enter custom reward..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleQuickGrant}
            disabled={!reasonInput.trim()}
            className="w-full py-3 rounded-xl bg-[#A155FF] text-white font-semibold text-sm hover:bg-[#A155FF]/90 disabled:opacity-50 transition-colors"
          >
            Grant Reward
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
