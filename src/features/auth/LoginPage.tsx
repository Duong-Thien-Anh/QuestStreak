import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useZaloAuth } from "./hooks/useZaloAuth";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const showDemoLogin = import.meta.env.DEV;
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const autoZaloLoginStarted = useRef(false);
  const [email, setEmail] = useState("local@example.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const zaloAuth = useZaloAuth();
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    loginMutation.mutate({
      email,
      password,
    });
  };

  useEffect(() => {
    if (!zaloAuth.isZaloMiniApp || autoZaloLoginStarted.current) return;
    autoZaloLoginStarted.current = true;
    void zaloAuth
      .loginWithZalo()
      .then(() => navigate("/"))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Không thể đăng nhập bằng Zalo";
        setError(message);
      });
  }, [navigate, zaloAuth]);

  return (
    <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4">
      <Card className="w-full max-w-sm border-white/10 bg-[#1A1A22] text-white">
        <CardHeader className="text-center">
          <CardTitle>Đăng nhập Lunis House</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {zaloAuth.isZaloMiniApp && (
            <Button
              className="w-full bg-[#0068FF] text-white hover:bg-[#0068FF]/90"
              size="lg"
              type="button"
              disabled={zaloAuth.isLoading}
              onClick={() => {
                setError(null);
                void zaloAuth
                  .loginWithZalo()
                  .then(() => navigate("/"))
                  .catch((err: unknown) => {
                    const message =
                      err instanceof Error
                        ? err.message
                        : "Không thể đăng nhập bằng Zalo";
                    setError(message);
                  });
              }}
            >
              {zaloAuth.isLoading ? "Đang đăng nhập Zalo..." : "Đăng nhập bằng Zalo"}
            </Button>
          )}

          {zaloAuth.isZaloMiniApp && <div className="h-px bg-white/10" />}

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-xs text-white/50">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs text-white/50">Mật khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/10 bg-[#252532] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#FF2A85]/50 focus:outline-none"
                placeholder="Nhập mật khẩu"
              />
            </div>
            {error && (
              <p className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-xs text-[#FF6B6B]">
                {error}
              </p>
            )}
            <Button
              className="w-full bg-[#FF2A85] text-white hover:bg-[#FF2A85]/90"
              size="lg"
              type="submit"
              disabled={!email.trim() || !password || loginMutation.isPending}
            >
              {loginMutation.isPending ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>

          <div className="h-px bg-white/10" />

          {showDemoLogin && (
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={() => {
                window.location.href = "/api/dev/login";
              }}
            >
              Continue as Demo
            </Button>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={() => {
              window.location.href = getOAuthUrl();
            }}
          >
            Sign in with Kimi
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
