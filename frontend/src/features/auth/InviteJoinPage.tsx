import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, AlertTriangle, Clock, ArrowRight, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAppStore } from "@/shared/store/useAppStore";

type PreviewData = {
  houseName: string;
  intendedNickname: string | null;
  lifestyleRole: "dominant" | "submissive" | "switch";
  gender: "male" | "female";
  status: "active" | "accepted" | "expired" | "revoked";
  expiresAt: Date | null;
  requiresApproval?: boolean;
};

const roleLabel: Record<string, string> = {
  dominant: "Dominant",
  submissive: "Submissive",
  switch: "Switch",
};
const roleColor: Record<string, string> = {
  dominant: "#A155FF",
  submissive: "#FF2A85",
  switch: "#00F2FE",
};

export function InviteJoinPage() {
  const { showToast } = useAppStore();
  const utils = trpc.useUtils();

  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [joinStatus, setJoinStatus] = useState<"joined" | "pending" | null>(null);
  const [autoPreviewRequested, setAutoPreviewRequested] = useState(false);
  const [houseName, setHouseName] = useState("Lunis House");

  const previewQuery = trpc.invite.preview.useQuery(
    { code: code.trim() },
    { enabled: false }
  );

  const joinMutation = trpc.invite.join.useMutation({
    onSuccess: (data) => {
      const nextStatus = data.joinStatus === "pending" ? "pending" : "joined";
      setJoinStatus(nextStatus);
      if (nextStatus === "joined") {
        void utils.house.get.invalidate();
        showToast("Chào mừng đến Lunis House! 🎉", "success");
        return;
      }
      showToast("Đã gửi yêu cầu tham gia phòng", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });
  const createHouseMutation = trpc.house.create.useMutation({
    onSuccess: async () => {
      setJoinStatus("joined");
      await utils.house.get.invalidate();
      showToast("Đã tạo phòng mới", "success");
    },
    onError: (err) => showToast(err.message, "error"),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get("room") ?? params.get("code");
    if (roomCode) {
      setCode(roomCode);
      setAutoPreviewRequested(true);
    }
  }, []);

  const handlePreview = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length < 4) return;
    setPreviewLoading(true);
    try {
      const result = await previewQuery.refetch();
      setPreview(result.data as PreviewData | null);
      if (result.data) {
        setGender((result.data as PreviewData).gender === "male" ? "male" : "female");
      }
      if (!result.data) {
        showToast("Không tìm thấy mã phòng này", "error");
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [code, previewQuery, showToast]);

  useEffect(() => {
    if (!autoPreviewRequested || code.trim().length < 4) return;
    setAutoPreviewRequested(false);
    void handlePreview();
  }, [autoPreviewRequested, code, handlePreview]);

  const handleJoin = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    joinMutation.mutate({
      code: trimmed,
      nickname: nickname.trim() || undefined,
      gender,
    });
  };

  const handleCreateHouse = () => {
    createHouseMutation.mutate({
      name: houseName.trim() || "Lunis House",
    });
  };

  const isActive = preview?.status === "active";

  if (joinStatus) {
    const pending = joinStatus === "pending";
    return (
      <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FF2A85] to-[#A155FF] flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(255,42,133,0.4)]"
          >
            <Check className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">
            {pending ? "Đang chờ duyệt" : "Chào mừng!"}
          </h1>
          <p className="text-white/50 text-sm">
            {pending
              ? "Yêu cầu tham gia phòng đã được gửi cho Task Creator."
              : "Bạn đã tham gia Lunis House thành công."}
          </p>
          <p className="text-white/30 text-xs">
            {pending
              ? "Bạn sẽ vào phòng sau khi được duyệt."
              : "Trang sẽ tự động cập nhật..."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #FF2A85, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full opacity-8"
          style={{ background: "radial-gradient(circle, #A155FF, transparent 70%)" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-5 relative z-10"
      >
        {/* Logo */}
        <div className="text-center space-y-2 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF2A85] to-[#A155FF] flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(255,42,133,0.3)]">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Lunis House</h1>
          <p className="text-white/40 text-sm">Nhập mã phòng để tham gia</p>
        </div>

        {/* Code Input */}
        <div className="space-y-3">
          <div className="relative">
            <input
              id="invite-code-input"
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
              placeholder="Mã phòng"
              maxLength={32}
              className="w-full px-4 py-4 rounded-xl bg-[#1A1A22] border border-white/10 text-[#00F2FE] font-mono text-xl tracking-widest text-center placeholder:text-white/15 focus:border-[#00F2FE]/40 focus:outline-none transition-colors"
              onKeyDown={(e) => e.key === "Enter" && void handlePreview()}
            />
          </div>
          <button
            onClick={() => void handlePreview()}
            disabled={previewLoading || code.trim().length < 4}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white/80 border border-white/10 hover:border-white/20 hover:bg-white/3 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
          >
            {previewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Xem trước
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1A1A22]/70 p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-white">Tạo phòng mới</p>
            <p className="mt-1 text-xs text-white/40">
              Nếu bạn là người đầu tiên, đặt tên phòng để trở thành người ra task rồi gửi mã phòng cho người còn lại.
            </p>
          </div>
          <input
            type="text"
            value={houseName}
            onChange={(event) => setHouseName(event.target.value)}
            maxLength={255}
            className="w-full px-4 py-3 rounded-xl bg-[#141418] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
            placeholder="Tên phòng"
          />
          <button
            onClick={handleCreateHouse}
            disabled={createHouseMutation.isPending}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white border border-[#FF2A85]/30 bg-[#FF2A85]/10 hover:bg-[#FF2A85]/15 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {createHouseMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Crown className="w-4 h-4" />
            )}
            Tạo phòng với vai trò ra task
          </button>
        </div>

        {/* Preview Card */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className={`rounded-2xl border p-4 space-y-3 ${
                isActive
                  ? "border-[#FF2A85]/30 bg-[#FF2A85]/5"
                  : "border-[#FF3B30]/20 bg-[#FF3B30]/5"
              }`}
            >
              {!isActive && (
                <div className="flex items-center gap-2 text-[#FF3B30]">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs font-semibold">
                    {preview.status === "expired" ? "Mã phòng đã hết hạn" : "Mã phòng không hợp lệ"}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Phòng</span>
                  <span className="text-sm font-semibold text-white">{preview.houseName}</span>
                </div>
                {preview.intendedNickname && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Dành cho</span>
                    <span className="text-sm font-medium text-white">{preview.intendedNickname}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Vai trò</span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: roleColor[preview.lifestyleRole] }}
                  >
                    {roleLabel[preview.lifestyleRole]}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Duyệt thành viên</span>
                  <span className="text-sm font-medium text-white">
                    {preview.requiresApproval ? "Cần duyệt" : "Vào ngay"}
                  </span>
                </div>
                {preview.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40">Hết hạn</span>
                    <span className="text-xs text-white/50 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(preview.expiresAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                )}
              </div>

              {/* Nickname override */}
              {isActive && (
                <div className="pt-2 border-t border-white/5 space-y-3">
                  <input
                    id="join-nickname-input"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={preview.intendedNickname ?? "Biệt danh của bạn (tùy chọn)"}
                    className="w-full px-4 py-3 rounded-xl bg-[#1A1A22] border border-white/10 text-white text-sm placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
                  />
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as typeof gender)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1A1A22] border border-white/10 text-white text-sm focus:border-[#FF2A85]/50 focus:outline-none"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                  <button
                    onClick={handleJoin}
                    disabled={joinMutation.isPending}
                    className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #FF2A85, #A155FF)" }}
                  >
                    {joinMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {preview.requiresApproval ? "Gửi yêu cầu tham gia" : "Tham gia House"}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
