import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  Link as LinkIcon,
  Plus,
  Trash2,
  Clock,
  UserPlus,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/shared/store/useAppStore";

type InviteStatus = "active" | "accepted" | "expired" | "revoked";

interface HouseInvite {
  id: number;
  houseId: number;
  code: string;
  invitedBy: number;
  intendedNickname: string | null;
  lifestyleRole: "dominant" | "submissive" | "switch";
  gender: "male" | "female";
  expiresAt: Date | null;
  status: InviteStatus;
  acceptedBy: number | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const statusConfig: Record<InviteStatus, { label: string; color: string; bg: string }> = {
  active:   { label: "Đang hoạt động", color: "#00F2FE", bg: "rgba(0,242,254,0.1)" },
  accepted: { label: "Đã dùng",        color: "#A155FF", bg: "rgba(161,85,255,0.1)" },
  expired:  { label: "Hết hạn",        color: "#52525B", bg: "rgba(82,82,91,0.2)" },
  revoked:  { label: "Đã thu hồi",     color: "#FF3B30", bg: "rgba(255,59,48,0.1)" },
};

function formatExpiry(date: Date | null | string): string {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getInviteLink(code: string) {
  return `${window.location.origin}/?invite=${encodeURIComponent(code)}`;
}

function getEffectiveStatus(invite: HouseInvite): InviteStatus {
  if (invite.status !== "active" || !invite.expiresAt) return invite.status;
  return new Date(invite.expiresAt).getTime() <= Date.now() ? "expired" : "active";
}

function CopyButton({
  text,
  title = "Copy code",
  icon = "copy",
}: {
  text: string;
  title?: string;
  icon?: "copy" | "link";
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
      title={title}
    >
      {copied
        ? <Check className="w-4 h-4 text-[#34D399]" />
        : icon === "link"
          ? <LinkIcon className="w-4 h-4 text-white/50" />
          : <Copy className="w-4 h-4 text-white/50" />}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

interface InviteManagementPanelProps {
  houseId: number;
}

export function InviteManagementPanel({ houseId }: InviteManagementPanelProps) {
  const { showToast } = useAppStore();
  const utils = trpc.useUtils();

  const [showCreate, setShowCreate] = useState(false);
  const [newlyCreated, setNewlyCreated] = useState<string | null>(null);
  const [form, setForm] = useState({
    intendedNickname: "",
    lifestyleRole: "submissive" as "dominant" | "submissive" | "switch",
    gender: "female" as "male" | "female",
    expiresInDays: 7,
  });

  const listQuery = trpc.invite.list.useQuery(
    { houseId },
    { retry: false }
  );
  const invites = (listQuery.data as HouseInvite[] | undefined) ?? [];

  const createMutation = trpc.invite.create.useMutation({
    onSuccess: (data) => {
      void utils.invite.list.invalidate();
      setNewlyCreated((data as HouseInvite).code);
      setShowCreate(false);
      setForm({ intendedNickname: "", lifestyleRole: "submissive", gender: "female", expiresInDays: 7 });
      showToast("Đã tạo invite code!", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const revokeMutation = trpc.invite.revoke.useMutation({
    onSuccess: () => {
      void utils.invite.list.invalidate();
      showToast("Đã thu hồi invite!", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  const handleCreate = () => {
    createMutation.mutate({ houseId, ...form });
  };

  return (
    <div className="space-y-4">

      {/* Newly created code highlight */}
      <AnimatePresence>
        {newlyCreated && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-xl border border-[#00F2FE]/30 bg-[#00F2FE]/5"
          >
            <p className="text-xs text-[#00F2FE]/70 mb-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Invite code mới
            </p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xl tracking-widest text-[#00F2FE] flex-1 bg-[#141418] rounded-lg px-3 py-2">
                {newlyCreated}
              </p>
              <CopyButton text={newlyCreated} title="Copy invite code" />
              <CopyButton text={getInviteLink(newlyCreated)} title="Copy invite link" icon="link" />
            </div>
            <p className="mt-2 text-[11px] text-white/35 break-all">
              {getInviteLink(newlyCreated)}
            </p>
            <button
              onClick={() => setNewlyCreated(null)}
              className="mt-2 text-[10px] text-white/30 hover:text-white/50"
            >
              Đóng
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Section */}
      <div className="bg-[#141418] rounded-xl border border-white/5">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors rounded-xl"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF2A85]/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#FF2A85]" />
            </div>
            <span className="text-sm font-semibold text-white">Tạo Invite Code</span>
          </div>
          <motion.span
            animate={{ rotate: showCreate ? 45 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-white/30"
          >
            +
          </motion.span>
        </button>

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                <input
                  type="text"
                  placeholder="Biệt danh dự kiến (tùy chọn)"
                  value={form.intendedNickname}
                  onChange={(e) => setForm((f) => ({ ...f, intendedNickname: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-[#1A1A22] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Vai trò</label>
                    <select
                      value={form.lifestyleRole}
                      onChange={(e) => setForm((f) => ({ ...f, lifestyleRole: e.target.value as typeof f.lifestyleRole }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A22] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
                    >
                      <option value="submissive">Submissive</option>
                      <option value="dominant">Dominant</option>
                      <option value="switch">Switch</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 mb-1 block">Giới tính</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as typeof f.gender }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#1A1A22] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-white/40 mb-1 block">Hết hạn sau (ngày)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={form.expiresInDays}
                    onChange={(e) => setForm((f) => ({ ...f, expiresInDays: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#1A1A22] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #FF2A85, #A155FF)" }}
                >
                  {createMutation.isPending ? "Đang tạo..." : "Tạo Invite Code"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Invite List */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5" />
          Danh sách Invite ({invites.length})
        </h3>

        {listQuery.isLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />
            ))}
          </div>
        )}

        {!listQuery.isLoading && invites.length === 0 && (
          <div className="text-center py-8 text-white/20 text-sm">
            Chưa có invite nào được tạo
          </div>
        )}

        <div className="space-y-2">
          {invites.map((invite, i) => {
            const effectiveStatus = getEffectiveStatus(invite);
            const cfg = statusConfig[effectiveStatus] ?? statusConfig.expired;
            const inviteLink = getInviteLink(invite.code);
            return (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-[#141418] rounded-xl border border-white/5 p-3"
              >
                <div className="flex items-center gap-3">
                  {/* Code */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm text-[#00F2FE] tracking-wider">
                        {invite.code}
                      </p>
                      <CopyButton text={invite.code} title="Copy invite code" />
                      <CopyButton text={inviteLink} title="Copy invite link" icon="link" />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {invite.intendedNickname && (
                        <span className="text-[10px] text-white/50">{invite.intendedNickname}</span>
                      )}
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ color: cfg.color, backgroundColor: cfg.bg }}
                      >
                        {cfg.label}
                      </span>
                      {invite.expiresAt && (
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatExpiry(invite.expiresAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Revoke */}
                  {effectiveStatus === "active" && (
                    <button
                      onClick={() => revokeMutation.mutate({ inviteId: invite.id })}
                      disabled={revokeMutation.isPending}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FF3B30]/10 transition-colors flex-shrink-0 disabled:opacity-40"
                      title="Thu hồi invite"
                    >
                      <Trash2 className="w-4 h-4 text-[#FF3B30]/60" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
