import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import {
  ArrowLeftRight,
  Calendar,
  Check,
  ChevronLeft,
  Copy,
  Crown,
  Globe2,
  Heart,
  HelpCircle,
  Hash,
  LifeBuoy,
  Lock,
  Mail,
  MessageCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mockMembers } from "@/shared/mockData/mockData";
import { trpc } from "@/providers/trpc";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

type MemberRole = "dominant" | "submissive" | "switch";
type Gender = "male" | "female";
type AppLanguage = "en" | "vi";
type MenuSection = "profile" | "settings" | "security" | "support";
type JoinRequestStatus = "pending" | "approved" | "rejected";

function normalizeGender(gender: string | null | undefined): Gender {
  return gender === "male" ? "male" : "female";
}

type LocalMember = {
  id: number;
  houseId: number;
  userId: number;
  nickname: string | null;
  lifestyleRole: MemberRole;
  gender: Gender;
  telegramAvatar: string | null;
  wallet: {
    chymBalance: number;
    chayBalance: number;
  };
};

type JoinRequest = {
  id: number;
  houseId: number;
  userId: number;
  nickname: string | null;
  gender: Gender;
  status: JoinRequestStatus;
  createdAt: Date | string;
};

const menuItems: Array<{
  id: MenuSection;
  icon: typeof User;
}> = [
  {
    id: "profile",
    icon: User,
  },
  {
    id: "settings",
    icon: Settings,
  },
  {
    id: "security",
    icon: Lock,
  },
  {
    id: "support",
    icon: LifeBuoy,
  },
];

const accountCopy = {
  en: {
    accountMenu: "Menu tài khoản",
    profile: {
      label: "Hồ sơ",
      description: "Tên, avatar và thông tin hiển thị cá nhân",
    },
    settings: {
      label: "Cài đặt",
      description: "Tùy chọn tài khoản và mặc định hệ thống",
    },
    security: {
      label: "Bảo mật",
      description: "Phiên đăng nhập, provider và Telegram",
    },
    support: {
      label: "Hỗ trợ",
      description: "Trợ giúp, phản hồi và báo lỗi",
    },
    accountSettings: "Cài đặt tài khoản",
    defaultRoom: "Phòng mặc định",
    currentRole: "Vai trò hiện tại",
    notifications: "Thông báo",
    enabled: "Bật",
    language: "Ngôn ngữ",
    languageDescription: "Chọn ngôn ngữ hiển thị cho tài khoản này.",
    english: "Tiếng Anh",
    vietnamese: "Tiếng Việt",
    preferences: "Tùy chỉnh",
    preferencesBody:
      "Tùy chọn cá nhân sẽ nằm ở đây. Quản lý thành viên và mã phòng chỉ nằm trong panel phòng mở từ tên phòng trên header.",
    saved: "Đã cập nhật ngôn ngữ",
    saving: "Đang lưu...",
  },
  vi: {
    accountMenu: "Menu tài khoản",
    profile: {
      label: "Hồ sơ",
      description: "Tên, avatar và thông tin hiển thị cá nhân",
    },
    settings: {
      label: "Cài đặt",
      description: "Tùy chọn tài khoản và mặc định hệ thống",
    },
    security: {
      label: "Bảo mật",
      description: "Phiên đăng nhập, provider và Telegram",
    },
    support: {
      label: "Hỗ trợ",
      description: "Trợ giúp, phản hồi và báo lỗi",
    },
    accountSettings: "Cài đặt tài khoản",
    defaultRoom: "Phòng mặc định",
    currentRole: "Vai trò hiện tại",
    notifications: "Thông báo",
    enabled: "Bật",
    language: "Ngôn ngữ",
    languageDescription: "Chọn ngôn ngữ hiển thị cho tài khoản này.",
    english: "Tiếng Anh",
    vietnamese: "Tiếng Việt",
    preferences: "Tùy chỉnh",
    preferencesBody:
      "Tùy chọn cá nhân sẽ nằm ở đây. Quản lý thành viên và mã phòng chỉ nằm trong panel phòng mở từ tên phòng trên header.",
    saved: "Đã cập nhật ngôn ngữ",
    saving: "Đang lưu...",
  },
} satisfies Record<AppLanguage, Record<string, unknown>>;

export function HouseManagementPage() {
  const { managementPanel, setManagementPanel, showToast } = useAppStore();
  const { user, currentMember, isAdmin } = useCurrentUser();
  const houseQuery = trpc.house.get.useQuery(undefined, { retry: false });
  const house = houseQuery.data;
  const utils = trpc.useUtils();
  const currentLanguage = (user?.language ?? "vi") as AppLanguage;
  const copy = accountCopy[currentLanguage];
  const [activeSection, setActiveSection] = useState<MenuSection>("profile");
  const [localMembers, setLocalMembers] = useState<LocalMember[]>(
    mockMembers as LocalMember[],
  );
  const members = useMemo(
    () => (house?.members ?? localMembers) as LocalMember[],
    [house?.members, localMembers],
  );
  const pendingJoinRequests = useMemo(
    () =>
      ((house?.pendingJoinRequests ?? []) as JoinRequest[]).filter(
        (request) => request.status === "pending",
      ),
    [house?.pendingJoinRequests],
  );
  const displayMember =
    currentMember ??
    members.find((member) => member.userId === user?.id) ??
    members[0] ??
    null;
  const isRootAdmin = user?.role === "admin";

  const [profileForm, setProfileForm] = useState({
    nickname: undefined as string | undefined,
    gender: undefined as Gender | undefined,
  });
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberForm, setMemberForm] = useState({
    nickname: "",
    lifestyleRole: "submissive" as MemberRole,
    gender: "female" as Gender,
  });
  const [roomNameDraft, setRoomNameDraft] = useState<string | undefined>();

  const selfUpdateMutation = trpc.house["member.selfUpdate"].useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
      setProfileForm({
        nickname: undefined,
        gender: undefined,
      });
      showToast("Đã cập nhật profile", "success");
    },
    onError: (err) => showToast(err.message, "error"),
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
  const removeMemberMutation = trpc.house["member.remove"].useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
      showToast("Đã xóa thành viên", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const updateHouseMutation = trpc.house.update.useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
      setRoomNameDraft(undefined);
      showToast("Đã cập nhật tên phòng", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const rotateRoomCodeMutation = trpc.house["roomCode.rotate"].useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
      showToast("Đã đổi mã phòng", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const updateApprovalMutation = trpc.house["approval.update"].useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
      showToast("Đã cập nhật setting phòng", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const reviewJoinRequestMutation = trpc.house["joinRequest.review"].useMutation({
    onSuccess: async (_, variables) => {
      await utils.house.get.invalidate();
      showToast(
        variables.decision === "approve"
          ? "Đã duyệt thành viên"
          : "Đã từ chối yêu cầu",
        "success",
      );
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const updatePreferencesMutation = trpc.auth.updatePreferences.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      showToast(copy.saved, "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setMemberDialogOpen(false);
    setMemberForm({
      nickname: "",
      lifestyleRole: "submissive",
      gender: "female",
    });
  };

  const openAddMemberDialog = () => {
    setEditingMemberId(null);
    setMemberForm({
      nickname: "",
      lifestyleRole: "submissive",
      gender: "female",
    });
    setMemberDialogOpen(true);
  };

  const openEditMemberDialog = (member: LocalMember) => {
    setEditingMemberId(member.id);
    setMemberForm({
      nickname: member.nickname ?? "",
      lifestyleRole: member.lifestyleRole,
      gender: normalizeGender(member.gender),
    });
    setMemberDialogOpen(true);
  };

  const removeMember = (member: LocalMember) => {
    const nickname = member.nickname || "this member";
    if (!window.confirm(`Remove ${nickname} from this room?`)) return;

    if (!house?.id) {
      setLocalMembers((prev) => prev.filter((item) => item.id !== member.id));
      showToast("Đã xóa thành viên tạm thời", "success");
      return;
    }

    removeMemberMutation.mutate({ memberId: member.id });
  };

  const submitProfileForm = () => {
    const nickname = profileForm.nickname ?? displayMember?.nickname ?? "";
    const gender = normalizeGender(profileForm.gender ?? displayMember?.gender);

    selfUpdateMutation.mutate({
      nickname: nickname.trim() || undefined,
      gender,
    });
  };

  const submitRoomName = () => {
    if (!house?.id) return;
    const nextName = (roomNameDraft ?? house.name ?? "Lunis House").trim();
    if (!nextName) return;
    updateHouseMutation.mutate({
      houseId: house.id,
      name: nextName,
    });
  };

  const regenerateRoomCode = async () => {
    if (!house?.id) return;
    await rotateRoomCodeMutation.mutateAsync({
      houseId: house.id,
    });
  };

  const toggleRoomApproval = (approvalRequired: boolean) => {
    if (!house?.id) return;
    updateApprovalMutation.mutate({
      houseId: house.id,
      approvalRequired,
    });
  };

  const reviewJoinRequest = (
    requestId: number,
    decision: "approve" | "reject",
  ) => {
    reviewJoinRequestMutation.mutate({ requestId, decision });
  };

  const updateLanguage = (language: AppLanguage) => {
    updatePreferencesMutation.mutate({ language });
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
              : member,
          ),
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
        return "Người giao task";
      case "submissive":
        return "Người nhận task";
      case "switch":
        return "Người giao + nhận task";
      default:
        return role;
    }
  };

  const currentRoleLabel = isRootAdmin
    ? "Quản trị viên"
    : displayMember
    ? getRoleLabel(displayMember.lifestyleRole)
    : "Khách";

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text);
    showToast("Đã copy", "success");
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const ownerMember =
    members.find((member) => member.userId === house?.ownerId) ?? members[0] ?? null;

  const renderRoomOverview = () => (
    <section className="space-y-4 rounded-xl border border-white/5 bg-[#1A1A22] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/35">
            Phòng
          </p>
          <h2 className="mt-1 truncate text-lg font-bold text-white">
            {house?.name ?? "Lunis House"}
          </h2>
        </div>
        <div className="rounded-full border border-[#FF2A85]/30 bg-[#FF2A85]/10 px-3 py-1 text-xs font-semibold text-[#FF2A85]">
          {currentRoleLabel}
        </div>
      </div>

      {isRootAdmin && (
        <div className="rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/10 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
            <div>
              <p className="text-sm font-semibold text-white">
                Bảng quản trị viên
              </p>
              <p className="mt-1 text-xs leading-5 text-white/50">
                Tài khoản admin có toàn quyền tạo, sửa phòng, quản lý thành viên
                và duyệt yêu cầu mà không cần bước tạo phòng sau đăng nhập.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/5 bg-[#252532] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
            <Hash className="h-3.5 w-3.5" />
            Mã phòng
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-mono text-sm text-[#00F2FE]">
              {house?.roomCode ?? "Chưa có mã phòng"}
            </p>
            {house?.roomCode && (
              <button
                onClick={() => copyText(house.roomCode ?? "")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"
                aria-label="Copy room code"
              >
                <Copy className="h-3.5 w-3.5 text-white/50" />
              </button>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-[#252532] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
            <Calendar className="h-3.5 w-3.5" />
            Ngày tạo
          </div>
          <p className="text-sm font-medium text-white/80">
            {formatDate(house?.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-2 text-xs text-white/50">
        <div className="flex justify-between gap-4 rounded-xl bg-[#252532] px-3 py-2">
          <span>Chủ phòng</span>
          <span className="text-right text-white/80">
            {ownerMember?.nickname ?? "Chủ phòng"}
          </span>
        </div>
        <div className="flex justify-between gap-4 rounded-xl bg-[#252532] px-3 py-2">
          <span>Thành viên</span>
          <span className="text-white/80">{members.length}</span>
        </div>
      </div>

      {isAdmin && house?.id && (
        <div className="space-y-3 border-t border-white/5 pt-4">
          <div className="rounded-xl border border-white/5 bg-[#252532] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  Duyệt thành viên
                </p>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Khi bật, người nhận task nhập mã phòng sẽ chờ người giao task
                  duyệt trước khi vào phòng.
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleRoomApproval(!house.roomApprovalRequired)}
                disabled={updateApprovalMutation.isPending}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                  house.roomApprovalRequired
                    ? "border-[#00F2FE]/50 bg-[#00F2FE]/30"
                    : "border-white/10 bg-white/10"
                }`}
                aria-label="Toggle room member approval"
              >
                <span
                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-out will-change-transform ${
                    house.roomApprovalRequired
                      ? "translate-x-5"
                      : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
          <label className="block space-y-2">
            <span className="text-xs text-white/45">Tên phòng</span>
            <input
              type="text"
              value={roomNameDraft ?? house.name ?? "Lunis House"}
              onChange={(event) => setRoomNameDraft(event.target.value)}
              maxLength={255}
              className="w-full rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
              placeholder="Tên phòng"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={submitRoomName}
              disabled={updateHouseMutation.isPending}
              className="rounded-xl bg-[#FF2A85] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF2A85]/90 disabled:opacity-50"
            >
              {updateHouseMutation.isPending ? "Đang lưu..." : "Lưu tên phòng"}
            </button>
            <button
              onClick={() => void regenerateRoomCode()}
              disabled={rotateRoomCodeMutation.isPending}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-semibold text-white/75 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Đổi mã
            </button>
          </div>
        </div>
      )}
    </section>
  );

  const renderProfile = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <div className="flex items-center gap-4">
          <img
            src={`/avatars/${
              normalizeGender(profileForm.gender ?? displayMember?.gender) === "male"
                ? "admin"
                : "sub"
            }.jpg`}
            alt={
              profileForm.nickname ??
              displayMember?.nickname ??
              user?.name ??
              "Hồ sơ"
            }
            className="h-16 w-16 rounded-full border-2 border-white/10 object-cover"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-white">
              {profileForm.nickname ??
                displayMember?.nickname ??
                user?.name ??
                "Hồ sơ của bạn"}
            </h2>
            <p className="mt-1 text-xs text-white/45">
              {currentRoleLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <h3 className="text-sm font-semibold text-white">Chi tiết hồ sơ</h3>
        <label className="block space-y-2">
          <span className="text-xs text-white/45">Tên hiển thị</span>
          <input
            type="text"
            value={profileForm.nickname ?? displayMember?.nickname ?? ""}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                nickname: event.target.value,
              }))
            }
            maxLength={255}
            className="w-full rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
            placeholder="Tên hiển thị của bạn"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-xs text-white/45">Giới tính</span>
          <select
            value={normalizeGender(profileForm.gender ?? displayMember?.gender)}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                gender: event.target.value as Gender,
              }))
            }
            className="w-full rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white focus:border-[#FF2A85]/50 focus:outline-none"
          >
            <option value="female">Nữ</option>
            <option value="male">Nam</option>
          </select>
        </label>
        <button
          onClick={submitProfileForm}
          disabled={selfUpdateMutation.isPending || !displayMember}
          className="w-full rounded-xl bg-[#FF2A85] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF2A85]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selfUpdateMutation.isPending ? "Đang lưu..." : "Lưu hồ sơ"}
        </button>
      </section>
    </motion.div>
  );

  const renderSettings = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {renderRoomOverview()}

      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        {isAdmin && (
          <div className="mb-4 rounded-xl border border-[#00F2FE]/15 bg-[#00F2FE]/5 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Yêu cầu tham gia
                </h3>
                <p className="mt-1 text-xs text-white/45">
                  {pendingJoinRequests.length
                    ? `${pendingJoinRequests.length} người đang chờ duyệt`
                    : "Chưa có yêu cầu mới"}
                </p>
              </div>
              <UserPlus className="h-5 w-5 text-[#00F2FE]" />
            </div>
            {pendingJoinRequests.length > 0 && (
              <div className="space-y-2">
                {pendingJoinRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#1A1A22] p-3"
                  >
                    <img
                      src={`/avatars/${
                        request.gender === "male" ? "admin" : "sub"
                      }.jpg`}
                      alt={request.nickname || "Join request"}
                      className="h-10 w-10 rounded-full border border-white/10 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {request.nickname || "Thành viên mới"}
                      </p>
                      <p className="text-xs text-white/40">
                        Chờ từ {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => reviewJoinRequest(request.id, "approve")}
                        disabled={reviewJoinRequestMutation.isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00F2FE]/10 transition-colors hover:bg-[#00F2FE]/20 disabled:opacity-50"
                        aria-label="Approve member"
                      >
                        <Check className="h-4 w-4 text-[#00F2FE]" />
                      </button>
                      <button
                        onClick={() => reviewJoinRequest(request.id, "reject")}
                        disabled={reviewJoinRequestMutation.isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF3B30]/10 transition-colors hover:bg-[#FF3B30]/20 disabled:opacity-50"
                        aria-label="Reject member"
                      >
                        <X className="h-4 w-4 text-[#FF3B30]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Thành viên trong phòng</h3>
          {isAdmin && (
            <button
              onClick={openAddMemberDialog}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:bg-white/5"
            >
              Thêm thành viên
            </button>
          )}
        </div>
        <div className="space-y-3">
          {members.map((member, i) => {
            const isOwner = i === 0;
            const canRemove =
              isAdmin && member.userId !== user?.id && member.userId !== house?.ownerId;
            return (
              <div
                key={member.id}
                className={`flex items-center gap-4 rounded-xl border p-4 ${
                  isOwner
                    ? "border-[#A155FF]/30 bg-[#A155FF]/5"
                    : "border-[#FF2A85]/30 bg-[#252532]"
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={
                      `/avatars/${member.gender === "male" ? "admin" : "sub"}.jpg`
                    }
                    alt={member.nickname || "Thành viên"}
                    className="h-12 w-12 rounded-full border-2 border-white/10 object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#252532]">
                    {getRoleIcon(member.lifestyleRole)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-white">
                      {member.nickname || "Thành viên"}
                    </h3>
                    {getGenderIcon(member.gender)}
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">
                    {getRoleLabel(member.lifestyleRole)}
                  </p>
                  {member.userId === house?.ownerId && (
                    <p className="mt-0.5 text-[10px] text-white/30">Chủ phòng</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEditMemberDialog(member)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                      aria-label="Edit member"
                    >
                      <Settings className="h-4 w-4 text-white/40" />
                    </button>
                    {canRemove && (
                      <button
                        onClick={() => removeMember(member)}
                        disabled={removeMemberMutation.isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#FF3B30]/10 disabled:opacity-40"
                        aria-label="Remove member"
                      >
                        <Trash2 className="h-4 w-4 text-[#FF3B30]/65" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isAdmin && (
        <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
          <DialogContent className="border-white/10 bg-[#1A1A22] text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingMemberId ? "Sửa thành viên" : "Thêm thành viên"}
              </DialogTitle>
              <DialogDescription className="text-white/45">
                Cấu hình tên hiển thị và vai trò trong phòng.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input
                type="text"
                value={memberForm.nickname}
                onChange={(event) =>
                  setMemberForm((current) => ({
                    ...current,
                    nickname: event.target.value,
                  }))
                }
                placeholder="Biệt danh"
                className="w-full rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={memberForm.lifestyleRole}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,
                      lifestyleRole: event.target.value as MemberRole,
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-[#252532] px-3 py-3 text-sm text-white focus:border-[#FF2A85]/50 focus:outline-none"
                >
                  <option value="dominant">Người giao task</option>
                  <option value="submissive">Người nhận task</option>
                  <option value="switch">Người giao + nhận task</option>
                </select>
                <select
                  value={memberForm.gender}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,
                      gender: event.target.value as Gender,
                    }))
                  }
                  className="rounded-xl border border-white/10 bg-[#252532] px-3 py-3 text-sm text-white focus:border-[#FF2A85]/50 focus:outline-none"
                >
                  <option value="female">Nữ</option>
                  <option value="male">Nam</option>
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <button
                onClick={resetMemberForm}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                onClick={submitMemberForm}
                disabled={!memberForm.nickname.trim()}
                className="rounded-xl bg-[#FF2A85] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF2A85]/90 disabled:opacity-50"
              >
                {editingMemberId ? "Lưu thành viên" : "Thêm thành viên"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
          <h3 className="mb-2 text-sm font-semibold text-white">Thông tin phòng</h3>
        <div className="space-y-2 text-xs text-white/50">
          <div className="flex justify-between gap-4">
            <span>Tên phòng</span>
            <span className="text-right text-white/80">{house?.name ?? "Lunis House"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Thành viên</span>
            <span className="text-white/80">{members.length}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Duyệt thành viên</span>
            <span className="text-right text-white/80">
              {house?.roomApprovalRequired ? "Bật" : "Tắt"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Ngày tạo</span>
            <span className="text-right text-white/80">
              {formatDate(house?.createdAt)}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Vai trò của bạn</span>
            <span className="text-right text-white/80">
              {currentRoleLabel}
            </span>
          </div>
        </div>
      </section>
    </motion.div>
  );

  const renderAccountSettings = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <h3 className="text-sm font-semibold text-white">{copy.accountSettings}</h3>
        <div className="mt-3 space-y-2 text-xs text-white/50">
          <div className="flex justify-between gap-4 rounded-xl bg-[#252532] px-3 py-2">
            <span>{copy.defaultRoom}</span>
            <span className="truncate text-right text-white/80">
              {house?.name ?? "Lunis House"}
            </span>
          </div>
          <div className="flex justify-between gap-4 rounded-xl bg-[#252532] px-3 py-2">
            <span>{copy.currentRole}</span>
            <span className="text-right text-white/80">
              {currentRoleLabel}
            </span>
          </div>
          <div className="flex justify-between gap-4 rounded-xl bg-[#252532] px-3 py-2">
            <span>{copy.notifications}</span>
            <span className="text-right text-white/80">{copy.enabled}</span>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <div className="flex items-start gap-3">
          <Globe2 className="mt-0.5 h-5 w-5 text-[#00F2FE]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-white">{copy.language}</h3>
            <p className="mt-1 text-xs leading-5 text-white/45">
              {copy.languageDescription}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["vi", "en"] as const).map((language) => {
            const isActive = currentLanguage === language;
            return (
              <button
                key={language}
                type="button"
                onClick={() => updateLanguage(language)}
                disabled={updatePreferencesMutation.isPending || isActive}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:cursor-default ${
                  isActive
                    ? "border-[#00F2FE]/45 bg-[#00F2FE]/10 text-[#00F2FE]"
                    : "border-white/10 bg-[#252532] text-white/70 hover:border-white/20"
                }`}
              >
                {language === "vi" ? copy.vietnamese : copy.english}
              </button>
            );
          })}
        </div>
        {updatePreferencesMutation.isPending && (
          <p className="mt-3 text-xs text-white/35">{copy.saving}</p>
        )}
      </section>
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <h3 className="text-sm font-semibold text-white">{copy.preferences}</h3>
        <p className="mt-2 text-xs leading-5 text-white/45">
          {copy.preferencesBody}
        </p>
      </section>
    </motion.div>
  );

  const renderSecurity = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-[#00F2FE]" />
          <div>
            <h3 className="text-sm font-semibold text-white">Phiên hiện tại</h3>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Bạn đang đăng nhập bằng cookie phiên hiện tại của ứng dụng. Đăng nhập Telegram
              sẽ thay thế bằng phiên Telegram Mini App đã xác minh.
            </p>
          </div>
        </div>
      </section>
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <h3 className="text-sm font-semibold text-white">Danh tính đăng nhập</h3>
        <div className="mt-3 space-y-2 text-xs text-white/50">
          <div className="flex justify-between gap-4">
            <span>User ID</span>
            <span className="text-right text-white/80">{user?.id ?? "-"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Union ID</span>
            <span className="truncate text-right text-white/80">
              {user?.unionId ?? "-"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Provider</span>
            <span className="text-right text-white/80">
              {user?.unionId?.startsWith("telegram:")
                ? "Telegram"
                : user?.unionId?.startsWith("demo:")
                ? "Demo"
                : "Current auth"}
            </span>
          </div>
        </div>
      </section>
    </motion.div>
  );

  const renderSupport = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <section className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-0.5 h-5 w-5 text-[#FF2A85]" />
          <div>
            <h3 className="text-sm font-semibold text-white">Cần hỗ trợ?</h3>
            <p className="mt-1 text-xs leading-5 text-white/45">
              Khu vực này dùng cho liên kết hỗ trợ, ghi chú sản phẩm và trợ giúp Telegram bot
              sau khi luồng đăng nhập Mini App được kết nối.
            </p>
          </div>
        </div>
      </section>
      <section className="space-y-3 rounded-xl border border-white/5 bg-[#1A1A22] p-4">
        <button className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-left transition hover:border-white/20">
          <Mail className="h-4 w-4 text-white/55" />
          <span>
            <span className="block text-sm font-medium text-white">Liên hệ hỗ trợ</span>
            <span className="block text-xs text-white/45">Chuẩn bị email hoặc liên kết hỗ trợ bot</span>
          </span>
        </button>
        <button className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-left transition hover:border-white/20">
          <HelpCircle className="h-4 w-4 text-white/55" />
          <span>
            <span className="block text-sm font-medium text-white">FAQ</span>
            <span className="block text-xs text-white/45">Câu hỏi thường gặp về tài khoản và phòng</span>
          </span>
        </button>
      </section>
    </motion.div>
  );

  const renderActiveSection = () => {
    switch (activeSection) {
      case "profile":
        return renderProfile();
      case "settings":
        return renderAccountSettings();
      case "security":
        return renderSecurity();
      case "support":
        return renderSupport();
      default:
        return renderProfile();
    }
  };

  if (managementPanel === "room") {
    return (
      <div className="space-y-4 px-4 pt-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={() => setManagementPanel(null)}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-white">Phòng</h1>
            <p className="truncate text-xs text-white/40">
              {house?.name ?? "Lunis House"}
            </p>
          </div>
        </motion.div>

        {renderSettings()}
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => setManagementPanel(null)}
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-white">
            {copy.accountMenu}
          </h1>
          <p className="text-xs text-white/40">{house?.name ?? "Lunis House"}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`min-h-[92px] rounded-xl border p-3 text-left transition ${
                isActive
                  ? "border-[#FF2A85]/45 bg-[#FF2A85]/10"
                  : "border-white/5 bg-[#1A1A22] hover:border-white/15"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? "text-[#FF2A85]" : "text-white/50"
                }`}
              />
              <span className="mt-2 block text-sm font-semibold text-white">
                {copy[item.id].label}
              </span>
              <span className="mt-1 block text-xs leading-4 text-white/40">
                {copy[item.id].description}
              </span>
            </button>
          );
        })}
      </div>

      {renderActiveSection()}
    </div>
  );
}
