import { useState } from "react";
import {
  Check,
  Home,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
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

type AdminSection = "overview" | "rooms" | "users" | "registrations";
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
  { value: "registrations", label: "Duyệt đăng ký", icon: UserPlus },
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

  const users = usersQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const registrations = registrationsQuery.data ?? [];
  const selectedRegistration = registrations.find(
    (item) => item.id === selectedRegistrationId,
  );
  const totalMembers = rooms.reduce((sum, room) => sum + room.members.length, 0);
  const adminUsers = users.filter((user) => user.role === "admin");
  const pendingRegistrations = registrations.filter(
    (item) => item.status === "pending",
  );
  const roomOptions = rooms.map((room) => ({ id: room.id, name: room.name }));

  const invalidateAdminData = async () => {
    await Promise.all([
      utils.admin.listUsers.invalidate(),
      utils.admin.listRooms.invalidate(),
      utils.admin.listRegistrations.invalidate(),
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
  const updateUserRoleMutation = trpc.admin.updateUserRole.useMutation({
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
          <TabsList className="grid h-auto w-full grid-cols-2 bg-white/10 text-white/60 md:w-fit md:grid-cols-4">
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
                    <TableHead className="text-white/60">Login</TableHead>
                    <TableHead className="text-white/60">Role</TableHead>
                    <TableHead className="text-white/60">Last sign in</TableHead>
                    <TableHead className="text-right text-white/60">
                      Set role
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
                        <p className="font-medium text-white">
                          {user.name ?? "Unnamed"}
                        </p>
                        <p className="mt-1 max-w-xs truncate text-xs text-white/45">
                          {user.unionId}
                        </p>
                      </TableCell>
                      <TableCell className="text-white/70">
                        {user.credentialEmail ?? user.email ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            user.role === "admin"
                              ? "border-[#F59E0B]/30 text-[#F59E0B]"
                              : "border-white/15 text-white/70"
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/60">
                        {formatDate(user.lastSignInAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <select
                          value={user.role}
                          onChange={(event) =>
                            updateUserRoleMutation.mutate({
                              userId: user.id,
                              role: event.target.value as AccountRole,
                            })
                          }
                          className="rounded-md border border-white/10 bg-[#1D2230] px-3 py-2 text-sm text-white"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
