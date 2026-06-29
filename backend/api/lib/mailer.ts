import { env } from "./env";

interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

// Sends email via SMTP relay configured in env.
// Falls back to console log in dev so no SMTP creds are required locally.
export async function sendMail(payload: MailPayload): Promise<void> {
  const smtpUrl = env.smtpUrl;

  if (!smtpUrl) {
    console.log("[mailer] no SMTP_URL — would send:", payload.to, payload.subject);
    return;
  }

  // Use fetch-based relay (e.g. Resend / Brevo) if SMTP_URL starts with https
  if (smtpUrl.startsWith("https")) {
    const apiKey = env.smtpApiKey;
    const from = env.mailFrom || "noreply@lunis.app";

    const body = {
      from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    };

    const res = await fetch(`${smtpUrl}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[mailer] send failed:", res.status, text);
    }
    return;
  }

  console.log("[mailer] SMTP_URL set but nodemailer not bundled — skipping:", payload.to);
}

export function buildApprovalEmail(name: string): string {
  return `<p>Xin chào <strong>${name}</strong>,</p>
<p>Tài khoản của bạn đã được <strong>duyệt thành công</strong>. Bạn có thể đăng nhập vào Lunis House ngay bây giờ.</p>
<p>Trân trọng,<br/>Đội ngũ Lunis House</p>`;
}

export function buildRejectionEmail(name: string, reason?: string): string {
  return `<p>Xin chào <strong>${name}</strong>,</p>
<p>Yêu cầu đăng ký tài khoản của bạn đã bị <strong>từ chối</strong>.${reason ? ` Lý do: ${reason}` : ""}</p>
<p>Nếu có thắc mắc, vui lòng liên hệ quản trị viên.</p>
<p>Trân trọng,<br/>Đội ngũ Lunis House</p>`;
}
