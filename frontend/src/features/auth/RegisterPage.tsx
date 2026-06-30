import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/providers/trpc";

const LIFESTYLE_ROLES = [
  { value: "dominant", label: "Dominant" },
  { value: "submissive", label: "Submissive" },
  { value: "switch", label: "Switch" },
] as const;

const GENDERS = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
] as const;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    phone: "",
    password: "",
    confirmPassword: "",
    lifestyleRole: "submissive" as "dominant" | "submissive" | "switch",
    gender: "female" as "male" | "female",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    registerMutation.mutate({
      name: form.name,
      email: form.email,
      username: form.username || undefined,
      phone: form.phone || undefined,
      password: form.password,
      lifestyleRole: form.lifestyleRole,
      gender: form.gender,
    });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-white/10 bg-[#1A1A22] text-white">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-[#22C55E]/15">
              <svg className="h-7 w-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-base font-semibold">Yêu cầu đã được gửi!</p>
            <p className="text-sm text-white/55">
              Admin sẽ xem xét và duyệt tài khoản của bạn. Bạn sẽ nhận email thông báo kết quả.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="mt-2 text-sm text-[#FF2A85] hover:underline"
            >
              Quay lại đăng nhập
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D11] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md border-white/10 bg-[#1A1A22] text-white">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Đăng ký tài khoản</CardTitle>
          <p className="pt-1 text-sm text-white/55">Điền thông tin để gửi yêu cầu đăng ký</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Họ tên *">
              <input
                type="text"
                value={form.name}
                onChange={set("name")}
                required
                className={inputCls}
                placeholder="Nguyễn Văn A"
              />
            </Field>

            <Field label="Email *">
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                autoComplete="email"
                className={inputCls}
                placeholder="email@example.com"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tên đăng nhập">
                <input
                  type="text"
                  value={form.username}
                  onChange={set("username")}
                  className={inputCls}
                  placeholder="username"
                />
              </Field>
              <Field label="Số điện thoại">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  className={inputCls}
                  placeholder="0912345678"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Role *">
                <select
                  value={form.lifestyleRole}
                  onChange={set("lifestyleRole")}
                  className={selectCls}
                >
                  {LIFESTYLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Giới tính *">
                <select
                  value={form.gender}
                  onChange={set("gender")}
                  className={selectCls}
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Mật khẩu * (tối thiểu 8 ký tự)">
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                required
                minLength={8}
                autoComplete="new-password"
                className={inputCls}
                placeholder="••••••••"
              />
            </Field>

            <Field label="Xác nhận mật khẩu *">
              <input
                type="password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                required
                autoComplete="new-password"
                className={inputCls}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p className="rounded-lg border border-[#FF3B30]/20 bg-[#FF3B30]/10 px-3 py-2 text-xs text-[#FF6B6B]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF2A85] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e02474] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {registerMutation.isPending && (
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              )}
              Gửi yêu cầu đăng ký
            </button>

            <p className="text-center text-xs text-white/40">
              Đã có tài khoản?{" "}
              <Link to="/login" className="text-[#FF2A85] hover:underline">
                Đăng nhập
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#252532] px-3 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#FF2A85]/60 focus:outline-none";

const selectCls =
  "w-full rounded-lg border border-white/10 bg-[#252532] px-3 py-2.5 text-sm text-white focus:border-[#FF2A85]/60 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-white/60">{label}</label>
      {children}
    </div>
  );
}
