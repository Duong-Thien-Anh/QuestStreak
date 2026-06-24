import { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";
import { ClipboardList, UserCheck } from "lucide-react";
import { apiUrl } from "@/lib/api";

const DEMO_ROLES = [
  {
    username: "demo_dom_1",
    title: "Task Creator",
    description: "Create tasks, review submissions, and manage the house.",
    icon: ClipboardList,
    accent: "#FF2A85",
  },
  {
    username: "demo_sub_1",
    title: "Task Receiver",
    description: "Receive tasks, submit proof, and track your progress.",
    icon: UserCheck,
    accent: "#22C55E",
  },
] as const;

type DemoUsername = (typeof DEMO_ROLES)[number]["username"];

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [loading, setLoading] = useState<DemoUsername | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDemoLogin = async (username: DemoUsername) => {
    setLoading(username);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/auth/demo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        credentials: "include",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Unable to start demo session");
      }

      setError(null);
      await utils.auth.me.invalidate();
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to start demo session";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-white/10 bg-[#1A1A22] text-white">
        <CardHeader className="text-center">
          <CardTitle>Continue as Demo</CardTitle>
          <p className="pt-2 text-sm text-white/55">
            Choose how you want to try Lunis House.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {DEMO_ROLES.map((role) => {
              const Icon = role.icon;
              const isLoading = loading === role.username;

              return (
                <button
                  key={role.username}
                  type="button"
                  disabled={loading !== null}
                  onClick={() => void handleDemoLogin(role.username)}
                  className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-[#252532] p-4 text-left transition hover:border-white/20 hover:bg-[#2B2B38] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${role.accent}22` }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: role.accent }}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {role.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/55">
                      {role.description}
                    </span>
                  </span>
                  {isLoading && (
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-xs text-[#FF6B6B]">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
