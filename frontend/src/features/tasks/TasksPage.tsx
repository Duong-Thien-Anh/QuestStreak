import { useMemo, useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Star,
  Link2,
  Calendar,
  ChevronDown,
  Pen,
  Trophy,
  Zap,
  Send,
  CheckSquare,
  Trash2,
} from "lucide-react";
import { GamificationPanel } from "@/shared/components/GamificationPanel";
import { FAB } from "@/shared/components/FAB";
import { BottomSheet } from "@/shared/components/BottomSheet";
import {
  mockTasks,
  mockMembers,
  taskCategories,
} from "@/shared/mockData/mockData";
import { trpc } from "@/providers/trpc";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";

export function TasksPage() {
  const { showToast } = useAppStore();
  const { currentMember, isAdmin } = useCurrentUser();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["daily"])
  );
  const [createSheet, setCreateSheet] = useState(false);
  const [createType, setCreateType] = useState<"task" | "wheel">("task");
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingWheelId, setEditingWheelId] = useState<number | null>(null);
  const [taskType, setTaskType] = useState<"regular" | "special" | "superSpecial">("regular");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"frequency" | "custom">("frequency");
  const [recurringDays, setRecurringDays] = useState<number[]>([]);
  const [chymReward, setChymReward] = useState(0);
  const [chayPenalty, setChayPenalty] = useState(0);
  const [bonusXp, setBonusXp] = useState(0);
  const [linkedRewardId, setLinkedRewardId] = useState("");
  const [linkedPrivilegeId, setLinkedPrivilegeId] = useState("");
  const [linkedPunishmentId, setLinkedPunishmentId] = useState("");
  const [selectedTaskAssigneeId, setSelectedTaskAssigneeId] = useState("");
  const [assignTaskSheetId, setAssignTaskSheetId] = useState<number | null>(null);
  const [assignTaskMemberId, setAssignTaskMemberId] = useState("");
  const [wheelTitle, setWheelTitle] = useState("");
  const [wheelDescription, setWheelDescription] = useState("");
  const [wheelSelectedOptions, setWheelSelectedOptions] = useState<
    Array<{ type: "reward" | "punishment"; id: number; label: string }>
  >([]);
  const [spinningWheelId, setSpinningWheelId] = useState<number | null>(null);
  const [wheelRotations, setWheelRotations] = useState<Record<number, number>>({});
  // ─ Submit proof sheet ─
  const [submitSheetTaskId, setSubmitSheetTaskId] = useState<number | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [submitProofUrl, setSubmitProofUrl] = useState("");
  const [submitProofType, setSubmitProofType] = useState<"image" | "video" | "link" | "">("image");
  const [reviewSheetTaskId, setReviewSheetTaskId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  interface TaskItem {
    id: number;
    houseId: number;
    title: string;
    description: string;
    category: string;
    recurringDays?: string | null;
    dueDate: Date | string | null;
    chymReward: number;
    chayPenalty: number;
    bonusXp: number;
    linkedRewardId: number | null;
    linkedAchievementId: number | null;
    linkedPrivilegeId?: number | null;
    linkedPunishmentId: number | null;
    status: string;
    assignedTo: number | null;
  }
  interface TaskSubmission {
    id: number;
    taskId: number;
    memberId: number;
    note: string | null;
    proofUrl: string | null;
    proofType: string | null;
    status: "submitted" | "approved" | "rejected";
    reviewedBy: number | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    submittedAt: Date;
  }
  type WheelSelectedOption = {
    type: "reward" | "punishment";
    id: number;
    label: string;
  };
  const [tasksState, setTasksState] = useState<TaskItem[]>(mockTasks as TaskItem[]);

  const utils = trpc.useUtils();
  const houseQuery = trpc.house.get.useQuery(undefined, { retry: false });
  const houseId = houseQuery.data?.id ?? 1;
  const members = houseQuery.data?.members ?? mockMembers;
  const subMember = members.find((m) => m.lifestyleRole === "submissive");
  const profileMember =
    (currentMember
      ? members.find((member) => member.id === currentMember.id) ?? currentMember
      : null) ?? subMember;
  const profileWallet = profileMember?.wallet ?? subMember?.wallet;
  const profileAvatar =
    profileMember?.telegramAvatar ||
    (profileMember?.gender === "male" ? "/avatars/admin.jpg" : "/avatars/sub.jpg");
  const tasksQuery = trpc.task.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const wheelsQuery = trpc.wheel.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const submissionsQuery = trpc.task.submissions.useQuery(
    { taskId: reviewSheetTaskId ?? 0 },
    { enabled: !!reviewSheetTaskId && !!houseQuery.data?.id, retry: false }
  );
  const rewardsQuery = trpc.reward.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const privilegesQuery = trpc.privilege.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const punishmentsQuery = trpc.punishment.list.useQuery(
    { houseId },
    { enabled: !!houseQuery.data?.id, retry: false }
  );
  const gamificationSummaryQuery = trpc.gamification.summary.useQuery(
    { memberId: subMember?.id ?? 0 },
    { enabled: !!subMember?.id, retry: false }
  );
  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const assignTaskMutation = trpc.task.assign.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const acceptTaskMutation = trpc.task.accept.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const submitTaskMutation = trpc.task.submit.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
    },
  });
  const reviewTaskMutation = trpc.task.review.useMutation({
    onSuccess: async () => {
      await utils.task.list.invalidate();
      await utils.house.get.invalidate();
      await utils.gamification.summary.invalidate();
      await utils.reward.list.invalidate();
      await utils.privilege.myAssignments.invalidate();
      await utils.punishment.allAssignments.invalidate();
    },
  });
  const createWheelMutation = trpc.wheel.create.useMutation({
    onSuccess: async () => {
      await utils.wheel.list.invalidate();
    },
  });
  const updateWheelMutation = trpc.wheel.update.useMutation({
    onSuccess: async () => {
      await utils.wheel.list.invalidate();
    },
  });
  const deleteWheelMutation = trpc.wheel.delete.useMutation({
    onSuccess: async () => {
      await utils.wheel.list.invalidate();
    },
  });
  const spinWheelMutation = trpc.wheel.spin.useMutation({
    onSuccess: async () => {
      await utils.wheel.list.invalidate();
    },
  });
  const purchaseRewardMutation = trpc.reward.purchase.useMutation({
    onSuccess: async () => {
      await utils.house.get.invalidate();
    },
  });

  const visibleTasks = (tasksQuery.data ?? tasksState) as TaskItem[];
  const visibleWheels = wheelsQuery.data ?? [];
  const assignTaskTarget = visibleTasks.find((task) => task.id === assignTaskSheetId);
  const availableRewards = rewardsQuery.data ?? [];
  const availablePrivileges = privilegesQuery.data ?? [];
  const availablePunishments = punishmentsQuery.data ?? [];
  const activeWheelRewards = availableRewards.filter((reward) => reward.isActive);
  const activeWheelPunishments = availablePunishments.filter((punishment) => punishment.isActive);
  const availableAchievements = gamificationSummaryQuery.data?.achievements ?? [];
  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );
  const rewardById = useMemo(
    () => new Map(availableRewards.map((reward) => [reward.id, reward])),
    [availableRewards]
  );
  const punishmentById = useMemo(
    () => new Map(availablePunishments.map((punishment) => [punishment.id, punishment])),
    [availablePunishments]
  );
  const achievementById = useMemo(
    () => new Map(availableAchievements.map((achievement) => [achievement.id, achievement])),
    [availableAchievements]
  );
  const privilegeById = useMemo(
    () => new Map(availablePrivileges.map((privilege) => [privilege.id, privilege])),
    [availablePrivileges]
  );
  const wheelPalette = ["#FF2A85", "#A155FF", "#00F2FE", "#FFD700", "#FF7A59", "#35D07F"];
  const wheelPreviewOptions = useMemo(
    () =>
      wheelSelectedOptions.map((option) => ({ label: option.label, weight: 1 })),
    [wheelSelectedOptions]
  );


  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatTaskDate = (value: Date | string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleCreateTask = () => {
    if (!title.trim()) return;
    if (editingTaskId) {
      if (houseQuery.data) {
        showToast("Chỉnh sửa nhiệm vụ cần bổ sung API update ở backend", "info");
        return;
      }
      setTasksState((prev) =>
        prev.map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                title,
                description: description || "",
                category: taskType === "regular" ? frequency : taskType,
                recurringDays:
                  scheduleMode === "frequency" && recurringDays.length > 0
                    ? JSON.stringify(recurringDays)
                    : null,
                dueDate: taskType !== "regular" || scheduleMode === "custom" ? dueDate || null : null,
                chymReward,
                chayPenalty,
                bonusXp,
                linkedRewardId: linkedRewardId ? Number(linkedRewardId) : null,
                linkedPrivilegeId: linkedPrivilegeId ? Number(linkedPrivilegeId) : null,
                linkedPunishmentId: linkedPunishmentId ? Number(linkedPunishmentId) : null,
                assignedTo: selectedTaskAssigneeId ? Number(selectedTaskAssigneeId) : null,
              }
            : task
        )
      );
      setCreateSheet(false);
      resetForm();
      showToast("Đã cập nhật nhiệm vụ tạm thời!", "success");
      return;
    }
    if (houseQuery.data) {
      createTaskMutation.mutate({
        houseId,
        title,
        description: description || undefined,
        category: taskType === "regular" ? (scheduleMode === "custom" ? "special" : frequency) : taskType,
        dueDate:
          scheduleMode === "custom" || taskType !== "regular"
            ? dueDate || undefined
            : undefined,
        startDate: (scheduleMode === "custom" || taskType !== "regular") ? (startDate || undefined) : undefined,
        recurringDays:
          scheduleMode === "frequency" && recurringDays.length > 0
            ? recurringDays
            : undefined,
        chymReward,
        chayPenalty,
        bonusXp,
        assignedTo: selectedTaskAssigneeId ? Number(selectedTaskAssigneeId) : undefined,
        linkedRewardId: linkedRewardId ? Number(linkedRewardId) : undefined,
        linkedPrivilegeId: linkedPrivilegeId ? Number(linkedPrivilegeId) : undefined,
        linkedPunishmentId: linkedPunishmentId ? Number(linkedPunishmentId) : undefined,
      });
      setCreateSheet(false);
      resetForm();
      showToast("Đã tạo nhiệm vụ mới!", "success");
      return;
    }
    const newTask = {
      id: tasksState.length + 1,
      houseId: 1,
      title,
      description: description || "",
      category: frequency as "daily" | "weekly" | "monthly" | "special" | "superSpecial",
      recurringDays:
        scheduleMode === "frequency" && recurringDays.length > 0
          ? JSON.stringify(recurringDays)
          : null,
      dueDate: taskType !== "regular" || scheduleMode === "custom" ? dueDate || null : null,
      chymReward,
      chayPenalty,
      bonusXp,
      linkedRewardId: linkedRewardId ? Number(linkedRewardId) : null,
      linkedAchievementId: null,
      linkedPrivilegeId: linkedPrivilegeId ? Number(linkedPrivilegeId) : null,
      linkedPunishmentId: linkedPunishmentId ? Number(linkedPunishmentId) : null,
      status: "active" as const,
      assignedTo: selectedTaskAssigneeId ? Number(selectedTaskAssigneeId) : null,
    };
    setTasksState([...tasksState, newTask]);
    setCreateSheet(false);
    resetForm();
    showToast("Đã tạo nhiệm vụ mới!", "success");
  };

  const resetForm = () => {
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setStartDate("");
    setScheduleMode("frequency");
    setRecurringDays([]);
    setChymReward(0);
    setChayPenalty(0);
    setBonusXp(0);
    setLinkedRewardId("");
    setLinkedPrivilegeId("");
    setLinkedPunishmentId("");
    setSelectedTaskAssigneeId(subMember?.id ? String(subMember.id) : "");
    setFrequency("daily");
    setTaskType("regular");
  };

  const openTaskEditor = (task: TaskItem) => {
    setEditingTaskId(task.id);
    setCreateType("task");
    setTitle(task.title);
    setDescription(task.description || "");
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : "");
    setStartDate((task as TaskItem & { startDate?: Date | string | null }).startDate
      ? new Date((task as TaskItem & { startDate?: Date | string | null }).startDate!).toISOString().slice(0, 10)
      : "");
    setRecurringDays(task.recurringDays ? (JSON.parse(task.recurringDays) as number[]) : []);
    setScheduleMode("frequency");
    setChymReward(task.chymReward);
    setChayPenalty(task.chayPenalty);
    setBonusXp(task.bonusXp ?? 0);
    setLinkedRewardId(task.linkedRewardId ? String(task.linkedRewardId) : "");
    setLinkedPrivilegeId(task.linkedPrivilegeId ? String(task.linkedPrivilegeId) : "");
    setLinkedPunishmentId(task.linkedPunishmentId ? String(task.linkedPunishmentId) : "");
    setSelectedTaskAssigneeId(task.assignedTo ? String(task.assignedTo) : "");
    if (task.category === "special" || task.category === "superSpecial") {
      setTaskType(task.category);
    } else {
      setTaskType("regular");
      setFrequency(
        task.category === "weekly" || task.category === "monthly" ? task.category : "daily"
      );
    }
    setCreateSheet(true);
  };

  const resetWheelForm = () => {
    setEditingWheelId(null);
    setWheelTitle("");
    setWheelDescription("");
    setWheelSelectedOptions([]);
  };

  const openWheelEditor = (wheel: (typeof visibleWheels)[number]) => {
    const options = parseWheelOptions(wheel.options);
    setEditingWheelId(wheel.id);
    setCreateType("wheel");
    setWheelTitle(wheel.title);
    setWheelDescription(wheel.description ?? "");
    setWheelSelectedOptions(
      options.map((option, index) => {
        const reward = availableRewards.find((item) => item.title === option.label);
        if (reward) return { type: "reward", id: reward.id, label: reward.title };
        const punishment = availablePunishments.find((item) => item.title === option.label);
        if (punishment) return { type: "punishment", id: punishment.id, label: punishment.title };
        return { type: "reward", id: -1 - index, label: option.label };
      })
    );
    setCreateSheet(true);
  };

  const deleteWheel = (wheel: (typeof visibleWheels)[number]) => {
    if (!window.confirm(`Xóa vòng quay "${wheel.title}"?`)) return;
    deleteWheelMutation.mutate(
      { wheelId: wheel.id },
      {
        onSuccess: () => {
          showToast("Đã xóa vòng quay", "success");
        },
        onError: (err) => showToast(err.message, "error"),
      }
    );
  };

  const getCategoryColor = (key: string) => {
    const cat = taskCategories.find((c) => c.key === key);
    return cat?.color || "#FF2A85";
  };

  const getCategoryLabel = (key: string) => {
    switch (key) {
      case "daily":
        return "Hàng ngày";
      case "weekly":
        return "Hàng tuần";
      case "monthly":
        return "Hàng tháng";
      case "special":
        return "Đặc biệt";
      case "superSpecial":
        return "Siêu đặc biệt";
      case "completed":
        return "Đã hoàn thành";
      default:
        return key;
    }
  };

  const toggleWheelOption = (option: WheelSelectedOption) => {
    setWheelSelectedOptions((current) => {
      const exists = current.some((item) => item.type === option.type && item.id === option.id);
      if (exists) {
        return current.filter((item) => item.type !== option.type || item.id !== option.id);
      }
      return [...current, option];
    });
  };

  const isWheelOptionSelected = (type: "reward" | "punishment", id: number) =>
    wheelSelectedOptions.some((option) => option.type === type && option.id === id);

  const assignTask = (taskId: number) => {
    setAssignTaskSheetId(taskId);
    setAssignTaskMemberId(subMember?.id ? String(subMember.id) : members[0]?.id ? String(members[0].id) : "");
  };

  const confirmAssignTask = () => {
    if (!houseQuery.data || !assignTaskSheetId || !assignTaskMemberId) return;
    assignTaskMutation.mutate(
      { taskId: assignTaskSheetId, memberId: Number(assignTaskMemberId) },
      {
        onSuccess: () => {
          setAssignTaskSheetId(null);
          setAssignTaskMemberId("");
          showToast("Đã giao việc!", "success");
        },
        onError: (err) => showToast(err.message, "error"),
      }
    );
  };

  const acceptTask = (taskId: number) => {
    if (!houseQuery.data) return;
    acceptTaskMutation.mutate({ taskId });
    showToast("Đã nhận nhiệm vụ!", "success");
  };

  const submitTask = (taskId: number) => {
    if (!houseQuery.data) return;
    // Open the proof/note sheet instead of submitting directly
    setSubmitSheetTaskId(taskId);
    setSubmitNote("");
    setSubmitProofUrl("");
    setSubmitProofType("image");
  };

  const confirmSubmitTask = () => {
    if (!submitSheetTaskId) return;
    submitTaskMutation.mutate(
      {
        taskId: submitSheetTaskId,
        note: submitNote.trim() || undefined,
        proofUrl: submitProofUrl.trim() || undefined,
        proofType: submitProofUrl.trim() ? submitProofType || "link" : undefined,
      },
      {
        onSuccess: () => {
          setSubmitSheetTaskId(null);
          showToast("Đã gửi báo cáo!", "success");
        },
        onError: (err) => showToast(err.message, "error"),
      }
    );
  };

  const reviewTask = (taskId: number, decision: "approve" | "reject") => {
    if (!houseQuery.data) return;
    reviewTaskMutation.mutate(
      { taskId, decision, reviewNote: reviewNote.trim() || undefined },
      {
        onSuccess: () => {
          setReviewSheetTaskId(null);
          setReviewNote("");
        },
      }
    );
    showToast(decision === "approve" ? "Đã duyệt nhiệm vụ!" : "Đã trả nhiệm vụ về trạng thái đang làm!", "success");
  };

  const openReviewSheet = (taskId: number) => {
    setReviewSheetTaskId(taskId);
    setReviewNote("");
  };

  const saveWheel = () => {
    if (!wheelTitle.trim()) return;
    if (!houseQuery.data) {
      showToast("Vòng quay cần backend để lưu", "error");
      return;
    }

    const options = wheelSelectedOptions.map((option) => ({ label: option.label, weight: 1 }));

    if (options.length < 2) {
      showToast("Vòng quay cần ít nhất 2 lựa chọn từ rewards hoặc hình phạt", "error");
      return;
    }

    if (editingWheelId) {
      updateWheelMutation.mutate(
        {
          wheelId: editingWheelId,
          title: wheelTitle,
          description: wheelDescription || undefined,
          options,
          assignedTo: subMember?.id ?? null,
        },
        {
          onSuccess: () => {
            showToast("Đã cập nhật vòng quay!", "success");
          },
          onError: (err) => showToast(err.message, "error"),
        }
      );
    } else {
      createWheelMutation.mutate(
        {
          houseId,
          title: wheelTitle,
          description: wheelDescription || undefined,
          options,
          assignedTo: subMember?.id,
        },
        {
          onSuccess: () => {
            showToast("Đã tạo vòng quay!", "success");
          },
          onError: (err) => showToast(err.message, "error"),
        }
      );
    }
    setCreateSheet(false);
    resetWheelForm();
  };

  const spinWheel = (wheelId: number) => {
    if (!houseQuery.data) return;
    const nextRotation = (wheelRotations[wheelId] ?? 0) + 720 + ((wheelId * 53) % 360);
    setSpinningWheelId(wheelId);
    setWheelRotations((current) => ({ ...current, [wheelId]: nextRotation }));
    spinWheelMutation.mutate(
      { wheelId },
      {
        onSuccess: (data) => {
          showToast(`Kết quả vòng quay: ${data.result}`, "success");
        },
        onSettled: () => {
          setTimeout(() => setSpinningWheelId(null), 500);
        },
      }
    );
  };

  const parseWheelOptions = (optionsJson: string) => {
    try {
      return JSON.parse(optionsJson) as Array<{ label: string; weight?: number }>;
    } catch {
      return [];
    }
  };

  const renderWheelModel = (
    options: Array<{ label: string; weight?: number }>,
    rotation = 0,
    size: "sm" | "lg" = "sm"
  ) => {
    const normalized = options.length > 0 ? options : [{ label: "Lựa chọn 1" }, { label: "Lựa chọn 2" }];
    const segment = 100 / normalized.length;
    const gradient = normalized
      .map((_, index) => {
        const color = wheelPalette[index % wheelPalette.length];
        return `${color} ${index * segment}% ${(index + 1) * segment}%`;
      })
      .join(", ");
    const wheelSize = size === "lg" ? "h-56 w-56" : "h-36 w-36";
    const labelRadius = size === "lg" ? 84 : 52;

    return (
      <div className="relative mx-auto flex justify-center">
        <div className="absolute -top-1 z-20 h-0 w-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow" />
        <motion.div
          animate={{ rotate: rotation }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className={`relative ${wheelSize} rounded-full border-4 border-white/15 shadow-[0_0_28px_rgba(161,85,255,0.25)]`}
          style={{
            background: `conic-gradient(${gradient})`,
          }}
        >
          <div className="absolute inset-3 rounded-full border border-black/20" />
          {normalized.slice(0, 8).map((option, index) => {
            const angle = (360 / normalized.length) * index + 360 / normalized.length / 2 - 90;
            const x = Math.cos((angle * Math.PI) / 180) * labelRadius;
            const y = Math.sin((angle * Math.PI) / 180) * labelRadius;
            return (
              <span
                key={`${option.label}-${index}`}
                className="absolute left-1/2 top-1/2 max-w-[74px] -translate-x-1/2 -translate-y-1/2 truncate rounded bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${angle + 90}deg)`,
                }}
                title={option.label}
              >
                {option.label}
              </span>
            );
          })}
          <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-[#0D0D11] text-xs font-bold text-white shadow-lg">
            QUAY
          </div>
        </motion.div>
      </div>
    );
  };

  const renderTasksForCategory = (categoryKey: string) => {
    const filtered =
      categoryKey === "completed"
        ? visibleTasks.filter((t) => t.status === "completed")
        : visibleTasks.filter(
            (t) => t.category === categoryKey && t.status !== "completed"
          );

    return filtered.map((task, i) => (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        className="bg-[#1A1A22] rounded-xl border border-white/5 p-4 mb-3"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-white text-sm">{task.title}</h3>
            {task.description && (
              <p className="text-xs text-white/50 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            {formatTaskDate(task.dueDate) && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#00F2FE]">
                <Calendar className="h-3 w-3" />
                {formatTaskDate(task.dueDate)}
              </p>
            )}
            {task.assignedTo && (
              <p className="mt-2 text-xs text-white/45">
                Người nhận:{" "}
                <span className="font-medium text-white/70">
                  {memberById.get(task.assignedTo)?.nickname ??
                    `Member #${task.assignedTo}`}
                </span>
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => openTaskEditor(task)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 ml-2"
              aria-label="Sửa nhiệm vụ"
              title="Sửa nhiệm vụ"
            >
              <Pen className="w-4 h-4 text-white/30" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {task.chymReward > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#FFD700]/10 text-[#FFD700]">
              <Star className="w-3 h-3" /> {task.chymReward} Chym
            </span>
          )}
          {task.chayPenalty > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#FF3B30]/10 text-[#FF3B30]">
              <Link2 className="w-3 h-3" /> {task.chayPenalty} Chày
            </span>
          )}
          {(task.bonusXp ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#00F2FE]/10 text-[#00F2FE]">
              <Zap className="w-3 h-3" /> {task.bonusXp} XP
            </span>
          )}
          {task.linkedRewardId && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#35D07F]/10 text-[#35D07F]">
              <Star className="w-3 h-3" />
              {rewardById.get(task.linkedRewardId)?.title ?? "Reward"}
            </span>
          )}
          {task.linkedAchievementId && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#A155FF]/10 text-[#C9A7FF]">
              <Trophy className="w-3 h-3" />
              {achievementById.get(task.linkedAchievementId)?.title ?? "Achievement"}
            </span>
          )}
          {task.linkedPrivilegeId && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#A155FF]/10 text-[#C9A7FF]">
              <Trophy className="w-3 h-3" />
              {privilegeById.get(task.linkedPrivilegeId)?.title ?? "Privilege"}
            </span>
          )}
          {task.linkedPunishmentId && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-[#FF3B30]/10 text-[#FF7A59]">
              <Trash2 className="w-3 h-3" />
              {punishmentById.get(task.linkedPunishmentId)?.title ?? "Hình phạt"}
            </span>
          )}
          <span
            className="text-xs px-2 py-1 rounded-md"
            style={{
              backgroundColor: `${getCategoryColor(task.category)}15`,
              color: getCategoryColor(task.category),
            }}
          >
            {getCategoryLabel(task.category)}
          </span>
        </div>
        {/* Admin/Sub actions */}
        <div className="flex gap-2 mt-3">
          {isAdmin ? (
            <>
              {task.status === "submitted" ? (
                <>
                  <button
                    onClick={() => openReviewSheet(task.id)}
                    className="flex-1 py-2 rounded-lg bg-[#A155FF]/10 text-[#A155FF] text-xs font-medium hover:bg-[#A155FF]/20 transition-colors"
                  >
                    Xem báo cáo
                  </button>
                </>
              ) : task.assignedTo ? (
                <span className="flex-1 py-2 rounded-lg bg-[#FF2A85]/10 text-[#FF2A85] text-xs font-medium text-center">
                  Đang thực hiện
                </span>
              ) : (
                <button
                  onClick={() => assignTask(task.id)}
                  className="flex-1 py-2 rounded-lg bg-[#FF2A85]/10 text-[#FF2A85] text-xs font-medium hover:bg-[#FF2A85]/20 transition-colors"
                >
                  Giao việc
                </button>
              )}
            </>
          ) : (
            <>
              {task.status === "active" && (
                <>
                  {task.category === "special" || task.category === "superSpecial" ? (
                    !task.assignedTo ? (
                      <button
                        onClick={() => acceptTask(task.id)}
                        className="flex-1 py-2 rounded-lg bg-[#FF2A85] text-white text-xs font-medium hover:bg-[#FF2A85]/90 transition-colors"
                      >
                        Nhận nhiệm vụ
                      </button>
                    ) : (
                      <button
                        onClick={() => submitTask(task.id)}
                        className="flex-1 py-2 rounded-lg bg-[#00F2FE]/10 text-[#00F2FE] text-xs font-medium hover:bg-[#00F2FE]/20 transition-colors"
                      >
                        Báo cáo
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => submitTask(task.id)}
                      className="flex-1 py-2 rounded-lg bg-[#00F2FE]/10 text-[#00F2FE] text-xs font-medium hover:bg-[#00F2FE]/20 transition-colors"
                    >
                      Báo cáo
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    ));
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-4"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <img
            src={profileAvatar}
            alt={profileMember?.nickname ? `Avatar của ${profileMember.nickname}` : "Avatar"}
            className="w-44 h-44 rounded-xl object-cover border-2 border-[#FF2A85]/30"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF2A85] flex items-center justify-center">
            <Heart className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Wallets */}
        <div className="flex-1 grid grid-rows-2 gap-2">
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{profileWallet?.chymBalance ?? 0}</p>
              <p className="text-xs text-white/50">Chym</p>
            </div>
            <Star className="w-6 h-6 text-[#FFD700]" />
          </div>
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{profileWallet?.chayBalance ?? 0}</p>
              <p className="text-xs text-white/50">Chày</p>
            </div>
            <Link2 className="w-6 h-6 text-[#FF3B30]" />
          </div>
        </div>
      </motion.div>

      {/* Gamification: Streak / XP / Level */}
      <GamificationPanel
        memberId={profileMember?.id}
        memberName={profileMember?.nickname ?? undefined}
      />

      {/* Rewards shop — chỉ hiện cho sub (không phải admin) */}
      {!isAdmin && availableRewards.filter((r) => r.isActive).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="space-y-2"
        >
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Đổi Chym lấy Rewards
          </h2>
          {availableRewards.filter((r) => r.isActive).map((reward) => {
            const canAfford = (profileWallet?.chymBalance ?? 0) >= reward.cost;
            return (
              <div
                key={reward.id}
                className="bg-[#1A1A22] rounded-xl border border-white/5 p-4 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{reward.title}</p>
                  {reward.description && (
                    <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{reward.description}</p>
                  )}
                  <span className="inline-flex items-center gap-1 mt-1 text-xs text-[#FFD700]">
                    <Star className="w-3 h-3" /> {reward.cost} Chym
                  </span>
                </div>
                <button
                  disabled={!canAfford || !houseQuery.data || purchaseRewardMutation.isPending}
                  onClick={() => {
                    if (!houseQuery.data) return;
                    purchaseRewardMutation.mutate(
                      { rewardId: reward.id },
                      {
                        onSuccess: () => showToast(`Đã đổi: ${reward.title}!`, "success"),
                        onError: (err) => showToast(err.message, "error"),
                      }
                    );
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#FFD700]/10 text-[#FFD700] hover:bg-[#FFD700]/20"
                >
                  Đổi
                </button>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Manage button for admin */}
      {isAdmin && (
        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setCreateType("task");
              setCreateSheet(true);
            }}
            className="px-3 py-1.5 rounded-lg bg-[#1A1A22] border border-white/5 text-xs text-white/60 flex items-center gap-1.5 hover:bg-white/5 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" /> Quản lý
          </button>
        </div>
      )}

      {visibleWheels.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-3"
        >
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
            Vòng quay
          </h2>
          {visibleWheels.map((wheel) => {
            const options = parseWheelOptions(wheel.options);
            const isSpinning = spinningWheelId === wheel.id;
            return (
              <div
                key={wheel.id}
                className="bg-[#1A1A22] rounded-xl border border-white/5 p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    {renderWheelModel(options, wheelRotations[wheel.id] ?? 0, "sm")}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-white text-sm">{wheel.title}</h3>
                      {isAdmin && (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => openWheelEditor(wheel)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5"
                            aria-label="Sửa vòng quay"
                            title="Sửa vòng quay"
                          >
                            <Pen className="h-4 w-4 text-white/40" />
                          </button>
                          <button
                            onClick={() => deleteWheel(wheel)}
                            disabled={deleteWheelMutation.isPending}
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#FF3B30]/10 disabled:opacity-50"
                            aria-label="Xóa vòng quay"
                            title="Xóa vòng quay"
                          >
                            <Trash2 className="h-4 w-4 text-[#FF3B30]/70" />
                          </button>
                        </div>
                      )}
                    </div>
                    {wheel.description && (
                      <p className="text-xs text-white/50 mt-1">{wheel.description}</p>
                    )}
                    <p className="text-[10px] text-white/30 mt-2">
                      {options.map((option) => option.label).join(" / ")}
                    </p>
                    <button
                      onClick={() => spinWheel(wheel.id)}
                      disabled={isSpinning || spinWheelMutation.isPending}
                      className="mt-3 rounded-lg bg-[#A155FF] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#A155FF]/90 disabled:opacity-60"
                    >
                      {isSpinning ? "Đang quay..." : "Quay"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Task Categories */}
      <div className="space-y-2">
        {taskCategories.map((cat, catIdx) => (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + catIdx * 0.03 }}
          >
            <button
              onClick={() => toggleCategory(cat.key)}
              className="w-full flex items-center justify-between py-3 group"
            >
              <div className="flex items-center gap-2">
                <Pen
                  className="w-4 h-4"
                  style={{ color: cat.color }}
                />
                <span className="text-sm font-semibold text-white">{getCategoryLabel(cat.key)}</span>
                <span className="text-xs text-white/30">
                  {
                    (cat.key === "completed"
                      ? visibleTasks.filter((t) => t.status === "completed")
                      : visibleTasks.filter(
                          (t) => t.category === cat.key && t.status !== "completed"
                        )
                    ).length
                  }
                </span>
              </div>
              <motion.div
                animate={{ rotate: expandedCategories.has(cat.key) ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-white/40" />
              </motion.div>
            </button>

            <AnimatePresence>
              {expandedCategories.has(cat.key) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  {renderTasksForCategory(cat.key)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* FAB */}
      <FAB
        actions={[
          {
            label: "Gửi vòng quay",
            icon: <Send className="w-5 h-5 text-white" />,
            onClick: () => {
              resetWheelForm();
              setCreateType("wheel");
              setCreateSheet(true);
            },
            color: "#A155FF",
          },
          {
            label: "Tạo nhiệm vụ",
            icon: <Zap className="w-5 h-5 text-white" />,
            onClick: () => {
              setCreateType("task");
              setCreateSheet(true);
            },
            color: "#FF2A85",
          },
        ]}
      />

      {/* Create Sheet */}
      <BottomSheet
        isOpen={createSheet}
        onClose={() => {
          setCreateSheet(false);
          resetForm();
          resetWheelForm();
        }}
        title={
          editingTaskId
            ? "Sửa nhiệm vụ"
            : createType === "task"
            ? "Tạo nhiệm vụ mới"
            : editingWheelId
            ? "Sửa vòng quay"
            : "Tạo vòng quay"
        }
      >
        {createType === "wheel" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#A155FF]/20 bg-[#A155FF]/5 p-4">
              {renderWheelModel(wheelPreviewOptions, 0, "lg")}
              <p className="mt-3 text-center text-xs text-white/45">
                {wheelPreviewOptions.length >= 2
                  ? `${wheelPreviewOptions.length} lựa chọn sẽ được tạo thành vòng quay`
                  : "Thêm ít nhất 2 lựa chọn để tạo vòng quay"}
              </p>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Tên vòng quay</label>
              <input
                type="text"
                value={wheelTitle}
                onChange={(event) => setWheelTitle(event.target.value)}
                placeholder="Vòng quay bất ngờ..."
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Mô tả</label>
              <textarea
                value={wheelDescription}
                onChange={(event) => setWheelDescription(event.target.value)}
                placeholder="Vòng quay này dùng để làm gì?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none resize-none"
              />
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Rewards
                </p>
                <div className="space-y-2">
                  {activeWheelRewards.length === 0 ? (
                    <p className="rounded-xl border border-white/5 bg-[#252532] px-4 py-3 text-xs text-white/35">
                      Chưa có Reward đang bật.
                    </p>
                  ) : (
                    activeWheelRewards.map((reward) => {
                      const selected = isWheelOptionSelected("reward", reward.id);
                      return (
                        <button
                          key={`reward-${reward.id}`}
                          type="button"
                          onClick={() =>
                            toggleWheelOption({
                              type: "reward",
                              id: reward.id,
                              label: reward.title,
                            })
                          }
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            selected
                              ? "border-[#35D07F]/50 bg-[#35D07F]/10"
                              : "border-white/10 bg-[#252532] hover:border-white/20"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                                selected
                                  ? "border-[#35D07F] bg-[#35D07F] text-[#0D0D11]"
                                  : "border-white/20 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="text-sm font-medium text-white">{reward.title}</span>
                          </span>
                          <span className="shrink-0 text-xs text-[#FFD700]">{reward.cost} Chym</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  Hình phạt
                </p>
                <div className="space-y-2">
                  {activeWheelPunishments.length === 0 ? (
                    <p className="rounded-xl border border-white/5 bg-[#252532] px-4 py-3 text-xs text-white/35">
                      Chưa có hình phạt đang bật.
                    </p>
                  ) : (
                    activeWheelPunishments.map((punishment) => {
                      const selected = isWheelOptionSelected("punishment", punishment.id);
                      return (
                        <button
                          key={`punishment-${punishment.id}`}
                          type="button"
                          onClick={() =>
                            toggleWheelOption({
                              type: "punishment",
                              id: punishment.id,
                              label: punishment.title,
                            })
                          }
                          className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                            selected
                              ? "border-[#FF3B30]/50 bg-[#FF3B30]/10"
                              : "border-white/10 bg-[#252532] hover:border-white/20"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded border text-[10px] ${
                                selected
                                  ? "border-[#FF3B30] bg-[#FF3B30] text-white"
                                  : "border-white/20 text-transparent"
                              }`}
                            >
                              ✓
                            </span>
                            <span className="text-sm font-medium text-white">{punishment.title}</span>
                          </span>
                          <span className="shrink-0 text-xs text-[#FF7A59]">{punishment.chayCost} Chày</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={saveWheel}
              disabled={
                !wheelTitle.trim() ||
                createWheelMutation.isPending ||
                updateWheelMutation.isPending
              }
              className="w-full py-3 rounded-xl bg-[#A155FF] text-white font-semibold text-sm hover:bg-[#A155FF]/90 disabled:opacity-50 transition-colors"
            >
              {editingWheelId
                ? updateWheelMutation.isPending
                  ? "Đang lưu..."
                  : "Lưu vòng quay"
                : createWheelMutation.isPending
                ? "Đang tạo..."
                : "Tạo vòng quay"}
            </button>
          </div>
        ) : (
        <div className="space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {[
              { key: "regular" as const, label: "Nhiệm vụ", icon: <Zap className="w-4 h-4" /> },
              { key: "special" as const, label: "Đặc biệt", icon: <Trophy className="w-4 h-4" /> },
              { key: "superSpecial" as const, label: "Siêu đặc biệt", icon: <Star className="w-4 h-4" /> },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTaskType(t.key)}
                className={`flex-1 py-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                  taskType === t.key
                    ? "border-[#FF2A85] bg-[#FF2A85]/10 text-[#FF2A85]"
                    : "border-white/10 text-white/40 hover:border-white/20"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Frequency / Schedule */}
          {taskType === "regular" && (
            <div>
              <label className="text-xs text-white/50 mb-2 block">Lịch thực hiện</label>
              <div className="flex gap-2 mb-3">
                {([
                  { key: "frequency" as const, label: "Chu kỳ" },
                  { key: "custom" as const, label: "Ngày cụ thể" },
                ] as const).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setScheduleMode(m.key)}
                    className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                      scheduleMode === m.key
                        ? "border-[#00F2FE] bg-[#00F2FE]/10 text-[#00F2FE]"
                        : "border-white/10 text-white/40"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {scheduleMode === "frequency" ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(["daily", "weekly", "monthly"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => {
                          setFrequency(f);
                          setRecurringDays([]);
                        }}
                        className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                          frequency === f
                            ? "border-[#FF2A85] bg-[#FF2A85]/10 text-[#FF2A85]"
                            : "border-white/10 text-white/40"
                        }`}
                      >
                        {f === "daily" ? "Hàng ngày" : f === "weekly" ? "Hàng tuần" : "Hàng tháng"}
                      </button>
                    ))}
                  </div>
                  {frequency === "monthly" ? (
                    <div>
                      <label className="text-xs text-white/50 mb-2 block">Ngày trong tháng</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="Ngày trong tháng (1-31)"
                        value={recurringDays[0] ?? ""}
                        onChange={(e) =>
                          setRecurringDays(e.target.value ? [Number(e.target.value)] : [])
                        }
                        className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-white/50 mb-2 block">Ngày lặp trong tuần</label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { label: "T2", value: 1 },
                          { label: "T3", value: 2 },
                          { label: "T4", value: 3 },
                          { label: "T5", value: 4 },
                          { label: "T6", value: 5 },
                          { label: "T7", value: 6 },
                          { label: "CN", value: 0 },
                        ].map((day) => {
                          const selected = recurringDays.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() =>
                                setRecurringDays((prev) =>
                                  selected
                                    ? prev.filter((d) => d !== day.value)
                                    : frequency === "weekly"
                                    ? [day.value]
                                    : [...prev, day.value]
                                )
                              }
                              className={`w-10 h-10 rounded-xl border text-xs font-semibold transition-all ${
                                selected
                                  ? "border-[#FF2A85] bg-[#FF2A85]/15 text-[#FF2A85]"
                                  : "border-white/10 text-white/40 hover:border-white/20"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                      {frequency === "weekly" && (
                        <p className="mt-2 text-xs text-white/35">Chọn 1 ngày trong tuần</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Ngày bắt đầu</label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-[#252532] px-3 py-2.5 pl-9 text-xs text-white [color-scheme:dark] focus:border-[#00F2FE]/50 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Ngày kết thúc</label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        min={startDate || undefined}
                        className="w-full rounded-xl border border-white/10 bg-[#252532] px-3 py-2.5 pl-9 text-xs text-white [color-scheme:dark] focus:border-[#00F2FE]/50 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Tiêu đề</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề nhiệm vụ..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none transition-colors resize-none"
            />
          </div>

          {isAdmin && (
            <div>
              <label className="text-xs text-white/50 mb-2 block">Người nhận nhiệm vụ</label>
              <select
                value={selectedTaskAssigneeId}
                onChange={(e) => setSelectedTaskAssigneeId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
              >
                <option value="">Chưa giao</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname || "Thành viên"} - {member.lifestyleRole}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Due date chỉ cho special/superSpecial */}
          {taskType !== "regular" && (
            <div>
              <label className="text-xs text-white/50 mb-2 block">
                Thời gian thực hiện
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Ngày bắt đầu</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#252532] px-3 py-2.5 pl-9 text-xs text-white [color-scheme:dark] focus:border-[#00F2FE]/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Ngày kết thúc</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={startDate || undefined}
                      className="w-full rounded-xl border border-white/10 bg-[#252532] px-3 py-2.5 pl-9 text-xs text-white [color-scheme:dark] focus:border-[#00F2FE]/50 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rewards/Penalties */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-2 block">Thưởng Chym</label>
              <input
                type="number"
                value={chymReward}
                onChange={(e) => setChymReward(Number(e.target.value))}
                min={0}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Phạt Chày</label>
              <input
                type="number"
                value={chayPenalty}
                onChange={(e) => setChayPenalty(Number(e.target.value))}
                min={0}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-2 block">XP thêm</label>
            <input
              type="number"
              value={bonusXp}
              onChange={(e) => setBonusXp(Number(e.target.value))}
              min={0}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#00F2FE]/50 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-white/50 mb-2 block">Reward kèm</label>
              <select
                value={linkedRewardId}
                onChange={(e) => setLinkedRewardId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#35D07F]/50 focus:outline-none transition-colors"
              >
                <option value="">Không gắn reward</option>
                {availableRewards
                  .filter((reward) => reward.isActive)
                  .map((reward) => (
                    <option key={reward.id} value={reward.id}>
                      {reward.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-white/50 mb-2 block">Privilege kèm</label>
              <select
                value={linkedPrivilegeId}
                onChange={(e) => setLinkedPrivilegeId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#A155FF]/50 focus:outline-none transition-colors"
              >
                <option value="">Không gắn privilege</option>
                {availablePrivileges
                  .filter((privilege) => privilege.isActive)
                  .map((privilege) => (
                  <option key={privilege.id} value={privilege.id}>
                    {privilege.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-2 block">Hình phạt kèm</label>
            <select
              value={linkedPunishmentId}
              onChange={(e) => setLinkedPunishmentId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF3B30]/50 focus:outline-none transition-colors"
            >
              <option value="">Không gắn punishment</option>
              {availablePunishments
                .filter((punishment) => punishment.isActive)
                .map((punishment) => (
                  <option key={punishment.id} value={punishment.id}>
                    {punishment.title}
                    {punishment.chayCost > 0 ? ` - ${punishment.chayCost} Chày` : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreateTask}
            disabled={!title.trim()}
            className="w-full py-3 rounded-xl bg-[#FF2A85] text-white font-semibold text-sm hover:bg-[#FF2A85]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {editingTaskId ? "Lưu nhiệm vụ" : "Tạo nhiệm vụ"}
          </button>
        </div>
        )}
      </BottomSheet>

      <BottomSheet
        isOpen={assignTaskSheetId !== null}
        onClose={() => {
          setAssignTaskSheetId(null);
          setAssignTaskMemberId("");
        }}
        title="Giao nhiệm vụ"
      >
        <div className="space-y-4">
          {assignTaskTarget && (
            <div className="rounded-xl border border-[#FF2A85]/20 bg-[#FF2A85]/5 p-3">
              <p className="text-sm font-semibold text-white">{assignTaskTarget.title}</p>
              {assignTaskTarget.description && (
                <p className="mt-1 text-xs text-white/45 line-clamp-2">
                  {assignTaskTarget.description}
                </p>
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Người nhận nhiệm vụ</label>
            <select
              value={assignTaskMemberId}
              onChange={(event) => setAssignTaskMemberId(event.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
            >
              <option value="">Chọn người nhận</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.nickname || "Thành viên"} - {member.lifestyleRole}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={confirmAssignTask}
            disabled={assignTaskMutation.isPending || !assignTaskMemberId}
            className="w-full py-3 rounded-xl bg-[#FF2A85] text-white font-semibold text-sm hover:bg-[#FF2A85]/90 disabled:opacity-50 transition-colors"
          >
            {assignTaskMutation.isPending ? "Đang giao..." : "Giao nhiệm vụ"}
          </button>
        </div>
      </BottomSheet>

      {/* ── Submit Proof Sheet ── */}
      <BottomSheet
        isOpen={submitSheetTaskId !== null}
        onClose={() => setSubmitSheetTaskId(null)}
        title="Báo cáo nhiệm vụ"
      >
        <div className="space-y-4">
          <p className="text-xs text-white/40">
            Thêm ghi chú hoặc link bằng chứng trước khi gửi báo cáo.
          </p>

          {/* Note */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Ghi chú (tùy chọn)</label>
            <textarea
              id="submit-note-textarea"
              value={submitNote}
              onChange={(e) => setSubmitNote(e.target.value)}
              placeholder="Mô tả những gì bạn đã làm..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none resize-none"
            />
          </div>

          {/* Proof URL */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Link bằng chứng (tùy chọn)</label>
            <input
              id="submit-proof-url"
              type="url"
              value={submitProofUrl}
              onChange={(e) => setSubmitProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#00F2FE]/50 focus:outline-none"
            />
          </div>

          {/* Proof type */}
          {submitProofUrl.trim() && (
            <div>
              <label className="text-xs text-white/50 mb-2 block">Loại bằng chứng</label>
              <div className="flex gap-2">
                {(["image", "video", "link"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSubmitProofType(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${
                      submitProofType === t
                        ? "border-[#00F2FE]/50 bg-[#00F2FE]/10 text-[#00F2FE]"
                        : "border-white/10 text-white/40 hover:text-white/60"
                    }`}
                  >
                    {t === "image" ? "🖼 Ảnh" : t === "video" ? "🎬 Video" : "🔗 Link"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={confirmSubmitTask}
            disabled={submitTaskMutation.isPending}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #00F2FE, #A155FF)" }}
          >
            <Send className="w-4 h-4" />
            {submitTaskMutation.isPending ? "Đang gửi..." : "Gửi báo cáo"}
          </button>
        </div>
      </BottomSheet>

      {/* ── Review Proof Sheet ── */}
      <BottomSheet
        isOpen={reviewSheetTaskId !== null}
        onClose={() => {
          setReviewSheetTaskId(null);
          setReviewNote("");
        }}
        title="Duyệt báo cáo"
      >
        {(() => {
          const task = visibleTasks.find((item) => item.id === reviewSheetTaskId);
          const submissions = (submissionsQuery.data as TaskSubmission[] | undefined) ?? [];
          const latestSubmission = submissions[0];

          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
                <p className="text-xs text-white/30 mb-1">Nhiệm vụ</p>
                <h3 className="text-sm font-semibold text-white">{task?.title ?? "Nhiệm vụ"}</h3>
                {task?.description && (
                  <p className="mt-1 text-xs text-white/45 line-clamp-3">{task.description}</p>
                )}
              </div>

              {submissionsQuery.isLoading ? (
                <div className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
                  <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
                  <div className="mt-3 h-16 rounded bg-white/5 animate-pulse" />
                </div>
              ) : latestSubmission ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#00F2FE]/15 bg-[#00F2FE]/5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#00F2FE]">Báo cáo mới nhất</p>
                      <span className="text-[10px] text-white/30">
                        {new Date(latestSubmission.submittedAt).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    {latestSubmission.note ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-white/75">
                        {latestSubmission.note}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-white/30">Không có ghi chú.</p>
                    )}
                  </div>

                  {latestSubmission.proofUrl ? (
                    <div className="rounded-xl border border-white/5 bg-[#1A1A22] p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-white/40">Bằng chứng</p>
                        {latestSubmission.proofType && (
                          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase text-white/45">
                            {latestSubmission.proofType}
                          </span>
                        )}
                      </div>
                      <a
                        href={latestSubmission.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all rounded-lg border border-[#00F2FE]/20 bg-[#00F2FE]/5 px-3 py-2 text-xs text-[#00F2FE] hover:bg-[#00F2FE]/10"
                      >
                        {latestSubmission.proofUrl}
                      </a>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/5 bg-[#1A1A22] p-4 text-sm text-white/30">
                      Không có link bằng chứng.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[#FF3B30]/15 bg-[#FF3B30]/5 p-4 text-sm text-white/60">
                  Chưa tìm thấy báo cáo cho nhiệm vụ này.
                </div>
              )}

              <div>
                <label className="mb-2 block text-xs text-white/50">Ghi chú duyệt</label>
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  placeholder="Ghi phản hồi khi duyệt hoặc trả lại..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#A155FF]/50 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => reviewSheetTaskId && reviewTask(reviewSheetTaskId, "reject")}
                  disabled={reviewTaskMutation.isPending || !latestSubmission}
                  className="rounded-xl border border-[#FF3B30]/30 bg-[#FF3B30]/10 py-3 text-sm font-semibold text-[#FF3B30] transition-colors hover:bg-[#FF3B30]/15 disabled:opacity-50"
                >
                  Trả lại
                </button>
                <button
                  onClick={() => reviewSheetTaskId && reviewTask(reviewSheetTaskId, "approve")}
                  disabled={reviewTaskMutation.isPending || !latestSubmission}
                  className="rounded-xl bg-[#00F2FE] py-3 text-sm font-semibold text-[#0D0D11] transition-colors hover:bg-[#00F2FE]/90 disabled:opacity-50"
                >
                  Duyệt nhiệm vụ
                </button>
              </div>
            </div>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
