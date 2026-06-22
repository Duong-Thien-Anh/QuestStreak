import { motion } from "framer-motion";
import { useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import {
  ChevronLeft,
  Settings,
  Crown,
  Heart,
  ArrowLeftRight,
  User,
  HelpCircle,
} from "lucide-react";
import { mockMembers } from "@/shared/mockData/mockData";
import { trpc } from "@/providers/trpc";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

type LocalMember = {
  id: number;
  houseId: number;
  userId: number;
  nickname: string;
  lifestyleRole: "dominant" | "submissive" | "switch";
  gender: "male" | "female" | "other";
  telegramAvatar: string;
  wallet: {
    chymBalance: number;
    chayBalance: number;
  };
};

export function HouseManagementPage() {
  const { setShowHouseManagement, showToast } = useAppStore();
  const { isAdmin } = useCurrentUser();
  const houseQuery = trpc.house.get.useQuery(undefined, { retry: false });
  const house = houseQuery.data;
  const [localMembers, setLocalMembers] = useState<LocalMember[]>(
    mockMembers as LocalMember[]
  );
  const members = house?.members ?? localMembers;
  const utils = trpc.useUtils();
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [memberForm, setMemberForm] = useState({
    nickname: "",
    lifestyleRole: "submissive" as "dominant" | "submissive" | "switch",
    gender: "other" as "male" | "female" | "other",
  });
  const addMemberMutation = trpc.house["member.add"].useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
    },
  });
  const updateMemberMutation = trpc.house["member.update"].useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
    },
  });

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setMemberForm({
      nickname: "",
      lifestyleRole: "submissive",
      gender: "other",
    });
  };

  const submitMemberForm = () => {
    if (!memberForm.nickname.trim()) return;
    if (!house?.id) {
      if (editingMemberId) {
        setLocalMembers((prev) =>
          prev.map((member) =>
            member.id === editingMemberId
              ? {
                  ...member,
                  nickname: memberForm.nickname,
                  lifestyleRole: memberForm.lifestyleRole,
                  gender: memberForm.gender,
                }
              : member
          )
        );
        showToast("Đã cập nhật thành viên tạm thời", "success");
      } else {
        setLocalMembers((prev) => [
          ...prev,
          {
            id: Date.now(),
            houseId: 1,
            userId: Date.now(),
            nickname: memberForm.nickname,
            lifestyleRole: memberForm.lifestyleRole,
            gender: memberForm.gender,
            telegramAvatar: "",
            wallet: {
              chymBalance: 0,
              chayBalance: 0,
            },
          },
        ]);
        showToast("Đã thêm thành viên tạm thời", "success");
      }
      resetMemberForm();
      return;
    }

    if (editingMemberId) {
      updateMemberMutation.mutate({
        memberId: editingMemberId,
        nickname: memberForm.nickname,
        lifestyleRole: memberForm.lifestyleRole,
        gender: memberForm.gender,
      });
      showToast("Đã cập nhật thành viên", "success");
    } else {
      addMemberMutation.mutate({
        houseId: house.id,
        nickname: memberForm.nickname,
        lifestyleRole: memberForm.lifestyleRole,
        gender: memberForm.gender,
      });
      showToast("Đã thêm thành viên", "success");
    }

    resetMemberForm();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "dominant":
        return <Crown className="w-4 h-4 text-[#A155FF]" />;
      case "submissive":
        return <Heart className="w-4 h-4 text-[#FF2A85]" />;
      case "switch":
        return <ArrowLeftRight className="w-4 h-4 text-[#00F2FE]" />;
      default:
        return <HelpCircle className="w-4 h-4 text-white/40" />;
    }
  };

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case "male":
        return <User className="w-4 h-4 text-blue-400" />;
      case "female":
        return <User className="w-4 h-4 text-pink-400" />;
      default:
        return null;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "dominant":
        return "Dominant";
      case "submissive":
        return "Submissive";
      case "switch":
        return "Switch";
      default:
        return role;
    }
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => setShowHouseManagement(false)}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">{house?.name ?? "Lunis House"}</h1>
      </motion.div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member, i) => {
          const isOwner = i === 0;
          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 p-4 rounded-xl border ${
                isOwner
                  ? "bg-[#A155FF]/5 border-[#A155FF]/30"
                  : "bg-[#1A1A22] border-[#FF2A85]/30"
              }`}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <img
                  src={member.telegramAvatar || `/avatars/${member.gender === "male" ? "admin" : "sub"}.jpg`}
                  alt={member.nickname || "Member"}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#252532] border border-white/10 flex items-center justify-center">
                  {getRoleIcon(member.lifestyleRole)}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm">
                    {member.nickname || "Member"}
                  </h3>
                  {getGenderIcon(member.gender)}
                </div>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    color:
                      member.lifestyleRole === "dominant"
                        ? "#A155FF"
                        : member.lifestyleRole === "submissive"
                        ? "#FF2A85"
                        : "#00F2FE",
                  }}
                >
                  {getRoleLabel(member.lifestyleRole)}
                </p>
                {isOwner && (
                  <p className="text-[10px] text-white/30 mt-0.5">Chủ Nhà</p>
                )}
              </div>

              {/* Actions */}
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingMemberId(member.id);
                    setMemberForm({
                      nickname: member.nickname ?? "",
                      lifestyleRole: member.lifestyleRole,
                      gender: member.gender,
                    });
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-4 h-4 text-white/40" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 p-4 bg-[#1A1A22] rounded-xl border border-white/5 space-y-3"
        >
          <h3 className="text-sm font-semibold text-white">
            {editingMemberId ? "Edit Member" : "Add Member"}
          </h3>
          <input
            type="text"
            value={memberForm.nickname}
            onChange={(event) =>
              setMemberForm((current) => ({
                ...current,
                nickname: event.target.value,
              }))
            }
            placeholder="Nickname"
            className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={memberForm.lifestyleRole}
              onChange={(event) =>
                setMemberForm((current) => ({
                  ...current,
                  lifestyleRole: event.target.value as typeof memberForm.lifestyleRole,
                }))
              }
              className="px-3 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
            >
              <option value="dominant">Dominant</option>
              <option value="submissive">Submissive</option>
              <option value="switch">Switch</option>
            </select>
            <select
              value={memberForm.gender}
              onChange={(event) =>
                setMemberForm((current) => ({
                  ...current,
                  gender: event.target.value as typeof memberForm.gender,
                }))
              }
              className="px-3 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
            >
              <option value="other">Other</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={submitMemberForm}
              disabled={!memberForm.nickname.trim()}
              className="flex-1 py-3 rounded-xl bg-[#FF2A85] text-white font-semibold text-sm hover:bg-[#FF2A85]/90 disabled:opacity-50 transition-colors"
            >
              {editingMemberId ? "Save Member" : "Add Member"}
            </button>
            {editingMemberId && (
              <button
                onClick={resetMemberForm}
                className="px-4 py-3 rounded-xl border border-white/10 text-white/70 text-sm hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* House Info */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="p-4 bg-[#1A1A22] rounded-xl border border-white/5"
      >
        <h3 className="text-sm font-semibold text-white mb-2">House Info</h3>
        <div className="space-y-2 text-xs text-white/50">
          <div className="flex justify-between">
            <span>House Name</span>
            <span className="text-white/80">{house?.name ?? "Lunis House"}</span>
          </div>
          <div className="flex justify-between">
            <span>Members</span>
            <span className="text-white/80">{members.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Created</span>
            <span className="text-white/80">June 2025</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
