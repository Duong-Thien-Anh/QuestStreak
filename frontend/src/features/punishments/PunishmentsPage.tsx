import { useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Link2,
  AlertOctagon,
  Heart,
  Plus,
  Check,
  Crown,
} from "lucide-react";
import { FAB } from "@/shared/components/FAB";
import { BottomSheet } from "@/shared/components/BottomSheet";
import { mockPunishments, mockMembers } from "@/shared/mockData/mockData";
import { trpc } from "@/providers/trpc";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

interface ChecklistItem {
  label: string;
  completed: boolean;
}

interface Assignment {
  id: number;
  punishmentId: number;
  memberId: number;
  assignedBy: number;
  status: string;
  assignedAt: Date;
  selectedAt?: Date | string | null;
  checklist: ChecklistItem[];
  punishment: {
    id: number;
    houseId: number;
    title: string;
    description: string | null;
    chayCost: number;
    image: string | null;
    isActive: boolean;
  };
}

export function PunishmentsPage() {
  const { showToast } = useAppStore();
  const { isAdmin } = useCurrentUser();
  const [wallet, setWallet] = useState(mockMembers[1].wallet);
  const [assignments, setAssignments] = useState<Assignment[]>([
    {
      id: 1,
      punishmentId: 1,
      memberId: 2,
      assignedBy: 1,
      status: "active",
      assignedAt: new Date(),
      selectedAt: new Date(),
      checklist: [
        { label: "Viết 100 dòng đầu tiên", completed: false },
        { label: "Viết 100 dòng tiếp theo", completed: false },
        { label: "Viết 100 dòng tiếp theo", completed: false },
        { label: "Viết 100 dòng tiếp theo", completed: false },
        { label: "Viết 100 dòng cuối cùng", completed: false },
      ],
      punishment: mockPunishments[0],
    },
  ]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [checklistOverrides, setChecklistOverrides] = useState<Record<number, ChecklistItem[]>>({});
  const [actionSheet, setActionSheet] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState("5");
  const [reasonInput, setReasonInput] = useState("");
  const [newPunishment, setNewPunishment] = useState({
    title: "",
    description: "",
    chayCost: 1,
  });
  const [assignSheet, setAssignSheet] = useState<{ punishmentId: number; title: string } | null>(null);
  const [selectedAssignMemberId, setSelectedAssignMemberId] = useState<number | null>(null);
  const [assignChecklist, setAssignChecklist] = useState("");
  const [punishments, setPunishments] = useState(mockPunishments);
  const utils = trpc.useUtils();
  const houseQuery = trpc.house.get.useQuery(undefined, { retry: false });
  const houseId = houseQuery.data?.id ?? 1;
  const members = houseQuery.data?.members ?? mockMembers;
  const subMember = members.find((member) => member.lifestyleRole === "submissive") ?? members[0];
  const punishmentsQuery = trpc.punishment.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const walletQuery = trpc.wallet.get.useQuery(
    { memberId: subMember?.id ?? 0 },
    { enabled: !!houseQuery.data?.id && !!subMember?.id, retry: false }
  );
  const adminAssignmentsQuery = trpc.punishment.allAssignments.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id && isAdmin, retry: false }
  );
  const myAssignmentsQuery = trpc.punishment.myAssignments.useQuery(undefined, {
    enabled: !!houseQuery.data?.id && !isAdmin,
    retry: false,
  });
  const addChayMutation = trpc.wallet.addChay.useMutation({
    onSuccess: async () => {
      await utils.wallet.get.invalidate();
    },
  });
  const forgiveChayMutation = trpc.wallet.forgiveChay.useMutation({
    onSuccess: async () => {
      await utils.wallet.get.invalidate();
    },
  });
  const assignPunishmentMutation = trpc.punishment.assign.useMutation({
    onSuccess: async () => {
      await utils.punishment.allAssignments.invalidate();
      await utils.punishment.myAssignments.invalidate();
    },
  });
  const createPunishmentMutation = trpc.punishment.create.useMutation({
    onSuccess: async () => {
      await utils.punishment.list.invalidate();
    },
  });
  const choosePunishmentMutation = trpc.punishment.choose.useMutation({
    onSuccess: async () => {
      await utils.punishment.myAssignments.invalidate();
      await utils.punishment.allAssignments.invalidate();
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const resolvePunishmentMutation = trpc.punishment.resolve.useMutation({
    onSuccess: async () => {
      await utils.punishment.allAssignments.invalidate();
      await utils.punishment.myAssignments.invalidate();
      await utils.wallet.get.invalidate();
    },
    onError: (error) => showToast(error.message, "error"),
  });
  const visibleWallet = walletQuery.data ?? wallet;
  const visiblePunishments = punishmentsQuery.data ?? punishments;
  const memberLabel = (memberId: number) => {
    const member = members.find((item) => item.id === memberId);
    const userName = (member as { user?: { name?: string } } | undefined)?.user?.name;
    return member?.nickname || userName || "Thành viên";
  };

  const checklistFromText = (text: string): ChecklistItem[] =>
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ label, completed: false }));

  const handleAssign = () => {
    if (!assignSheet || !selectedAssignMemberId) return;
    const checklist =
      assignChecklist.trim()
        ? checklistFromText(assignChecklist)
        : [
            { label: "Hoàn thành yêu cầu", completed: false },
            { label: "Xác nhận hoàn thành hình phạt", completed: false },
          ];
    if (houseQuery.data) {
      assignPunishmentMutation.mutate(
        { punishmentId: assignSheet.punishmentId, memberId: selectedAssignMemberId, checklist },
        {
          onSuccess: () => {
            setAssignSheet(null);
            setSelectedAssignMemberId(null);
            setAssignChecklist("");
            showToast("Đã gán hình phạt!", "success");
          },
          onError: (err) => showToast(err.message, "error"),
        }
      );
      return;
    }
    setAssignments((prev) => [
      ...prev,
      {
        id: Date.now(),
        punishmentId: assignSheet.punishmentId,
        memberId: selectedAssignMemberId,
        assignedBy: 1,
        status: "active",
        assignedAt: new Date(),
        checklist,
        punishment: visiblePunishments.find((p) => p.id === assignSheet.punishmentId) ?? visiblePunishments[0],
      },
    ]);
    setAssignSheet(null);
    setSelectedAssignMemberId(null);
    setAssignChecklist("");
    showToast("Đã gán hình phạt tạm thời!", "success");
  };

  const parseChecklist = (value: unknown): ChecklistItem[] => {
    if (Array.isArray(value)) return value as ChecklistItem[];
    if (typeof value !== "string" || !value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const apiAssignments = (isAdmin
    ? adminAssignmentsQuery.data
    : myAssignmentsQuery.data)?.map((assignment) => ({
      ...assignment,
      status: assignment.status,
      assignedAt: assignment.assignedAt ?? new Date(),
      checklist: checklistOverrides[assignment.id] ?? parseChecklist(assignment.checklist),
      punishment: assignment.punishment ?? visiblePunishments.find((item) => item.id === assignment.punishmentId) ?? visiblePunishments[0],
    })) as Assignment[] | undefined;
  const visibleAssignments = apiAssignments ?? assignments;

  const toggleChecklistItem = (assignmentId: number, index: number) => {
    if (houseQuery.data) {
      const current =
        visibleAssignments.find((assignment) => assignment.id === assignmentId)?.checklist ?? [];
      setChecklistOverrides((prev) => ({
        ...prev,
        [assignmentId]: current.map((item, i) =>
          i === index ? { ...item, completed: !item.completed } : item
        ),
      }));
      return;
    }
    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id !== assignmentId) return a;
        const newChecklist = a.checklist.map((item, i) =>
          i === index ? { ...item, completed: !item.completed } : item
        );
        return { ...a, checklist: newChecklist };
      })
    );
  };

  const handleChoosePunishment = (punishmentId: number) => {
    if (houseQuery.data) {
      choosePunishmentMutation.mutate(
        { punishmentId },
        {
          onSuccess: () => showToast("Đã chọn hình phạt đang chịu!", "success"),
        }
      );
      return;
    }
    const punishment =
      visiblePunishments.find((item) => item.id === punishmentId) ?? visiblePunishments[0];
    if (!punishment) return;
    setAssignments((prev) => [
      ...prev,
      {
        id: Date.now(),
        punishmentId,
        memberId: subMember?.id ?? 2,
        assignedBy: subMember?.id ?? 2,
        status: "active",
        assignedAt: new Date(),
        selectedAt: new Date(),
        checklist: [
          { label: "Hoàn thành yêu cầu", completed: false },
          { label: "Xác nhận hoàn thành hình phạt", completed: false },
        ],
        punishment,
      },
    ]);
    showToast("Đã chọn hình phạt đang chịu!", "success");
  };

  const handleResolvePunishment = (
    assignment: Assignment,
    status: "redeemed" | "forgiven" | "escaped",
  ) => {
    const statusMessage = {
      redeemed: "Đã xác nhận chịu phạt!",
      forgiven: "Đã tha thứ!",
      escaped: "Đã ghi nhận trốn phạt!",
    }[status];

    if (houseQuery.data) {
      resolvePunishmentMutation.mutate(
        { assignmentId: assignment.id, status },
        {
          onSuccess: () => {
            setActionSheet(null);
            showToast(statusMessage, "success");
          },
        }
      );
      return;
    }

    setAssignments((prev) =>
      prev.map((item) => (item.id === assignment.id ? { ...item, status } : item))
    );
    if (status === "redeemed") {
      setWallet((prev) => ({
        ...prev,
        chayBalance: Math.max(0, prev.chayBalance - assignment.punishment.chayCost),
      }));
    }
    if (status === "escaped") {
      setWallet((prev) => ({
        ...prev,
        chayBalance: prev.chayBalance + assignment.punishment.chayCost,
      }));
    }
    setActionSheet(null);
    showToast(statusMessage, "success");
  };

  const handleAddDemerits = () => {
    const amount = parseInt(pointsInput) || 0;
    if (amount <= 0) return;
    if (houseQuery.data && subMember?.id) {
      addChayMutation.mutate({
        memberId: subMember.id,
        amount,
        reason: reasonInput || undefined,
      });
      setActionSheet(null);
      showToast("Đã thêm " + amount + " Chày!", "success");
      return;
    }
    setWallet((prev) => ({ ...prev, chayBalance: prev.chayBalance + amount }));
    setActionSheet(null);
    showToast("Đã thêm " + amount + " Chày!", "success");
  };

  const handleForgiveDemerits = () => {
    const amount = parseInt(pointsInput) || 0;
    if (amount <= 0) return;
    if (isAdmin && houseQuery.data && subMember?.id) {
      forgiveChayMutation.mutate({
        memberId: subMember.id,
        amount,
        reason: reasonInput || undefined,
      });
      setActionSheet(null);
      showToast("Đã xóa " + amount + " Chày!", "success");
      return;
    }
    showToast("Task Receive không thể dùng Chym để xử lý hình phạt.", "error");
  };

  const handleCreatePunishment = () => {
    if (!newPunishment.title.trim()) return;
    if (houseQuery.data) {
      createPunishmentMutation.mutate({
        houseId,
        title: newPunishment.title,
        description: newPunishment.description || undefined,
        chayCost: newPunishment.chayCost,
        image: "/punishments/hourglass.jpg",
      });
      setNewPunishment({ title: "", description: "", chayCost: 1 });
      setActionSheet(null);
      showToast("Đã tạo hình phạt mới!", "success");
      return;
    }
    setPunishments((prev) => [
      ...prev,
      {
        id: Date.now(),
        houseId: 1,
        title: newPunishment.title,
        description: newPunishment.description,
        chayCost: newPunishment.chayCost,
        image: "/punishments/hourglass.jpg",
        isActive: true,
      },
    ]);
    setNewPunishment({ title: "", description: "", chayCost: 1 });
    setActionSheet(null);
    showToast("Đã tạo hình phạt mới tạm thời!", "success");
  };

  const activeAssignments = visibleAssignments.filter((a) => a.status === "active");
  const displayedActiveAssignments = isAdmin
    ? activeAssignments
    : activeAssignments;

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
              <p className="text-2xl font-bold text-white">{visibleWallet.chayBalance}</p>
              <p className="text-xs text-white/50">Chày vi phạm</p>
            </div>
            <Link2 className="w-6 h-6 text-[#FF3B30]" />
          </div>
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{visibleWallet.chymBalance}</p>
              <p className="text-xs text-white/50">Chym hiện có</p>
            </div>
            <Crown className="w-6 h-6 text-[#FFD700]" />
          </div>
        </div>
      </motion.div>

      {/* Active Punishments */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          Hình phạt đang chịu
        </h2>

        {displayedActiveAssignments.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">
            {activeAssignments.length === 0
              ? "Không có hình phạt đang chịu"
              : "Chọn một hình phạt trong danh sách bên dưới"}
          </div>
        ) : (
          displayedActiveAssignments.map((assignment) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={
                "bg-[#1A1A22] rounded-xl border transition-colors " +
                (expandedId === assignment.id
                  ? "border-[#FF3B30]/30 bg-[#252532]"
                  : "border-white/5")
              }
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white text-sm">
                        {assignment.punishment.title}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#FF3B30]/10 text-[#FF3B30] font-medium flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> {assignment.punishment.chayCost} Chày
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-1">
                      {assignment.punishment.description}
                    </p>
                    <p className="text-[11px] text-white/40 mt-2">
                      Người chịu phạt:{" "}
                      <span className="text-white/70">{memberLabel(assignment.memberId)}</span>
                    </p>
                  </div>
                  {isAdmin ? (
                    <div className="ml-2 flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleResolvePunishment(assignment, "forgiven")}
                        disabled={resolvePunishmentMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-[#252532] text-white text-xs font-medium hover:bg-[#333344] disabled:opacity-50 transition-colors"
                      >
                        Tha thứ
                      </button>
                      <button
                        onClick={() => handleResolvePunishment(assignment, "redeemed")}
                        disabled={resolvePunishmentMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-[#00F2FE] text-[#0D0D11] text-xs font-semibold hover:bg-[#00F2FE]/90 disabled:opacity-50 transition-colors"
                      >
                        Đã chịu phạt
                      </button>
                      <button
                        onClick={() => handleResolvePunishment(assignment, "escaped")}
                        disabled={resolvePunishmentMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-[#FF3B30] text-white text-xs font-medium hover:bg-[#FF3B30]/90 disabled:opacity-50 transition-colors"
                      >
                        Đã trốn
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setExpandedId(
                          expandedId === assignment.id ? null : assignment.id
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#252532] text-white text-xs font-medium hover:bg-[#333344] transition-colors ml-2 flex-shrink-0"
                    >
                      {expandedId === assignment.id ? "Đóng" : "Checklist"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expandable checklist */}
              <AnimatePresence>
                {expandedId === assignment.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {assignment.checklist.map((item, i) => (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => toggleChecklistItem(assignment.id, i)}
                          className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#1A1A22] border border-white/5 hover:border-[#00F2FE]/20 transition-colors"
                        >
                          <div
                            className={
                              "w-5 h-5 rounded border-2 flex items-center justify-center transition-all " +
                              (item.completed
                                ? "bg-[#00F2FE] border-[#00F2FE]"
                                : "border-white/20")
                            }
                          >
                            {item.completed && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 400 }}
                              >
                                <Check className="w-3 h-3 text-[#0D0D11]" />
                              </motion.div>
                            )}
                          </div>
                          <span
                            className={
                              "text-sm " +
                              (item.completed
                                ? "text-white/40 line-through"
                                : "text-white/70")
                            }
                          >
                            {item.label}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>

      {/* All Punishments Catalog */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
          Danh sách hình phạt
        </h2>
        {visiblePunishments.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-sm">
            Chưa có hình phạt nào
          </div>
        ) : (
          visiblePunishments.map((p, i) => {
            const activeCount = activeAssignments.filter(
              (assignment) => assignment.punishmentId === p.id
            ).length;
            return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#1A1A22] rounded-xl border border-white/5 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white text-sm">{p.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#FF3B30]/10 text-[#FF3B30] font-medium flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> {p.chayCost} Chày
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1">{p.description}</p>
                  {!isAdmin && activeCount > 0 ? (
                    <span className="inline-flex mt-2 text-[10px] px-2 py-0.5 rounded-md bg-[#00F2FE]/10 text-[#00F2FE] font-medium">
                      Đang chịu {activeCount}
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={() => {
                    if (isAdmin) {
                      setAssignSheet({ punishmentId: p.id, title: p.title });
                      setSelectedAssignMemberId(subMember?.id ?? members[0]?.id ?? null);
                      setAssignChecklist("");
                      return;
                    }
                    handleChoosePunishment(p.id);
                  }}
                  disabled={!isAdmin && choosePunishmentMutation.isPending}
                  className={
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ml-2 flex-shrink-0 disabled:opacity-50 " +
                    (isAdmin
                      ? "bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90"
                      : "bg-[#00F2FE] text-[#0D0D11] hover:bg-[#00F2FE]/90")
                  }
                >
                  {isAdmin ? "Gán" : "Chọn hình phạt"}
                </button>
              </div>
            </motion.div>
            );
          })
        )}
      </div>

      {/* FAB */}
      <FAB
        actions={[
          {
            label: "Hình phạt mới",
            icon: <Plus className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("new"),
            color: "#FF3B30",
          },
          ...(isAdmin
            ? [
                {
                  label: "Tha Chày",
                  icon: <Heart className="w-5 h-5 text-white" />,
                  onClick: () => setActionSheet("forgive"),
                  color: "#00F2FE",
                },
              ]
            : []),
          {
            label: "Thêm Chày",
            icon: <AlertOctagon className="w-5 h-5 text-white" />,
            onClick: () => setActionSheet("add"),
            color: "#FF3B30",
          },
        ]}
      />

      {/* Action Sheets */}
      <BottomSheet
        isOpen={actionSheet === "new"}
        onClose={() => setActionSheet(null)}
        title="Hình phạt mới"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">Tiêu đề</label>
            <input
              type="text"
              value={newPunishment.title}
              onChange={(event) =>
                setNewPunishment((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Nhập tên hình phạt..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF3B30]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Mô tả</label>
            <textarea
              value={newPunishment.description}
              onChange={(event) =>
                setNewPunishment((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Mô tả việc cần thực hiện..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF3B30]/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Mức Chày vi phạm</label>
            <input
              type="number"
              min={0}
              value={newPunishment.chayCost}
              onChange={(event) =>
                setNewPunishment((current) => ({
                  ...current,
                  chayCost: Number(event.target.value),
                }))
              }
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF3B30]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCreatePunishment}
            disabled={!newPunishment.title.trim()}
            className="w-full py-3 rounded-xl bg-[#FF3B30] text-white font-semibold text-sm hover:bg-[#FF3B30]/90 disabled:opacity-50 transition-colors"
          >
            Tạo hình phạt
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "add"}
        onClose={() => setActionSheet(null)}
        title="Thêm Chày"
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
            onClick={handleAddDemerits}
            className="w-full py-3 rounded-xl bg-[#FF3B30] text-white font-semibold text-sm hover:bg-[#FF3B30]/90 transition-colors"
          >
            Thêm Chày
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={actionSheet === "forgive"}
        onClose={() => setActionSheet(null)}
        title="Tha Chày"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-2 block">
              Số Chày muốn tha
            </label>
            <input
              type="number"
              value={pointsInput}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">
              Lời tha thứ
            </label>
            <input
              type="text"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Viết lời nhắn dịu dàng..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>
          <button
            onClick={handleForgiveDemerits}
            className="w-full py-3 rounded-xl bg-[#00F2FE] text-[#0D0D11] font-semibold text-sm hover:bg-[#00F2FE]/90 transition-colors"
          >
            <Heart className="w-4 h-4 inline mr-2" />
            Tha thứ
          </button>
        </div>
      </BottomSheet>

      {/* Assign punishment sheet */}
      <BottomSheet
        isOpen={assignSheet !== null}
        onClose={() => {
          setAssignSheet(null);
          setSelectedAssignMemberId(null);
          setAssignChecklist("");
        }}
        title={`Gán hình phạt: ${assignSheet?.title ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-white/40">
            Nhập danh sách việc cần làm (mỗi dòng một việc). Để trống sẽ dùng mặc định.
          </p>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Người nhận</label>
            <select
              value={selectedAssignMemberId ?? ""}
              onChange={(event) => setSelectedAssignMemberId(Number(event.target.value))}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF3B30]/50 focus:outline-none"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname || "Thành viên"} - {member.lifestyleRole}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-2 block">Checklist (mỗi dòng 1 việc)</label>
            <textarea
              value={assignChecklist}
              onChange={(e) => setAssignChecklist(e.target.value)}
              placeholder={"Hoàn thành yêu cầu\nXác nhận hoàn thành hình phạt"}
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF3B30]/50 focus:outline-none resize-none"
            />
          </div>
          <button
            onClick={handleAssign}
            disabled={assignPunishmentMutation.isPending || !selectedAssignMemberId}
            className="w-full py-3 rounded-xl bg-[#FF3B30] text-white font-semibold text-sm hover:bg-[#FF3B30]/90 disabled:opacity-50 transition-colors"
          >
            {assignPunishmentMutation.isPending ? "Đang gán..." : "Gán hình phạt"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
