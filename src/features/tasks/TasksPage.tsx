import { useState } from "react";
import { useAppStore } from "@/shared/store/useAppStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Ban,
  Star,
  Link2,
  ChevronDown,
  Pen,
  Trophy,
  Zap,
  Send,
  CheckSquare,
} from "lucide-react";
import { FAB } from "@/shared/components/FAB";
import { BottomSheet } from "@/shared/components/BottomSheet";
import {
  mockHabits,
  mockTasks,
  mockMembers,
  taskCategories,
} from "@/shared/mockData/mockData";

export function TasksPage() {
  const { mockSystemRole, showToast } =
    useAppStore();
  const isAdmin = mockSystemRole === "admin";
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["daily"])
  );
  const [habitsState, setHabitsState] = useState(mockHabits);
  const [createSheet, setCreateSheet] = useState(false);
  const [createType, setCreateType] = useState<"task" | "habit">("task");
  const [taskType, setTaskType] = useState<"regular" | "special" | "superSpecial">("regular");
  const [habitType, setHabitType] = useState<"wanted" | "unwanted">("wanted");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chymReward, setChymReward] = useState(0);
  const [chayPenalty, setChayPenalty] = useState(0);
  interface TaskItem {
    id: number;
    houseId: number;
    title: string;
    description: string;
    category: string;
    chymReward: number;
    chayPenalty: number;
    status: string;
    assignedTo: number | null;
  }
  const [tasksState, setTasksState] = useState<TaskItem[]>(mockTasks as TaskItem[]);

  const subMember = mockMembers.find((m) => m.lifestyleRole === "submissive");

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleHabit = (id: number) => {
    setHabitsState((prev) =>
      prev.map((h) => (h.id === id ? { ...h, checkedToday: !h.checkedToday } : h))
    );
  };

  const handleCreateTask = () => {
    if (!title.trim()) return;
    const newTask = {
      id: tasksState.length + 1,
      houseId: 1,
      title,
      description: description || "",
      category: frequency as "daily" | "weekly" | "monthly" | "special" | "superSpecial",
      chymReward,
      chayPenalty,
      status: "active" as const,
      assignedTo: null as number | null,
    };
    setTasksState([...tasksState, newTask]);
    setCreateSheet(false);
    resetForm();
    showToast("Đã tạo nhiệm vụ mới!", "success");
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setChymReward(0);
    setChayPenalty(0);
    setFrequency("daily");
  };

  const getCategoryColor = (key: string) => {
    const cat = taskCategories.find((c) => c.key === key);
    return cat?.color || "#FF2A85";
  };

  const renderTasksForCategory = (categoryKey: string) => {
    const filtered =
      categoryKey === "completed"
        ? tasksState.filter((t) => t.status === "completed")
        : tasksState.filter(
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
          </div>
          {isAdmin && (
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 ml-2">
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
          <span
            className="text-xs px-2 py-1 rounded-md"
            style={{
              backgroundColor: `${getCategoryColor(task.category)}15`,
              color: getCategoryColor(task.category),
            }}
          >
            {task.category === "superSpecial"
              ? "Super Special"
              : task.category.charAt(0).toUpperCase() + task.category.slice(1)}
          </span>
        </div>
        {/* Admin/Sub actions */}
        <div className="flex gap-2 mt-3">
          {isAdmin ? (
            <>
              {task.assignedTo ? (
                <button className="flex-1 py-2 rounded-lg bg-[#FF2A85]/10 text-[#FF2A85] text-xs font-medium hover:bg-[#FF2A85]/20 transition-colors">
                  Đang chờ báo cáo
                </button>
              ) : (
                <button className="flex-1 py-2 rounded-lg bg-[#FF2A85]/10 text-[#FF2A85] text-xs font-medium hover:bg-[#FF2A85]/20 transition-colors">
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
                      <button className="flex-1 py-2 rounded-lg bg-[#FF2A85] text-white text-xs font-medium hover:bg-[#FF2A85]/90 transition-colors">
                        Nhận Task
                      </button>
                    ) : task.assignedTo === 2 ? (
                      <button className="flex-1 py-2 rounded-lg bg-[#00F2FE]/10 text-[#00F2FE] text-xs font-medium hover:bg-[#00F2FE]/20 transition-colors">
                        Báo cáo
                      </button>
                    ) : (
                      <span className="flex-1 py-2 rounded-lg bg-white/5 text-white/30 text-xs font-medium text-center">
                        Đã có ngườii nhận
                      </span>
                    )
                  ) : (
                    <button className="flex-1 py-2 rounded-lg bg-[#00F2FE]/10 text-[#00F2FE] text-xs font-medium hover:bg-[#00F2FE]/20 transition-colors">
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
            src={subMember?.telegramAvatar || "/avatars/sub.jpg"}
            alt="Avatar"
            className="w-20 h-20 rounded-xl object-cover border-2 border-[#FF2A85]/30"
          />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FF2A85] flex items-center justify-center">
            <Heart className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Wallets */}
        <div className="flex-1 grid grid-rows-2 gap-2">
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{subMember?.wallet.chymBalance}</p>
              <p className="text-xs text-white/50">Chym</p>
            </div>
            <Star className="w-6 h-6 text-[#FFD700]" />
          </div>
          <div className="bg-[#1A1A22] rounded-xl p-3 flex items-center justify-between border border-white/5">
            <div>
              <p className="text-2xl font-bold text-white">{subMember?.wallet.chayBalance}</p>
              <p className="text-xs text-white/50">Chày</p>
            </div>
            <Link2 className="w-6 h-6 text-[#FF3B30]" />
          </div>
        </div>
      </motion.div>

      {/* Habits Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
          Habits
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {habitsState.map((habit) => (
            <motion.button
              key={habit.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleHabit(habit.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border min-w-[80px] transition-all ${
                habit.checkedToday
                  ? habit.type === "wanted"
                    ? "border-[#FF2A85]/50 bg-[#FF2A85]/10"
                    : "border-[#FF3B30]/50 bg-[#FF3B30]/10"
                  : "border-white/5 bg-[#1A1A22]"
              }`}
            >
              {habit.type === "wanted" ? (
                <Heart
                  className={`w-5 h-5 ${
                    habit.checkedToday ? "text-[#FF2A85]" : "text-white/30"
                  }`}
                />
              ) : (
                <Ban
                  className={`w-5 h-5 ${
                    habit.checkedToday ? "text-[#FF3B30]" : "text-white/30"
                  }`}
                />
              )}
              <span className="text-[10px] text-white/70 text-center leading-tight whitespace-nowrap">
                {habit.title}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Manage button for admin */}
      {isAdmin && (
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 rounded-lg bg-[#1A1A22] border border-white/5 text-xs text-white/60 flex items-center gap-1.5 hover:bg-white/5 transition-colors">
            <CheckSquare className="w-3.5 h-3.5" /> Quản lý
          </button>
        </div>
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
                <span className="text-sm font-semibold text-white">{cat.label}</span>
                <span className="text-xs text-white/30">
                  {
                    (cat.key === "completed"
                      ? tasksState.filter((t) => t.status === "completed")
                      : tasksState.filter(
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
            label: "Send a Wheel",
            icon: <Send className="w-5 h-5 text-white" />,
            onClick: () => showToast("Surprise Wheel coming soon!", "info"),
            color: "#A155FF",
          },
          {
            label: "Create Task",
            icon: <Zap className="w-5 h-5 text-white" />,
            onClick: () => {
              setCreateType("task");
              setCreateSheet(true);
            },
            color: "#FF2A85",
          },
          {
            label: "Create Habit",
            icon: <Heart className="w-5 h-5 text-white" />,
            onClick: () => {
              setCreateType("habit");
              setCreateSheet(true);
            },
            color: "#00F2FE",
          },
        ]}
      />

      {/* Create Sheet */}
      <BottomSheet
        isOpen={createSheet}
        onClose={() => {
          setCreateSheet(false);
          resetForm();
        }}
        title={createType === "task" ? "Create New Task" : "Create New Habit"}
      >
        <div className="space-y-4">
          {/* Type selector */}
          {createType === "task" ? (
            <div className="flex gap-2">
              {[
                { key: "regular" as const, label: "Task", icon: <Zap className="w-4 h-4" /> },
                { key: "special" as const, label: "Special", icon: <Trophy className="w-4 h-4" /> },
                { key: "superSpecial" as const, label: "Super Special", icon: <Star className="w-4 h-4" /> },
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
          ) : (
            <div className="flex gap-2">
              {[
                { key: "wanted" as const, label: "Wanted", icon: <Heart className="w-4 h-4" /> },
                { key: "unwanted" as const, label: "Unwanted", icon: <Ban className="w-4 h-4" /> },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setHabitType(t.key)}
                  className={`flex-1 py-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                    habitType === t.key
                      ? "border-[#FF2A85] bg-[#FF2A85]/10 text-[#FF2A85]"
                      : "border-white/10 text-white/40 hover:border-white/20"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Frequency */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Frequency</label>
            <div className="flex gap-2">
              {(["daily", "weekly", "monthly"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                    frequency === f
                      ? "border-[#FF2A85] bg-[#FF2A85]/10 text-[#FF2A85]"
                      : "border-white/10 text-white/40"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-white/50 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Rewards/Penalties */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-2 block">Chym Reward</label>
              <input
                type="number"
                value={chymReward}
                onChange={(e) => setChymReward(Number(e.target.value))}
                min={0}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-2 block">Chay Penalty</label>
              <input
                type="number"
                value={chayPenalty}
                onChange={(e) => setChayPenalty(Number(e.target.value))}
                min={0}
                className="w-full px-4 py-3 rounded-xl bg-[#252532] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreateTask}
            disabled={!title.trim()}
            className="w-full py-3 rounded-xl bg-[#FF2A85] text-white font-semibold text-sm hover:bg-[#FF2A85]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Create {createType === "task" ? "Task" : "Habit"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
