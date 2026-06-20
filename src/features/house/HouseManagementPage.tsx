import { motion } from "framer-motion";
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

export function HouseManagementPage() {
  const { setShowHouseManagement, mockSystemRole, showToast } = useAppStore();
  const isAdmin = mockSystemRole === "admin";

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
        <h1 className="text-xl font-bold text-white">Lunis House</h1>
      </motion.div>

      {/* Members List */}
      <div className="space-y-3">
        {mockMembers.map((member, i) => {
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
                  onClick={() => showToast("Chỉnh sửa thành viên", "info")}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Settings className="w-4 h-4 text-white/40" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Role Toggle (Demo Only) */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 p-4 bg-[#1A1A22] rounded-xl border border-white/5"
      >
        <h3 className="text-sm font-semibold text-white mb-2">Demo Controls</h3>
        <p className="text-xs text-white/40 mb-3">
          Toggle between Admin (Dom) and User (Sub) views to see different UI states.
        </p>
        <button
          onClick={() => {
            useAppStore.getState().toggleMockRole();
            showToast(
              `Switched to ${
                useAppStore.getState().mockSystemRole === "admin" ? "Admin" : "User"
              } mode`,
              "info"
            );
          }}
          className="w-full py-2.5 rounded-xl bg-[#252532] border border-white/10 text-white text-sm font-medium hover:bg-white/5 transition-colors"
        >
          Toggle Role (Current: {isAdmin ? "Admin/Dom" : "User/Sub"})
        </button>
      </motion.div>

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
            <span className="text-white/80">Lunis House</span>
          </div>
          <div className="flex justify-between">
            <span>Members</span>
            <span className="text-white/80">{mockMembers.length}</span>
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
