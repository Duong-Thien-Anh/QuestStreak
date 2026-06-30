import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { getTelegramInitData, isTelegram } from "@/lib/platform";
import { useAppStore } from "@/shared/store/useAppStore";

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const setAuthToken = useAppStore((state) => state.setAuthToken);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [telegramLoginAttempted, setTelegramLoginAttempted] = useState(false);

  const telegramLoginMutation = trpc.auth.telegramLogin.useMutation({
    onSuccess: async ({ token, user }) => {
      setAuthToken(token);
      await utils.auth.me.invalidate();
      navigate(user.role === "admin" ? "/admin" : "/");
    },
    onError: (err) => setError(err.message),
  });

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (user) => {
      await utils.auth.me.invalidate();
      navigate(user.role === "admin" ? "/admin" : "/");
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ identifier: identifier.trim(), password, rememberMe });
  };

  useEffect(() => {
    if (
      !isTelegram() ||
      telegramLoginAttempted ||
      telegramLoginMutation.isPending ||
      telegramLoginMutation.isSuccess
    ) {
      return;
    }

    setError(null);
    setTelegramLoginAttempted(true);
    telegramLoginMutation.mutate({ initData: getTelegramInitData() });
  }, [
    telegramLoginAttempted,
    telegramLoginMutation,
  ]);

  if (isTelegram()) {
    return (
      <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#FF2A85]/40 border-t-[#FF2A85] animate-spin" />
          {error && (
            <p className="max-w-sm rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-center text-xs text-[#FF6B6B]">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-white/10 bg-[#1A1A22] text-white">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Đăng nhập</CardTitle>
          <p className="pt-1 text-sm text-white/55">Lunis House</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-white/60">Email / Tên đăng nhập / Số điện thoại</label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                className="w-full rounded-lg border border-white/10 bg-[#252532] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#FF2A85]/60 focus:outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/60">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-white/10 bg-[#252532] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#FF2A85]/60 focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-white/70">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#252532] accent-[#FF2A85]"
              />
              Ghi nhớ đăng nhập
            </label>

            {error && (
              <p className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-xs text-[#FF6B6B]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF2A85] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e02474] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending && (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              Đăng nhập
            </button>

            <p className="text-center text-xs text-white/40">
              Chưa có tài khoản?{" "}
              <Link to="/register" className="text-[#FF2A85] hover:underline">
                Đăng ký
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
