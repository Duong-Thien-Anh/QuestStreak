/**
 * DemoLoginPage.tsx
 *
 * A dedicated /demo-login page that shows buttons to log in as each demo user.
 * Only usable when the server has DEMO_MODE=true set.
 *
 * JWT is stored in an httpOnly cookie by the server — never in localStorage.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { apiUrl } from "@/lib/api";

// ─── Demo User Config ─────────────────────────────────────────────────────────

const DEMO_USERS = [
  {
    username: "demo_dom_1",
    label: "Demo Dominant",
    description: "Vai trò: Dominant — quản lý nhà",
    emoji: "👑",
    accentColor: "#FF2A85",
  },
  {
    username: "demo_sub_1",
    label: "Demo Submissive",
    description: "Vai trò: Submissive — thành viên nhà",
    emoji: "🌸",
    accentColor: "#A855F7",
  },
  {
    username: "demo_admin",
    label: "Demo Admin",
    description: "Vai trò: Admin — toàn quyền hệ thống",
    emoji: "🛡️",
    accentColor: "#F59E0B",
  },
] as const;

type DemoUsername = (typeof DEMO_USERS)[number]["username"];

// ─── Page Component ───────────────────────────────────────────────────────────

export default function DemoLoginPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState<DemoUsername | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDemoLogin = async (username: DemoUsername) => {
    setLoading(username);
    setError(null);

    try {
      const res = await fetch(apiUrl("/api/auth/demo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        credentials: "include", // Ensure httpOnly cookie is received
      });

      if (res.status === 403) {
        throw new Error("Demo mode không được kích hoạt trên server này.");
      }

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Đăng nhập thất bại");
      }

      // Invalidate cached auth state then redirect
      await utils.auth.me.invalidate();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center space-y-1 pb-2">
          <p className="text-3xl">🏠</p>
          <h1 className="text-xl font-bold text-white">Lunis House</h1>
          <p className="text-sm text-white/40">Demo Login — chọn tài khoản thử nghiệm</p>
        </div>

        <Card className="border-white/10 bg-[#1A1A22] text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-center text-white/70">
              Tài khoản Demo
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {DEMO_USERS.map((u) => (
              <button
                key={u.username}
                id={`demo-login-${u.username}`}
                disabled={loading !== null}
                onClick={() => void handleDemoLogin(u.username)}
                className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
                style={{
                  borderColor: u.accentColor + "44",
                  backgroundColor: u.accentColor + "14",
                }}
              >
                <span className="text-2xl">{u.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-sm"
                    style={{ color: u.accentColor }}
                  >
                    {u.label}
                  </p>
                  <p className="text-xs text-white/40 truncate">{u.description}</p>
                </div>
                {loading === u.username && (
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin flex-shrink-0"
                    style={{ borderColor: u.accentColor + "66", borderTopColor: "transparent" }}
                  />
                )}
              </button>
            ))}

            {/* Error display */}
            {error && (
              <p className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-xs text-[#FF6B6B] text-center">
                {error}
              </p>
            )}

            {/* Divider */}
            <div className="h-px bg-white/10" />

            {/* Back to regular login */}
            <Button
              id="demo-back-to-login"
              className="w-full"
              variant="ghost"
              size="sm"
              onClick={() => navigate("/login")}
            >
              ← Quay lại đăng nhập thông thường
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-white/20">
          JWT được lưu trong httpOnly cookie · Chỉ hoạt động khi{" "}
          <code className="text-white/30">DEMO_MODE=true</code>
        </p>
      </div>
    </div>
  );
}
