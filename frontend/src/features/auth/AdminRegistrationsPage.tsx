import { useState } from "react";
import {
  Activity,
  Check,
  ClipboardList,
  Flame,
  Gift,
  Home,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/providers/trpc";

type AdminSection = "overview" | "rooms" | "users" | "operations" | "registrations";
type OperationSection =
  | "tasks"
  | "shop"
  | "wallet"
  | "punishments"
  | "notebook"
  | "activity";
type RegistrationStatus = "pending" | "approved" | "rejected" | "all";
type MemberRole = "dominant" | "submissive" | "switch";
type Gender = "male" | "female" | "other";
type AccountRole = "user" | "admin";

const sectionTabs: Array<{
  value: AdminSection;
  label: string;
  icon: typeof Home;
}> = [
  { value: "overview", label: "Tổng quan", icon: ShieldCheck },
  { value: "rooms", label: "Rooms", icon: Home },
  { value: "users", label: "Users", icon: Users },
  { value: "operations", label: "Operations", icon: Activity },
  { value: "registrations", label: "Duyệt đăng ký", icon: UserPlus },
];

const operationTabs: Array<{ value: OperationSection; label: string; icon: typeof Home }> = [
  { value: "tasks", label: "Tasks", icon: ClipboardList },
  { value: "shop", label: "Rewards & Gifts", icon: Gift },
  { value: "wallet", label: "Wallet & Streak", icon: Wallet },
  { value: "punishments", label: "Punishments", icon: Target },
  { value: "notebook", label: "Notebook", icon: Flame },
  { value: "activity", label: "Activity", icon: Activity },
];

const registrationTabs: Array<{ value: RegistrationStatus; label: string }> = [
  { value: "pending", label: "Chờ duyệt" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Từ chối" },
  { value: "all", label: "Tất cả" },
];

const memberRoleLabels: Record<MemberRole, string> = {
  dominant: "Creator",
  submissive: "Receiver",
  switch: "Creator + Receiver",
};

const genderLabels: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminRegistrationsPage() {
  const utils = trpc.useUtils();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [activeOperationSection, setActiveOperationSection] =
    useState<OperationSection>("tasks");
  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>("pending");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRegistrationId, setSelectedRegistrationId] =
    useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomOwnerId, setNewRoomOwnerId] = useState("");
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomEditName, setRoomEditName] = useState("");
  const [roomEditOwnerId, setRoomEditOwnerId] = useState("");

  const [memberRoomId, setMemberRoomId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberNickname, setMemberNickname] = useState("");
  const [memberRole, setMemberRole] = useState<MemberRole>("submissive");
  const [memberGender, setMemberGender] = useState<Gender>("other");
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);

  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountRole, setAccountRole] = useState<AccountRole>("user");

  const usersQuery = trpc.admin.listUsers.useQuery(undefined, {
    retry: false,
  });
  const roomsQuery = trpc.admin.listRooms.useQuery(undefined, {
    retry: false,
  });
  const registrationsQuery = trpc.admin.listRegistrations.useQuery(
    { status: registrationStatus },
    { retry: false },
  );
  const pendingCountQuery = trpc.admin.listRegistrations.useQuery(
    { status: "pending" },
    { retry: false },
  );
  const operationsQuery = trpc.admin.listOperations.useQuery(undefined, {
    retry: false,
  });

  const users = usersQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const registrations = registrationsQuery.data ?? [];
  const operations = operationsQuery.data;
  const selectedRegistration = registrations.find(
    (item) => item.id === selectedRegistrationId,
  );
  const totalMembers = rooms.reduce((sum, room) => sum + room.members.length, 0);
  const adminUsers = users.filter((user) => user.role === "admin");
  const pendingRegistrations = pendingCountQuery.data ?? [];
  const roomOptions = rooms.map((room) => ({ id: room.id, name: room.name }));
  const memberOptions = rooms.flatMap((room) =>
    room.members.map((member) => ({
      id: member.id,
      houseId: room.id,
      label: `${member.nickname ?? member.user?.name ?? `Member #${member.id}`} · ${room.name}`,
    })),
  );

  const invalidateAdminData = async () => {
    await Promise.all([
      utils.admin.listUsers.invalidate(),
      utils.admin.listRooms.invalidate(),
      utils.admin.listRegistrations.invalidate(),
      utils.admin.listOperations.invalidate(),
    ]);
  };


  const createRoomMutation = trpc.admin.createRoom.useMutation({
    onSuccess: async () => {
      setNewRoomName("");
      setNewRoomOwnerId("");
      await utils.admin.listRooms.invalidate();
    },
  });
  const updateRoomMutation = trpc.admin.updateRoom.useMutation({
    onSuccess: async () => {
      setEditingRoomId(null);
      setRoomEditName("");
      setRoomEditOwnerId("");
      await utils.admin.listRooms.invalidate();
    },
  });
  const deleteRoomMutation = trpc.admin.deleteRoom.useMutation({
    onSuccess: async () => {
      await utils.admin.listRooms.invalidate();
    },
  });
  const addMemberMutation = trpc.admin.addRoomMember.useMutation({
    onSuccess: async () => {
      resetMemberForm();
      await utils.admin.listRooms.invalidate();
    },
  });
  const updateMemberMutation = trpc.admin.updateRoomMember.useMutation({
    onSuccess: async () => {
      resetMemberForm();
      await utils.admin.listRooms.invalidate();
    },
  });
  const removeMemberMutation = trpc.admin.removeRoomMember.useMutation({
    onSuccess: async () => {
      await utils.admin.listRooms.invalidate();
    },
  });
  const createAccountMutation = trpc.admin.createLocalAccount.useMutation({
    onSuccess: async () => {
      setAccountName("");
      setAccountEmail("");
      setAccountUsername("");
      setAccountPassword("");
      setAccountRole("user");
      await utils.admin.listUsers.invalidate();
    },
  });
  const updateUserAccountMutation = trpc.admin.updateUserAccount.useMutation({
    onSuccess: async () => {
      await invalidateAdminData();
    },
  });
  const deleteUserAccountMutation = trpc.admin.deleteUserAccount.useMutation({
    onSuccess: async () => {
      await invalidateAdminData();
    },
  });
  const approveMutation = trpc.admin.approveRegistration.useMutation({
    onSuccess: async () => {
      await invalidateAdminData();
    },
  });
  const rejectMutation = trpc.admin.rejectRegistration.useMutation({
    onSuccess: async () => {
      closeRejectModal();
      await invalidateAdminData();
    },
  });
  const updateWalletProgressMutation = trpc.admin.updateWalletProgress.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateStreakMutation = trpc.admin.updateStreak.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateTaskStatusMutation = trpc.admin.updateTaskStatus.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateTaskSubmissionStatusMutation =
    trpc.admin.updateTaskSubmissionStatus.useMutation({
      onSuccess: async () => {
        await utils.admin.listOperations.invalidate();
      },
    });
  const updateCatalogActiveMutation = trpc.admin.updateCatalogActive.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateRewardPurchaseStatusMutation =
    trpc.admin.updateRewardPurchaseStatus.useMutation({
      onSuccess: async () => {
        await utils.admin.listOperations.invalidate();
      },
    });
  const updatePrivilegeAssignmentStatusMutation =
    trpc.admin.updatePrivilegeAssignmentStatus.useMutation({
      onSuccess: async () => {
        await utils.admin.listOperations.invalidate();
      },
    });
  const updatePunishmentAssignmentStatusMutation =
    trpc.admin.updatePunishmentAssignmentStatus.useMutation({
      onSuccess: async () => {
        await utils.admin.listOperations.invalidate();
      },
    });
  const updateAgreementStatusMutation = trpc.admin.updateAgreementStatus.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const deleteOperationRecordMutation = trpc.admin.deleteOperationRecord.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const createTaskMutation = trpc.admin.createTask.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateTaskMutation = trpc.admin.updateTask.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const deleteTaskMutation = trpc.admin.deleteTask.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const createCatalogItemMutation = trpc.admin.createCatalogItem.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateCatalogItemMutation = trpc.admin.updateCatalogItem.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const deleteCatalogItemMutation = trpc.admin.deleteCatalogItem.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const createRewardPurchaseMutation = trpc.admin.createRewardPurchase.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const createPrivilegeAssignmentMutation =
    trpc.admin.createPrivilegeAssignment.useMutation({
      onSuccess: async () => {
        await utils.admin.listOperations.invalidate();
      },
    });
  const createPunishmentAssignmentMutation =
    trpc.admin.createPunishmentAssignment.useMutation({
      onSuccess: async () => {
        await utils.admin.listOperations.invalidate();
      },
    });
  const createNoteMutation = trpc.admin.createNote.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });
  const updateNoteMutation = trpc.admin.updateNote.useMutation({
    onSuccess: async () => {
      await utils.admin.listOperations.invalidate();
    },
  });

  function resetMemberForm() {
    setMemberRoomId("");
    setMemberUserId("");
    setMemberNickname("");
    setMemberRole("submissive");
    setMemberGender("other");
    setEditingMemberId(null);
  }

  function startEditRoom(room: (typeof rooms)[number]) {
    setEditingRoomId(room.id);
    setRoomEditName(room.name);
    setRoomEditOwnerId(String(room.ownerId));
  }

  function startEditMember(member: (typeof rooms)[number]["members"][number]) {
    setEditingMemberId(member.id);
    setMemberRoomId(String(member.houseId));
    setMemberUserId(member.user ? String(member.user.id) : "");
    setMemberNickname(member.nickname ?? "");
    setMemberRole(member.lifestyleRole);
    setMemberGender(member.gender);
  }

  function submitRoom() {
    const name = newRoomName.trim();
    if (!name) return;
    createRoomMutation.mutate({
      name,
      ownerId: newRoomOwnerId ? Number(newRoomOwnerId) : undefined,
    });
  }

  function submitRoomEdit() {
    if (!editingRoomId || !roomEditName.trim()) return;
    updateRoomMutation.mutate({
      houseId: editingRoomId,
      name: roomEditName.trim(),
      ownerId: roomEditOwnerId ? Number(roomEditOwnerId) : undefined,
    });
  }

  function submitMember() {
    if (!memberNickname.trim()) return;
    if (editingMemberId) {
      updateMemberMutation.mutate({
        memberId: editingMemberId,
        nickname: memberNickname.trim(),
        lifestyleRole: memberRole,
        gender: memberGender,
      });
      return;
    }
    if (!memberRoomId) return;
    addMemberMutation.mutate({
      houseId: Number(memberRoomId),
      userId: memberUserId ? Number(memberUserId) : undefined,
      nickname: memberNickname.trim(),
      lifestyleRole: memberRole,
      gender: memberGender,
    });
  }

  function submitAccount() {
    if (!accountName.trim() || !accountEmail.trim() || !accountPassword) return;
    createAccountMutation.mutate({
      name: accountName.trim(),
      email: accountEmail.trim(),
      username: accountUsername.trim() || undefined,
      password: accountPassword,
      role: accountRole,
    });
  }

  function submitUserAccount(userId: number) {
    const name = inputValue(`user-${userId}-name`).trim();
    const email = inputValue(`user-${userId}-email`).trim();
    if (!name || !email) return;
    updateUserAccountMutation.mutate({
      userId,
      name,
      email,
      username: inputValue(`user-${userId}-username`).trim() || undefined,
      phone: inputValue(`user-${userId}-phone`).trim() || undefined,
      password: inputValue(`user-${userId}-password`) || undefined,
      role: inputValue(`user-${userId}-role`) as AccountRole,
    });
  }

  function deleteUserAccount(userId: number, label: string) {
    if (!window.confirm(`Xóa user ${label}? Các memberships và dữ liệu member liên quan sẽ bị xóa.`)) {
      return;
    }
    deleteUserAccountMutation.mutate({ userId });
  }

  function openRejectModal(id: number) {
    setSelectedRegistrationId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  }

  function closeRejectModal() {
    setRejectModalOpen(false);
    setSelectedRegistrationId(null);
    setRejectReason("");
  }

  function renderMetric(label: string, value: number | string, Icon: typeof Home) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#161922] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs uppercase tracking-wide text-white/40">
            {label}
          </span>
          <Icon className="h-4 w-4 text-[#F59E0B]" />
        </div>
        <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      </div>
    );
  }

  function deleteOperationRecord(
    type:
      | "taskSubmission"
      | "rewardPurchase"
      | "privilegeAssignment"
      | "punishmentAssignment"
      | "wheelSpin"
      | "note"
      | "notification"
      | "log",
    id: number,
  ) {
    if (!window.confirm(`Xóa record #${id}?`)) return;
    deleteOperationRecordMutation.mutate({ type, id });
  }

  function inputValue(id: string) {
    return (
      (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null)
        ?.value ?? ""
    );
  }

  function inputNumber(id: string, fallback = 0) {
    const value = Number(inputValue(id));
    return Number.isFinite(value) ? value : fallback;
  }

  function firstRoomId() {
    return rooms[0]?.id ?? 0;
  }

  function firstMemberId() {
    return memberOptions[0]?.id ?? 0;
  }

  function submitCreateTask() {
    const houseId = inputNumber("admin-task-house", firstRoomId());
    const title = inputValue("admin-task-title").trim();
    const createdBy = inputNumber("admin-task-created-by", firstMemberId());
    if (!houseId || !title || !createdBy) return;
    createTaskMutation.mutate({
      houseId,
      title,
      description: inputValue("admin-task-description").trim() || undefined,
      category: inputValue("admin-task-category") as
        | "daily"
        | "weekly"
        | "monthly"
        | "special"
        | "superSpecial",
      chymReward: inputNumber("admin-task-chym"),
      chayPenalty: inputNumber("admin-task-chay"),
      assignedTo: inputNumber("admin-task-assigned-to") || undefined,
      createdBy,
      status: inputValue("admin-task-status") as
        | "pending"
        | "active"
        | "submitted"
        | "completed"
        | "failed",
    });
  }

  function submitCreateCatalog(type: "reward" | "privilege" | "punishment" | "wheel") {
    const prefix = `admin-${type}`;
    const houseId = inputNumber(`${prefix}-house`, firstRoomId());
    const title = inputValue(`${prefix}-title`).trim();
    const createdBy = inputNumber(`${prefix}-created-by`, firstMemberId());
    if (!houseId || !title || !createdBy) return;
    createCatalogItemMutation.mutate({
      type,
      houseId,
      title,
      description: inputValue(`${prefix}-description`).trim() || undefined,
      createdBy,
      cost: inputNumber(`${prefix}-cost`),
      chayCost: inputNumber(`${prefix}-chay-cost`),
      rarity: inputValue(`${prefix}-rarity`) as
        | "common"
        | "rare"
        | "epic"
        | "legendary",
      assignedTo: inputNumber(`${prefix}-assigned-to`) || undefined,
      options: inputValue(`${prefix}-options`).trim() || undefined,
      isActive: true,
    });
  }

  function submitCreateRewardPurchase() {
    const rewardId = inputNumber("admin-gift-reward");
    const memberId = inputNumber("admin-gift-member");
    if (!rewardId || !memberId) return;
    createRewardPurchaseMutation.mutate({
      rewardId,
      memberId,
      giftedBy: inputNumber("admin-gift-by") || undefined,
      status: inputValue("admin-gift-status") as "active" | "used" | "expired",
      giftMessage: inputValue("admin-gift-message").trim() || undefined,
      giftReason: inputValue("admin-gift-reason").trim() || undefined,
    });
  }

  function submitCreatePrivilegeAssignment() {
    const privilegeId = inputNumber("admin-privilege-assignment-privilege");
    const memberId = inputNumber("admin-privilege-assignment-member");
    const assignedBy = inputNumber("admin-privilege-assignment-by", firstMemberId());
    if (!privilegeId || !memberId || !assignedBy) return;
    createPrivilegeAssignmentMutation.mutate({
      privilegeId,
      memberId,
      assignedBy,
      status: inputValue("admin-privilege-assignment-status") as
        | "active"
        | "used"
        | "expired",
    });
  }

  function submitCreatePunishmentAssignment() {
    const punishmentId = inputNumber("admin-punishment-assignment-punishment");
    const memberId = inputNumber("admin-punishment-assignment-member");
    const assignedBy = inputNumber("admin-punishment-assignment-by", firstMemberId());
    if (!punishmentId || !memberId || !assignedBy) return;
    createPunishmentAssignmentMutation.mutate({
      punishmentId,
      memberId,
      assignedBy,
      status: inputValue("admin-punishment-assignment-status") as
        | "active"
        | "redeemed"
        | "forgiven",
      checklist: inputValue("admin-punishment-assignment-checklist").trim() || undefined,
    });
  }

  function submitCreateNote() {
    const memberId = inputNumber("admin-note-member");
    const member = memberOptions.find((item) => item.id === memberId);
    const title = inputValue("admin-note-title").trim();
    if (!member || !title) return;
    createNoteMutation.mutate({
      houseId: member.houseId,
      memberId,
      title,
      content: inputValue("admin-note-content").trim() || undefined,
      visibility: inputValue("admin-note-visibility") as "public" | "private",
    });
  }

  function renderActiveToggle(
    type: "reward" | "privilege" | "punishment" | "wheel",
    id: number,
    isActive: boolean,
  ) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-white/15 bg-white/5 text-white hover:bg-white/10"
        disabled={updateCatalogActiveMutation.isPending}
        onClick={() =>
          updateCatalogActiveMutation.mutate({
            type,
            id,
            isActive: !isActive,
          })
        }
      >
        {isActive ? "Deactivate" : "Activate"}
      </Button>
    );
  }

  const isLoading = usersQuery.isLoading || roomsQuery.isLoading;

  return (
    <div className="min-h-screen bg-[#080A0F] text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-1 text-xs font-semibold text-[#F59E0B]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Root Admin Console
            </div>
            <h1 className="text-3xl font-semibold">System dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
              Quản lý toàn bộ rooms, users, members và account approval. Giao
              diện này tách riêng khỏi member dashboard và chỉ mở cho role admin.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => window.location.assign("/")}
          >
            Về app dashboard
          </Button>
        </header>

        <Tabs
          value={activeSection}
          onValueChange={(value) => setActiveSection(value as AdminSection)}
        >
          <TabsList className="grid h-auto w-full grid-cols-2 bg-white/10 text-white/60 md:w-fit md:grid-cols-5">
            {sectionTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 data-[state=active]:bg-[#F59E0B] data-[state=active]:text-black"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spinner className="size-8 text-[#F59E0B]" />
          </div>
        ) : null}

        {!isLoading && activeSection === "overview" ? (
          <section className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              {renderMetric("Rooms", rooms.length, Home)}
              {renderMetric("Members", totalMembers, Users)}
              {renderMetric("Accounts", users.length, UserPlus)}
              {renderMetric("Admins", adminUsers.length, ShieldCheck)}
              {renderMetric("Tasks", operations?.summary.tasks ?? 0, ClipboardList)}
              {renderMetric("Rewards", operations?.summary.rewards ?? 0, Gift)}
              {renderMetric("Wallets", operations?.summary.wallets ?? 0, Wallet)}
              {renderMetric("Wheel spins", operations?.summary.wheelSpins ?? 0, Activity)}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                <h2 className="text-base font-semibold">Rooms gần đây</h2>
                <div className="mt-4 space-y-3">
                  {rooms.slice(0, 5).map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {room.name}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Owner: {room.owner?.name ?? `User #${room.ownerId}`} ·{" "}
                          {room.members.length} members
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-[#F59E0B]/30 text-[#F59E0B]"
                      >
                        {room.roomCode ?? "No code"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                <h2 className="text-base font-semibold">Pending approvals</h2>
                <p className="mt-2 text-3xl font-semibold text-[#F59E0B]">
                  {pendingRegistrations.length}
                </p>
                <p className="mt-2 text-sm text-white/45">
                  Yêu cầu đăng ký đang chờ root admin duyệt.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {!isLoading && activeSection === "rooms" ? (
          <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <aside className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Plus className="h-4 w-4 text-[#F59E0B]" />
                  Tạo room
                </h2>
                <div className="mt-4 space-y-3">
                  <Input
                    value={newRoomName}
                    onChange={(event) => setNewRoomName(event.target.value)}
                    placeholder="Tên room"
                    className="border-white/10 bg-[#1D2230] text-white"
                  />
                  <select
                    value={newRoomOwnerId}
                    onChange={(event) => setNewRoomOwnerId(event.target.value)}
                    className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                  >
                    <option value="">Owner: chính admin hiện tại</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name ?? user.email ?? user.unionId} ({user.role})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    className="w-full bg-[#F59E0B] text-black hover:bg-[#D97706]"
                    disabled={!newRoomName.trim() || createRoomMutation.isPending}
                    onClick={submitRoom}
                  >
                    Tạo room
                  </Button>
                  {createRoomMutation.error ? (
                    <p className="text-xs text-[#FF6B6B]">
                      {createRoomMutation.error.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <UserPlus className="h-4 w-4 text-[#F59E0B]" />
                  {editingMemberId ? "Sửa member" : "Thêm member"}
                </h2>
                <div className="mt-4 space-y-3">
                  <select
                    value={memberRoomId}
                    onChange={(event) => setMemberRoomId(event.target.value)}
                    disabled={!!editingMemberId}
                    className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value="">Chọn room</option>
                    {roomOptions.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={memberUserId}
                    onChange={(event) => setMemberUserId(event.target.value)}
                    disabled={!!editingMemberId}
                    className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    <option value="">Placeholder member</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name ?? user.email ?? user.unionId}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={memberNickname}
                    onChange={(event) => setMemberNickname(event.target.value)}
                    placeholder="Nickname"
                    className="border-white/10 bg-[#1D2230] text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={memberRole}
                      onChange={(event) =>
                        setMemberRole(event.target.value as MemberRole)
                      }
                      className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                    >
                      <option value="dominant">Creator</option>
                      <option value="submissive">Receiver</option>
                      <option value="switch">Switch</option>
                    </select>
                    <select
                      value={memberGender}
                      onChange={(event) =>
                        setMemberGender(event.target.value as Gender)
                      }
                      className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                    >
                      <option value="other">Khác</option>
                      <option value="female">Nữ</option>
                      <option value="male">Nam</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                      disabled={
                        !memberNickname.trim() ||
                        (!editingMemberId && !memberRoomId) ||
                        addMemberMutation.isPending ||
                        updateMemberMutation.isPending
                      }
                      onClick={submitMember}
                    >
                      {editingMemberId ? "Lưu member" : "Thêm member"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={resetMemberForm}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-4">
              {rooms.length === 0 ? (
                <Empty className="border border-white/10 bg-[#11141D]">
                  <EmptyHeader>
                    <EmptyTitle>Chưa có room</EmptyTitle>
                    <EmptyDescription>
                      Tạo room đầu tiên và gán owner ở panel bên trái.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {rooms.map((room) => {
                const isEditing = editingRoomId === room.id;
                return (
                  <div
                    key={room.id}
                    className="rounded-lg border border-white/10 bg-[#11141D] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-semibold">
                            {room.name}
                          </h2>
                          <Badge
                            variant="outline"
                            className="border-[#F59E0B]/30 text-[#F59E0B]"
                          >
                            {room.roomCode ?? "No code"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-white/45">
                          Owner: {room.owner?.name ?? `User #${room.ownerId}`} ·{" "}
                          {room.members.length} members · Created{" "}
                          {formatDate(room.createdAt)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => startEditRoom(room)}
                        >
                          <Settings />
                          Sửa
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteRoomMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Xóa room ${room.name}?`)) {
                              deleteRoomMutation.mutate({ houseId: room.id });
                            }
                          }}
                        >
                          <Trash2 />
                          Xóa
                        </Button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-4 grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                        <Input
                          value={roomEditName}
                          onChange={(event) => setRoomEditName(event.target.value)}
                          className="border-white/10 bg-[#1D2230] text-white"
                        />
                        <select
                          value={roomEditOwnerId}
                          onChange={(event) =>
                            setRoomEditOwnerId(event.target.value)
                          }
                          className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                        >
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name ?? user.email ?? user.unionId}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                          onClick={submitRoomEdit}
                        >
                          Lưu
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => setEditingRoomId(null)}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : null}

                    <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="text-white/60">Member</TableHead>
                            <TableHead className="text-white/60">Account</TableHead>
                            <TableHead className="text-white/60">Role</TableHead>
                            <TableHead className="text-white/60">Gender</TableHead>
                            <TableHead className="text-right text-white/60">
                              Actions
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {room.members.map((member) => (
                            <TableRow
                              key={member.id}
                              className="border-white/10 hover:bg-white/[0.03]"
                            >
                              <TableCell className="font-medium text-white">
                                {member.nickname ?? "Member"}
                              </TableCell>
                              <TableCell className="text-white/65">
                                {member.user?.email ??
                                  member.user?.unionId ??
                                  "Placeholder"}
                              </TableCell>
                              <TableCell>
                                {memberRoleLabels[member.lifestyleRole]}
                              </TableCell>
                              <TableCell>{genderLabels[member.gender]}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                                    onClick={() => startEditMember(member)}
                                  >
                                    Sửa
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={removeMemberMutation.isPending}
                                    onClick={() =>
                                      removeMemberMutation.mutate({
                                        memberId: member.id,
                                      })
                                    }
                                  >
                                    Xóa
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {!isLoading && activeSection === "users" ? (
          <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <aside className="rounded-lg border border-white/10 bg-[#11141D] p-4">
              <h2 className="text-base font-semibold">Tạo account</h2>
              <div className="mt-4 space-y-3">
                <Input
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="Tên"
                  className="border-white/10 bg-[#1D2230] text-white"
                />
                <Input
                  value={accountEmail}
                  onChange={(event) => setAccountEmail(event.target.value)}
                  placeholder="Email"
                  className="border-white/10 bg-[#1D2230] text-white"
                />
                <Input
                  value={accountUsername}
                  onChange={(event) => setAccountUsername(event.target.value)}
                  placeholder="Username optional"
                  className="border-white/10 bg-[#1D2230] text-white"
                />
                <Input
                  value={accountPassword}
                  onChange={(event) => setAccountPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  className="border-white/10 bg-[#1D2230] text-white"
                />
                <select
                  value={accountRole}
                  onChange={(event) =>
                    setAccountRole(event.target.value as AccountRole)
                  }
                  className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                >
                  <option value="user">Member user</option>
                  <option value="admin">Root admin</option>
                </select>
                <Button
                  type="button"
                  className="w-full bg-[#F59E0B] text-black hover:bg-[#D97706]"
                  disabled={
                    !accountName.trim() ||
                    !accountEmail.trim() ||
                    !accountPassword ||
                    createAccountMutation.isPending
                  }
                  onClick={submitAccount}
                >
                  Tạo account
                </Button>
                {createAccountMutation.error ? (
                  <p className="text-xs text-[#FF6B6B]">
                    {createAccountMutation.error.message}
                  </p>
                ) : null}
              </div>
            </aside>

            <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-white/60">Account</TableHead>
                    <TableHead className="text-white/60">Login info</TableHead>
                    <TableHead className="text-white/60">Role / Password</TableHead>
                    <TableHead className="text-white/60">Last sign in</TableHead>
                    <TableHead className="text-right text-white/60">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-white/10 hover:bg-white/[0.03]"
                    >
                      <TableCell>
                        <Input
                          id={`user-${user.id}-name`}
                          defaultValue={user.name ?? ""}
                          placeholder="Name"
                          className="border-white/10 bg-[#1D2230] text-white"
                        />
                        <p className="mt-1 max-w-xs truncate text-xs text-white/45">
                          ID #{user.id} · {user.unionId}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Input
                          id={`user-${user.id}-email`}
                          defaultValue={user.credentialEmail ?? user.email ?? ""}
                          placeholder="Email"
                          className="border-white/10 bg-[#1D2230] text-white"
                        />
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <Input
                            id={`user-${user.id}-username`}
                            defaultValue={user.username ?? ""}
                            placeholder="Username"
                            className="border-white/10 bg-[#1D2230] text-white"
                          />
                          <Input
                            id={`user-${user.id}-phone`}
                            defaultValue={user.phone ?? ""}
                            placeholder="Phone"
                            className="border-white/10 bg-[#1D2230] text-white"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <select
                          id={`user-${user.id}-role`}
                          defaultValue={user.role}
                          className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                        <Input
                          id={`user-${user.id}-password`}
                          placeholder="New password optional"
                          type="password"
                          className="mt-2 border-white/10 bg-[#1D2230] text-white"
                        />
                      </TableCell>
                      <TableCell className="text-white/60">
                        {formatDate(user.lastSignInAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                            disabled={updateUserAccountMutation.isPending}
                            onClick={() => submitUserAccount(user.id)}
                          >
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deleteUserAccountMutation.isPending}
                            onClick={() =>
                              deleteUserAccount(
                                user.id,
                                user.name ?? user.email ?? `#${user.id}`,
                              )
                            }
                          >
                            Xóa
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {!isLoading && activeSection === "operations" ? (
          <section className="grid gap-4">
            <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    Root operations control
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    Dữ liệu lấy trực tiếp từ database hiện tại, trên tất cả rooms.
                  </p>
                </div>
                {operationsQuery.isFetching ? (
                  <Spinner className="size-5 text-[#F59E0B]" />
                ) : null}
              </div>
              <Tabs
                value={activeOperationSection}
                onValueChange={(value) =>
                  setActiveOperationSection(value as OperationSection)
                }
              >
                <TabsList className="mt-4 grid h-auto w-full grid-cols-2 bg-white/10 text-white/60 lg:grid-cols-6">
                  {operationTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="gap-2 data-[state=active]:bg-[#F59E0B] data-[state=active]:text-black"
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            {!operations && operationsQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Spinner className="size-8 text-[#F59E0B]" />
              </div>
            ) : null}

            {operations && activeOperationSection === "tasks" ? (
              <div className="grid gap-4">
                <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                  <h3 className="font-semibold text-white">Tạo task toàn hệ thống</h3>
                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <select id="admin-task-house" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                    <Input id="admin-task-title" placeholder="Tên task" className="border-white/10 bg-[#1D2230] text-white" />
                    <Input id="admin-task-description" placeholder="Mô tả" className="border-white/10 bg-[#1D2230] text-white" />
                    <select id="admin-task-category" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      <option value="daily">daily</option>
                      <option value="weekly">weekly</option>
                      <option value="monthly">monthly</option>
                      <option value="special">special</option>
                      <option value="superSpecial">superSpecial</option>
                    </select>
                    <Input id="admin-task-chym" type="number" min={0} defaultValue={0} placeholder="Chym" className="border-white/10 bg-[#1D2230] text-white" />
                    <Input id="admin-task-chay" type="number" min={0} defaultValue={0} placeholder="Chay" className="border-white/10 bg-[#1D2230] text-white" />
                    <select id="admin-task-assigned-to" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      <option value="">Chưa assign</option>
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <select id="admin-task-created-by" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <select id="admin-task-status" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      <option value="pending">pending</option>
                      <option value="active">active</option>
                      <option value="submitted">submitted</option>
                      <option value="completed">completed</option>
                      <option value="failed">failed</option>
                    </select>
                    <Button type="button" className="bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={submitCreateTask}>
                      Tạo task
                    </Button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Task</TableHead>
                        <TableHead className="text-white/60">Room</TableHead>
                        <TableHead className="text-white/60">Assigned</TableHead>
                        <TableHead className="text-white/60">Reward/Penalty</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.tasks.map((task) => (
                        <TableRow key={task.id} className="border-white/10">
                          <TableCell>
                            <Input id={`task-${task.id}-title`} defaultValue={task.title} className="border-white/10 bg-[#1D2230] text-white" />
                            <Input id={`task-${task.id}-description`} defaultValue={task.description ?? ""} className="mt-2 border-white/10 bg-[#1D2230] text-white" />
                          </TableCell>
                          <TableCell className="text-white/65">{task.roomName}</TableCell>
                          <TableCell>
                            <select id={`task-${task.id}-assigned-to`} defaultValue={task.assignedTo ?? ""} className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                              <option value="">Chưa assign</option>
                              {memberOptions.map((member) => (
                                <option key={member.id} value={member.id}>{member.label}</option>
                              ))}
                            </select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Input id={`task-${task.id}-chym`} type="number" min={0} defaultValue={task.chymReward} className="w-20 border-white/10 bg-[#1D2230] text-white" />
                              <Input id={`task-${task.id}-chay`} type="number" min={0} defaultValue={task.chayPenalty} className="w-20 border-white/10 bg-[#1D2230] text-white" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <select
                              id={`task-${task.id}-status`}
                              value={task.status}
                              onChange={(event) =>
                                updateTaskStatusMutation.mutate({
                                  taskId: task.id,
                                  status: event.target.value as
                                    | "pending"
                                    | "active"
                                    | "submitted"
                                    | "completed"
                                    | "failed",
                                })
                              }
                              className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                            >
                              <option value="pending">pending</option>
                              <option value="active">active</option>
                              <option value="submitted">submitted</option>
                              <option value="completed">completed</option>
                              <option value="failed">failed</option>
                            </select>
                            <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                                onClick={() =>
                                  updateTaskMutation.mutate({
                                    taskId: task.id,
                                    title: inputValue(`task-${task.id}-title`),
                                    description: inputValue(`task-${task.id}-description`) || undefined,
                                    category: task.category,
                                    chymReward: inputNumber(`task-${task.id}-chym`),
                                    chayPenalty: inputNumber(`task-${task.id}-chay`),
                                    assignedTo: inputNumber(`task-${task.id}-assigned-to`) || undefined,
                                    status: inputValue(`task-${task.id}-status`) as
                                      | "pending"
                                      | "active"
                                      | "submitted"
                                      | "completed"
                                      | "failed",
                                  })
                                }
                              >
                                Lưu
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (window.confirm(`Xóa task ${task.title}?`)) {
                                    deleteTaskMutation.mutate({ taskId: task.id });
                                  }
                                }}
                              >
                                Xóa
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                  <h3 className="font-semibold text-white">Assign privilege</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <select id="admin-privilege-assignment-privilege" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {operations.privileges.map((privilege) => (
                        <option key={privilege.id} value={privilege.id}>{privilege.title}</option>
                      ))}
                    </select>
                    <select id="admin-privilege-assignment-member" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <select id="admin-privilege-assignment-by" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <select id="admin-privilege-assignment-status" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      <option value="active">active</option>
                      <option value="used">used</option>
                      <option value="expired">expired</option>
                    </select>
                    <Button type="button" className="bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={submitCreatePrivilegeAssignment}>
                      Assign
                    </Button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Submission</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.taskSubmissions.map((submission) => (
                        <TableRow key={submission.id} className="border-white/10">
                          <TableCell>
                            <p className="font-medium text-white">
                              {submission.taskTitle}
                            </p>
                            <p className="mt-1 line-clamp-1 text-xs text-white/45">
                              {submission.note || submission.proofUrl || "-"}
                            </p>
                          </TableCell>
                          <TableCell className="text-white/65">
                            {submission.memberName}
                          </TableCell>
                          <TableCell>
                            <select
                              value={submission.status}
                              onChange={(event) =>
                                updateTaskSubmissionStatusMutation.mutate({
                                  submissionId: submission.id,
                                  status: event.target.value as
                                    | "submitted"
                                    | "approved"
                                    | "rejected",
                                })
                              }
                              className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                            >
                              <option value="submitted">submitted</option>
                              <option value="approved">approved</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteOperationRecord(
                                  "taskSubmission",
                                  submission.id,
                                )
                              }
                            >
                              Xóa
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Privilege</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.privilegeAssignments.map((assignment) => (
                        <TableRow key={assignment.id} className="border-white/10">
                          <TableCell>
                            <p className="font-medium text-white">
                              {assignment.privilegeTitle}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              Assigned by {assignment.assignedByName ?? "-"}
                            </p>
                          </TableCell>
                          <TableCell className="text-white/65">
                            {assignment.memberName}
                          </TableCell>
                          <TableCell>
                            <select
                              value={assignment.status}
                              onChange={(event) =>
                                updatePrivilegeAssignmentStatusMutation.mutate({
                                  assignmentId: assignment.id,
                                  status: event.target.value as
                                    | "active"
                                    | "used"
                                    | "expired",
                                })
                              }
                              className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                            >
                              <option value="active">active</option>
                              <option value="used">used</option>
                              <option value="expired">expired</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteOperationRecord(
                                  "privilegeAssignment",
                                  assignment.id,
                                )
                              }
                            >
                              Xóa
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {operations && activeOperationSection === "shop" ? (
              <div className="grid gap-4">
                <div className="grid gap-4 xl:grid-cols-3">
                  {(["reward", "privilege"] as const).map((type) => (
                    <div key={type} className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                      <h3 className="font-semibold text-white">
                        Tạo {type === "reward" ? "reward" : "privilege"}
                      </h3>
                      <div className="mt-4 space-y-3">
                        <select id={`admin-${type}-house`} className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                          {rooms.map((room) => (
                            <option key={room.id} value={room.id}>{room.name}</option>
                          ))}
                        </select>
                        <Input id={`admin-${type}-title`} placeholder="Tên" className="border-white/10 bg-[#1D2230] text-white" />
                        <Input id={`admin-${type}-description`} placeholder="Mô tả" className="border-white/10 bg-[#1D2230] text-white" />
                        {type === "reward" ? (
                          <Input id={`admin-${type}-cost`} type="number" min={0} defaultValue={0} placeholder="Cost chym" className="border-white/10 bg-[#1D2230] text-white" />
                        ) : null}
                        <select id={`admin-${type}-rarity`} className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                          <option value="common">common</option>
                          <option value="rare">rare</option>
                          <option value="epic">epic</option>
                          <option value="legendary">legendary</option>
                        </select>
                        <select id={`admin-${type}-created-by`} className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                          {memberOptions.map((member) => (
                            <option key={member.id} value={member.id}>{member.label}</option>
                          ))}
                        </select>
                        <Button type="button" className="w-full bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={() => submitCreateCatalog(type)}>
                          Tạo {type}
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                    <h3 className="font-semibold text-white">Tạo gift/purchase</h3>
                    <div className="mt-4 space-y-3">
                      <select id="admin-gift-reward" className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {operations.rewards.map((reward) => (
                          <option key={reward.id} value={reward.id}>{reward.title}</option>
                        ))}
                      </select>
                      <select id="admin-gift-member" className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>{member.label}</option>
                        ))}
                      </select>
                      <select id="admin-gift-by" className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        <option value="">Không phải gift</option>
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>{member.label}</option>
                        ))}
                      </select>
                      <select id="admin-gift-status" className="w-full rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        <option value="active">active</option>
                        <option value="used">used</option>
                        <option value="expired">expired</option>
                      </select>
                      <Input id="admin-gift-message" placeholder="Gift message" className="border-white/10 bg-[#1D2230] text-white" />
                      <Input id="admin-gift-reason" placeholder="Gift reason" className="border-white/10 bg-[#1D2230] text-white" />
                      <Button type="button" className="w-full bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={submitCreateRewardPurchase}>
                        Tạo gift/purchase
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {[...operations.rewards.map((item) => ({ ...item, kind: "reward" as const })), ...operations.privileges.map((item) => ({ ...item, kind: "privilege" as const }))].map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="rounded-lg border border-white/10 bg-[#11141D] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Badge
                            variant="outline"
                            className="border-[#F59E0B]/30 text-[#F59E0B]"
                          >
                            {item.kind}
                          </Badge>
                          <Input id={`${item.kind}-${item.id}-title`} defaultValue={item.title} className="border-white/10 bg-[#1D2230] text-white" />
                          <Input id={`${item.kind}-${item.id}-description`} defaultValue={item.description ?? ""} className="border-white/10 bg-[#1D2230] text-white" />
                          <p className="mt-1 text-sm text-white/45">
                            {item.roomName} · {item.rarity}
                            {"cost" in item ? ` · ${item.cost} chym` : ""}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {"cost" in item ? (
                              <Input id={`${item.kind}-${item.id}-cost`} type="number" min={0} defaultValue={item.cost} className="w-24 border-white/10 bg-[#1D2230] text-white" />
                            ) : null}
                            <select id={`${item.kind}-${item.id}-rarity`} defaultValue={item.rarity} className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                              <option value="common">common</option>
                              <option value="rare">rare</option>
                              <option value="epic">epic</option>
                              <option value="legendary">legendary</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {renderActiveToggle(item.kind, item.id, item.isActive)}
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                            onClick={() =>
                              updateCatalogItemMutation.mutate({
                                type: item.kind,
                                id: item.id,
                                title: inputValue(`${item.kind}-${item.id}-title`),
                                description:
                                  inputValue(`${item.kind}-${item.id}-description`) ||
                                  undefined,
                                cost:
                                  item.kind === "reward"
                                    ? inputNumber(`${item.kind}-${item.id}-cost`)
                                    : undefined,
                                rarity: inputValue(`${item.kind}-${item.id}-rarity`) as
                                  | "common"
                                  | "rare"
                                  | "epic"
                                  | "legendary",
                                isActive: item.isActive,
                              })
                            }
                          >
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm(`Xóa ${item.title}?`)) {
                                deleteCatalogItemMutation.mutate({
                                  type: item.kind,
                                  id: item.id,
                                });
                              }
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Purchase/Gift</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.rewardPurchases.map((purchase) => (
                        <TableRow key={purchase.id} className="border-white/10">
                          <TableCell>
                            <p className="font-medium text-white">
                              {purchase.rewardTitle}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              Gift by {purchase.giftedByName ?? "-"} ·{" "}
                              {purchase.gift?.giftMessage ?? "No message"}
                            </p>
                          </TableCell>
                          <TableCell className="text-white/65">
                            {purchase.memberName}
                          </TableCell>
                          <TableCell>
                            <select
                              value={purchase.status}
                              onChange={(event) =>
                                updateRewardPurchaseStatusMutation.mutate({
                                  purchaseId: purchase.id,
                                  status: event.target.value as
                                    | "active"
                                    | "used"
                                    | "expired",
                                })
                              }
                              className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                            >
                              <option value="active">active</option>
                              <option value="used">used</option>
                              <option value="expired">expired</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteOperationRecord("rewardPurchase", purchase.id)
                              }
                            >
                              Xóa
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {operations && activeOperationSection === "wallet" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Chym</TableHead>
                        <TableHead className="text-white/60">Chay</TableHead>
                        <TableHead className="text-white/60">XP</TableHead>
                        <TableHead className="text-white/60">Level</TableHead>
                        <TableHead className="text-right text-white/60">Save</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.wallets.map((wallet) => (
                        <TableRow key={wallet.id} className="border-white/10">
                          <TableCell>
                            <p className="font-medium text-white">
                              {wallet.memberName}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {wallet.roomName}
                            </p>
                          </TableCell>
                          {(["chymBalance", "chayBalance", "xp", "level"] as const).map((field) => (
                            <TableCell key={field}>
                              <Input
                                type="number"
                                defaultValue={wallet[field]}
                                min={field === "level" ? 1 : 0}
                                id={`wallet-${wallet.memberId}-${field}`}
                                className="w-20 border-white/10 bg-[#1D2230] text-white"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                              onClick={() => {
                                const read = (field: string) =>
                                  Number(
                                    (
                                      document.getElementById(
                                        `wallet-${wallet.memberId}-${field}`,
                                      ) as HTMLInputElement | null
                                    )?.value ?? 0,
                                  );
                                updateWalletProgressMutation.mutate({
                                  memberId: wallet.memberId,
                                  chymBalance: read("chymBalance"),
                                  chayBalance: read("chayBalance"),
                                  xp: read("xp"),
                                  level: Math.max(1, read("level")),
                                });
                              }}
                            >
                              Lưu
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Streak</TableHead>
                        <TableHead className="text-white/60">Current</TableHead>
                        <TableHead className="text-white/60">Longest</TableHead>
                        <TableHead className="text-right text-white/60">Save</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.streaks.map((streak) => (
                        <TableRow key={streak.id} className="border-white/10">
                          <TableCell>
                            <p className="font-medium text-white">
                              {streak.memberName}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {streak.sourceTitle}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              defaultValue={streak.currentStreak}
                              min={0}
                              id={`streak-${streak.id}-current`}
                              className="w-20 border-white/10 bg-[#1D2230] text-white"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              defaultValue={streak.longestStreak}
                              min={0}
                              id={`streak-${streak.id}-longest`}
                              className="w-20 border-white/10 bg-[#1D2230] text-white"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                              onClick={() =>
                                updateStreakMutation.mutate({
                                  streakId: streak.id,
                                  currentStreak: Number(
                                    (
                                      document.getElementById(
                                        `streak-${streak.id}-current`,
                                      ) as HTMLInputElement | null
                                    )?.value ?? 0,
                                  ),
                                  longestStreak: Number(
                                    (
                                      document.getElementById(
                                        `streak-${streak.id}-longest`,
                                      ) as HTMLInputElement | null
                                    )?.value ?? 0,
                                  ),
                                })
                              }
                            >
                              Lưu
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {operations && activeOperationSection === "punishments" ? (
              <div className="grid gap-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                    <h3 className="font-semibold text-white">Tạo punishment</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <select id="admin-punishment-house" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>{room.name}</option>
                        ))}
                      </select>
                      <select id="admin-punishment-created-by" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>{member.label}</option>
                        ))}
                      </select>
                      <Input id="admin-punishment-title" placeholder="Tên punishment" className="border-white/10 bg-[#1D2230] text-white" />
                      <Input id="admin-punishment-chay-cost" type="number" min={0} defaultValue={0} placeholder="Chay cost" className="border-white/10 bg-[#1D2230] text-white" />
                      <Input id="admin-punishment-description" placeholder="Mô tả" className="border-white/10 bg-[#1D2230] text-white md:col-span-2" />
                      <Button type="button" className="bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={() => submitCreateCatalog("punishment")}>
                        Tạo punishment
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                    <h3 className="font-semibold text-white">Assign punishment</h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <select id="admin-punishment-assignment-punishment" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {operations.punishments.map((punishment) => (
                          <option key={punishment.id} value={punishment.id}>{punishment.title}</option>
                        ))}
                      </select>
                      <select id="admin-punishment-assignment-member" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>{member.label}</option>
                        ))}
                      </select>
                      <select id="admin-punishment-assignment-by" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        {memberOptions.map((member) => (
                          <option key={member.id} value={member.id}>{member.label}</option>
                        ))}
                      </select>
                      <select id="admin-punishment-assignment-status" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                        <option value="active">active</option>
                        <option value="redeemed">redeemed</option>
                        <option value="forgiven">forgiven</option>
                      </select>
                      <Input id="admin-punishment-assignment-checklist" placeholder="Checklist" className="border-white/10 bg-[#1D2230] text-white md:col-span-2" />
                      <Button type="button" className="bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={submitCreatePunishmentAssignment}>
                        Assign
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {operations.punishments.map((punishment) => (
                    <div
                      key={punishment.id}
                      className="rounded-lg border border-white/10 bg-[#11141D] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input id={`punishment-${punishment.id}-title`} defaultValue={punishment.title} className="border-white/10 bg-[#1D2230] text-white" />
                          <Input id={`punishment-${punishment.id}-description`} defaultValue={punishment.description ?? ""} className="border-white/10 bg-[#1D2230] text-white" />
                          <Input id={`punishment-${punishment.id}-chay-cost`} type="number" min={0} defaultValue={punishment.chayCost} className="w-28 border-white/10 bg-[#1D2230] text-white" />
                          <p className="mt-1 text-sm text-white/45">
                            {punishment.roomName} · {punishment.chayCost} chay
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {renderActiveToggle("punishment", punishment.id, punishment.isActive)}
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                            onClick={() =>
                              updateCatalogItemMutation.mutate({
                                type: "punishment",
                                id: punishment.id,
                                title: inputValue(`punishment-${punishment.id}-title`),
                                description:
                                  inputValue(`punishment-${punishment.id}-description`) ||
                                  undefined,
                                chayCost: inputNumber(`punishment-${punishment.id}-chay-cost`),
                                isActive: punishment.isActive,
                              })
                            }
                          >
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm(`Xóa ${punishment.title}?`)) {
                                deleteCatalogItemMutation.mutate({
                                  type: "punishment",
                                  id: punishment.id,
                                });
                              }
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Assignment</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.punishmentAssignments.map((assignment) => (
                        <TableRow key={assignment.id} className="border-white/10">
                          <TableCell className="font-medium text-white">
                            {assignment.punishmentTitle}
                          </TableCell>
                          <TableCell className="text-white/65">
                            {assignment.memberName}
                          </TableCell>
                          <TableCell>
                            <select
                              value={assignment.status}
                              onChange={(event) =>
                                updatePunishmentAssignmentStatusMutation.mutate({
                                  assignmentId: assignment.id,
                                  status: event.target.value as
                                    | "active"
                                    | "redeemed"
                                    | "forgiven",
                                })
                              }
                              className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                            >
                              <option value="active">active</option>
                              <option value="redeemed">redeemed</option>
                              <option value="forgiven">forgiven</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteOperationRecord(
                                  "punishmentAssignment",
                                  assignment.id,
                                )
                              }
                            >
                              Xóa
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {operations && activeOperationSection === "notebook" ? (
              <div className="grid gap-4">
                <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                  <h3 className="font-semibold text-white">Tạo note</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-5">
                    <select id="admin-note-member" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <Input id="admin-note-title" placeholder="Tiêu đề" className="border-white/10 bg-[#1D2230] text-white" />
                    <Input id="admin-note-content" placeholder="Nội dung" className="border-white/10 bg-[#1D2230] text-white" />
                    <select id="admin-note-visibility" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      <option value="private">private</option>
                      <option value="public">public</option>
                    </select>
                    <Button type="button" className="bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={submitCreateNote}>
                      Tạo note
                    </Button>
                  </div>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Note</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Visibility</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.notes.map((note) => (
                        <TableRow key={note.id} className="border-white/10">
                          <TableCell>
                            <Input id={`note-${note.id}-title`} defaultValue={note.title} className="border-white/10 bg-[#1D2230] text-white" />
                            <Input id={`note-${note.id}-content`} defaultValue={note.content ?? ""} className="mt-2 border-white/10 bg-[#1D2230] text-white" />
                          </TableCell>
                          <TableCell className="text-white/65">
                            {note.memberName}
                          </TableCell>
                          <TableCell>
                            <select id={`note-${note.id}-visibility`} defaultValue={note.visibility} className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                              <option value="private">private</option>
                              <option value="public">public</option>
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                                onClick={() =>
                                  updateNoteMutation.mutate({
                                    noteId: note.id,
                                    title: inputValue(`note-${note.id}-title`),
                                    content: inputValue(`note-${note.id}-content`) || undefined,
                                    visibility: inputValue(`note-${note.id}-visibility`) as
                                      | "public"
                                      | "private",
                                  })
                                }
                              >
                                Lưu
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => deleteOperationRecord("note", note.id)}
                              >
                                Xóa
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Agreement</TableHead>
                        <TableHead className="text-white/60">Room</TableHead>
                        <TableHead className="text-white/60">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.agreements.map((agreement) => (
                        <TableRow key={agreement.id} className="border-white/10">
                          <TableCell className="font-medium text-white">
                            {agreement.title}
                          </TableCell>
                          <TableCell className="text-white/65">
                            {agreement.roomName}
                          </TableCell>
                          <TableCell>
                            <select
                              value={agreement.status}
                              onChange={(event) =>
                                updateAgreementStatusMutation.mutate({
                                  agreementId: agreement.id,
                                  status: event.target.value as
                                    | "pending"
                                    | "active"
                                    | "void",
                                })
                              }
                              className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                            >
                              <option value="pending">pending</option>
                              <option value="active">active</option>
                              <option value="void">void</option>
                            </select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                </div>
              </div>
            ) : null}

            {operations && activeOperationSection === "activity" ? (
              <div className="grid gap-4">
                <div className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                  <h3 className="font-semibold text-white">Tạo wheel</h3>
                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <select id="admin-wheel-house" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>{room.name}</option>
                      ))}
                    </select>
                    <Input id="admin-wheel-title" placeholder="Tên wheel" className="border-white/10 bg-[#1D2230] text-white" />
                    <Input id="admin-wheel-description" placeholder="Mô tả" className="border-white/10 bg-[#1D2230] text-white" />
                    <select id="admin-wheel-assigned-to" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      <option value="">Không assign</option>
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <select id="admin-wheel-created-by" className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                      {memberOptions.map((member) => (
                        <option key={member.id} value={member.id}>{member.label}</option>
                      ))}
                    </select>
                    <Input id="admin-wheel-options" defaultValue='[{"label":"Option 1","weight":1},{"label":"Option 2","weight":1}]' className="border-white/10 bg-[#1D2230] text-white lg:col-span-2" />
                    <Button type="button" className="bg-[#F59E0B] text-black hover:bg-[#D97706]" onClick={() => submitCreateCatalog("wheel")}>
                      Tạo wheel
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {operations.wheels.map((wheel) => (
                    <div key={wheel.id} className="rounded-lg border border-white/10 bg-[#11141D] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <Input id={`wheel-${wheel.id}-title`} defaultValue={wheel.title} className="border-white/10 bg-[#1D2230] text-white" />
                          <Input id={`wheel-${wheel.id}-description`} defaultValue={wheel.description ?? ""} className="border-white/10 bg-[#1D2230] text-white" />
                          <Input id={`wheel-${wheel.id}-options`} defaultValue={wheel.options} className="border-white/10 bg-[#1D2230] text-white" />
                          <select id={`wheel-${wheel.id}-assigned-to`} defaultValue={wheel.assignedTo ?? ""} className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white">
                            <option value="">Không assign</option>
                            {memberOptions.map((member) => (
                              <option key={member.id} value={member.id}>{member.label}</option>
                            ))}
                          </select>
                          <p className="text-sm text-white/45">{wheel.roomName}</p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          {renderActiveToggle("wheel", wheel.id, wheel.isActive)}
                          <Button
                            type="button"
                            size="sm"
                            className="bg-[#F59E0B] text-black hover:bg-[#D97706]"
                            onClick={() =>
                              updateCatalogItemMutation.mutate({
                                type: "wheel",
                                id: wheel.id,
                                title: inputValue(`wheel-${wheel.id}-title`),
                                description:
                                  inputValue(`wheel-${wheel.id}-description`) ||
                                  undefined,
                                options: inputValue(`wheel-${wheel.id}-options`),
                                assignedTo: inputNumber(`wheel-${wheel.id}-assigned-to`) || undefined,
                                isActive: wheel.isActive,
                              })
                            }
                          >
                            Lưu
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (window.confirm(`Xóa wheel ${wheel.title}?`)) {
                                deleteCatalogItemMutation.mutate({
                                  type: "wheel",
                                  id: wheel.id,
                                });
                              }
                            }}
                          >
                            Xóa
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10 hover:bg-transparent">
                        <TableHead className="text-white/60">Wheel spin</TableHead>
                        <TableHead className="text-white/60">Member</TableHead>
                        <TableHead className="text-white/60">Result</TableHead>
                        <TableHead className="text-right text-white/60">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operations.wheelSpins.map((spin) => (
                        <TableRow key={spin.id} className="border-white/10">
                          <TableCell className="font-medium text-white">
                            {spin.wheelTitle}
                          </TableCell>
                          <TableCell className="text-white/65">
                            {spin.memberName}
                          </TableCell>
                          <TableCell className="text-white/65">{spin.result}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteOperationRecord("wheelSpin", spin.id)
                              }
                            >
                              Xóa
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {!isLoading && activeSection === "registrations" ? (
          <section className="grid gap-4">
            <Tabs
              value={registrationStatus}
              onValueChange={(value) =>
                setRegistrationStatus(value as RegistrationStatus)
              }
            >
              <TabsList className="grid h-auto w-full grid-cols-2 bg-white/10 text-white/60 sm:w-fit sm:grid-cols-4">
                {registrationTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-[#F59E0B] data-[state=active]:text-black"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {registrationsQuery.isLoading ? (
              <div className="flex min-h-48 items-center justify-center">
                <Spinner className="size-8 text-[#F59E0B]" />
              </div>
            ) : null}

            {!registrationsQuery.isLoading && registrations.length === 0 ? (
              <Empty className="border border-white/10 bg-[#11141D]">
                <EmptyHeader>
                  <EmptyTitle>Không có yêu cầu đăng ký</EmptyTitle>
                  <EmptyDescription>
                    Tab hiện tại không có bản ghi nào.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}

            {!registrationsQuery.isLoading && registrations.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-white/10 bg-[#11141D]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/60">Tên</TableHead>
                      <TableHead className="text-white/60">Email</TableHead>
                      <TableHead className="text-white/60">Username</TableHead>
                      <TableHead className="text-white/60">Vai trò</TableHead>
                      <TableHead className="text-white/60">Giới tính</TableHead>
                      <TableHead className="text-white/60">Ngày tạo</TableHead>
                      {registrationStatus === "pending" ? (
                        <TableHead className="text-right text-white/60">
                          Thao tác
                        </TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrations.map((registration) => (
                      <TableRow
                        key={registration.id}
                        className="border-white/10 hover:bg-white/[0.03]"
                      >
                        <TableCell className="font-medium text-white">
                          {registration.name}
                        </TableCell>
                        <TableCell className="break-all text-white/75">
                          {registration.email}
                        </TableCell>
                        <TableCell className="text-white/65">
                          {registration.username || "-"}
                        </TableCell>
                        <TableCell>
                          {memberRoleLabels[registration.lifestyleRole]}
                        </TableCell>
                        <TableCell>{genderLabels[registration.gender]}</TableCell>
                        <TableCell className="whitespace-nowrap text-white/65">
                          {formatDate(registration.createdAt)}
                        </TableCell>
                        {registrationStatus === "pending" ? (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="bg-[#22C55E] text-white hover:bg-[#16A34A]"
                                disabled={
                                  approveMutation.isPending ||
                                  rejectMutation.isPending
                                }
                                onClick={() =>
                                  approveMutation.mutate({
                                    id: registration.id,
                                  })
                                }
                              >
                                <Check />
                                Duyệt
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={
                                  approveMutation.isPending ||
                                  rejectMutation.isPending
                                }
                                onClick={() => openRejectModal(registration.id)}
                              >
                                <X />
                                Từ chối
                              </Button>
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>

      <Dialog
        open={rejectModalOpen}
        onOpenChange={(open) => {
          if (!open) closeRejectModal();
          else setRejectModalOpen(true);
        }}
      >
        <DialogContent className="border-white/10 bg-[#17171F] text-white">
          <DialogHeader>
            <DialogTitle>Từ chối đăng ký</DialogTitle>
            <DialogDescription className="text-white/55">
              Nhập lý do từ chối cho {selectedRegistration?.email ?? "yêu cầu này"}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Lý do (không bắt buộc)"
            className="border-white/10 bg-[#252532] text-white placeholder:text-white/35"
          />
          {rejectMutation.error ? (
            <p className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-xs text-[#FF6B6B]">
              {rejectMutation.error.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={closeRejectModal}
              disabled={rejectMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!selectedRegistrationId || rejectMutation.isPending}
              onClick={() => {
                if (!selectedRegistrationId) return;
                rejectMutation.mutate({
                  id: selectedRegistrationId,
                  reason: rejectReason.trim() || undefined,
                });
              }}
            >
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
