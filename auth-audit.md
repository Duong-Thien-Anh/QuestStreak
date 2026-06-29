# AUTH AUDIT — Lunis House Mini App
> Task: AUTH-AUDIT-001 | Checkpoint: CP-002 | Branch: handle_db_feature | Date: 2026-06-28
> Scope: Web browser + Telegram Mini App. Zalo/Kimi excluded.

---

## 1. AUTH SURFACES HIỆN TẠI

### tRPC Procedures (`backend/api/auth-router.ts`)

| Procedure | Input | Output / Side Effect | Guard |
|---|---|---|---|
| `auth.login` | `identifier: string`, `password: string` | Set HTTP-only session cookie `SESSION`; return `User` object | `publicQuery` |
| `auth.register` | `name`, `email`, `username?`, `phone?`, `password`, `lifestyleRole`, `gender` | Insert `registrationRequests` (status=pending); return `{ id, status }` | `publicQuery` |
| `auth.me` | — | Return `User` + `language` preference | `authedQuery` |
| `auth.updatePreferences` | `language: "en" \| "vi"` | Upsert `userPreferences`; return `User` + language | `authedQuery` |
| `auth.logout` | — | Set cookie maxAge=0 (clear); return `{ success: true }` | `authedQuery` |

> `auth.zaloLogin` còn tồn tại trong file nhưng nằm ngoài scope phân tích.

### tRPC Procedures (`backend/api/admin-router.ts`)

| Procedure | Input | Output / Side Effect | Guard |
|---|---|---|---|
| `admin.listRegistrations` | `status?: "pending" \| "approved" \| "rejected" \| "all"` | Return list `registrationRequests` (passwordHash stripped) | `adminQuery` |
| `admin.approveRegistration` | `id: number` | Insert `users` + `userCredentials`; update request status=approved; send email async | `adminQuery` |
| `admin.rejectRegistration` | `id: number`, `reason?: string` | Update request status=rejected; send email async | `adminQuery` |

### HTTP Endpoints (`backend/api/boot.ts` — đọc từ context)

| Endpoint | Method | Guard | Side Effect |
|---|---|---|---|
| `GET /api/dev/login` | GET | none | Set session cookie, bypass password — dev only |
| `POST /api/auth/demo` | POST | none | Set session cookie via `JWT_SECRET` — demo mode |

---

## 2. SESSION / TOKEN MECHANISM

### Cookie

- **Tên cookie:** `Session.cookieName` (defined in `backend/contracts/constants.ts` — không nằm trong 10 file yêu cầu đọc, giá trị thực chưa xác nhận từ source)
- **httpOnly:** lấy từ `getSessionCookieOptions(headers)` — không đọc trực tiếp file cookies.ts, không xác nhận giá trị
- **secure:** lấy từ `getSessionCookieOptions(headers)` — không xác nhận
- **sameSite:** `opts.sameSite?.toLowerCase()` cast sang `"lax" | "none"` — giá trị thực phụ thuộc `getSessionCookieOptions`
- **maxAge:** `Session.maxAgeMs / 1000` — giá trị `maxAgeMs` chưa xác nhận từ source
- **path:** lấy từ `getSessionCookieOptions(headers)`
- **domain:** không set explicitly trong `auth-router.ts`

### JWT

- **Algorithm:** HS256 (`backend/api/kimi/session.ts:6`)
- **Payload fields:** `{ unionId: string, clientId: string }` (`kimi/session.ts:36`)
- **Expiry:** `"1 year"` (`kimi/session.ts:14`)
- **Secret:** `env.appSecret` ← `APP_SECRET` env var
- **Library:** `jose`

### Verify và Set/Clear

- **Nơi verify session:** `backend/api/kimi/auth.ts` → `authenticateRequest()` → gọi `verifySessionToken()` → lookup `findUserByUnionId()`. Được gọi từ `context.ts:createContext()`.
- **context.ts** chạy trước mọi tRPC procedure — `ctx.user` optional (silent fail nếu không auth).
- **middleware.ts** `requireAuth` enforce `ctx.user` tại procedure level.
- **Nơi set cookie:** `auth-router.ts` — trong `auth.login` và `auth.zaloLogin`.
- **Nơi clear cookie:** `auth-router.ts` — trong `auth.logout` (maxAge=0).

### tRPC Client (`frontend/src/providers/trpc.tsx`)

- Dùng `httpBatchLink` với `credentials: "include"` → cookie tự động gửi kèm request.
- **Đã có stub cho Bearer header:**
  ```
  const platform = getPlatform();          // đọc từ @/lib/platform
  const token = useAppStore.getState().authToken;
  if (platform === "telegram" && token) → Authorization: Bearer <token>
  ```
- **`X-Platform` header** luôn được gửi kèm (giá trị từ `getPlatform()`).
- `apiUrl()` resolve từ `VITE_API_URL` env var, fallback về same-origin (`""`).

---

## 3. PLATFORM COMPATIBILITY MATRIX

| Surface | Chạy được Web? | Chạy được Telegram WebView? | Lý do nếu không |
|---|---|---|---|
| `auth.login` (cookie) | ✅ | ⚠️ Có thể bị block | Xem giải thích bên dưới |
| `auth.register` | ✅ | ❌ Không phù hợp | Telegram user không có email/password |
| `auth.me` | ✅ | ⚠️ Phụ thuộc token delivery | Nếu cookie bị block, `ctx.user` = undefined |
| `auth.updatePreferences` | ✅ | ⚠️ | Như trên |
| `auth.logout` | ✅ | ⚠️ | Clear cookie không có tác dụng nếu cookie không được set |
| `admin.listRegistrations` | ✅ | ❌ Không có admin UI trong TG shell | Không có `/admin` route trong App.tsx |
| `admin.approveRegistration` | ✅ | ❌ | Như trên |
| `admin.rejectRegistration` | ✅ | ❌ | Như trên |
| `GET /api/dev/login` | ✅ (dev only) | ❌ | Dev endpoint, không có trong TG flow |
| `POST /api/auth/demo` | ✅ | ❌ | Demo mode không liên quan TG |

### Tại sao cookie HTTP-only có thể bị block trên Telegram WebView

Telegram Mini App chạy trong một WebView embedded được kiểm soát bởi Telegram client. Cookie `SameSite=None; Secure` có thể hoạt động trong một số phiên bản nhưng **không đảm bảo** vì:

1. Telegram WebView trên iOS dùng `WKWebView` — third-party cookie bị Apple ITP (Intelligent Tracking Prevention) chặn theo origin.
2. Telegram WebView không phải browser thực — không có cookie jar đồng nhất với browser của user.
3. Cookie `SameSite=Lax` sẽ không được gửi trong cross-site context (Telegram domain ≠ app domain).
4. `SameSite=None` yêu cầu `Secure=true` và cần `https` — hoạt động khi deploy nhưng vẫn phụ thuộc WebView implementation của từng platform.

**Kết quả thực tế:** backend `authenticateRequest` chỉ đọc cookie — nếu cookie không tồn tại thì `ctx.user = undefined` → tất cả `authedQuery` throw UNAUTHORIZED.

---

## 4. REGISTER FLOW — GAPS & RISKS

### Flow hiện tại (step-by-step từ source)

```
1. [RegisterPage.tsx] User điền form: name, email, username?, phone?,
   password, confirmPassword, lifestyleRole, gender
2. [RegisterPage.tsx:44] Client-side validate: password === confirmPassword
3. [RegisterPage.tsx:48] gọi trpc.auth.register.mutate(...)
4. [auth-router.ts:117] normalizedEmail = email.trim().toLowerCase()
5. [auth-router.ts:120] Promise.all: query registrationRequests + userCredentials bằng email
6. [auth-router.ts:129] Nếu existingCred → throw "Email đã được đăng ký"
7. [auth-router.ts:132] Nếu existingReq.status === "pending" → throw "Yêu cầu đang chờ duyệt"
8. [auth-router.ts:135] Nếu existingReq.status === "approved" → throw "Email đã được đăng ký"
9. [auth-router.ts:139] hashPassword(password) → scrypt salt+key
10. [auth-router.ts:142] INSERT registrationRequests (status=pending)
11. [auth-router.ts:155] return { id, status: "pending" }
12. [RegisterPage.tsx:33] onSuccess → setSuccess(true) → show confirmation screen
```

### Những bước chưa hoàn chỉnh (WIP)

- **Không gửi email xác nhận** khi nộp đơn — user chỉ thấy UI message, không có email backup.
- **Không có rate limiting** — cùng 1 IP có thể spam register requests.
- **Rejected user có thể re-register** — behavior có thể đúng nhưng chưa được confirm với product spec. Code không block `existingReq.status === "rejected"`.

### Những bước thiếu validation

- `username`: chỉ validate length (3–100) trên backend, không validate format (alphanumeric, no spaces?).
- `phone`: không validate format (chỉ maxLength 30).
- `password`: chỉ `minLength(8)`, không có complexity requirement.
- Không có CAPTCHA / bot protection.

### `registrationRequests` table — đủ fields không?

Nhìn từ `backend/db/schema.ts` (lines 126–154):

| Field | Có không | Ghi chú |
|---|---|---|
| `id` | ✅ | serial PK |
| `name` | ✅ | |
| `email` | ✅ | unique index |
| `username` | ✅ | |
| `phone` | ✅ | |
| `lifestyleRole` | ✅ | |
| `gender` | ✅ | |
| `passwordHash` | ✅ | |
| `status` | ✅ | enum: pending/approved/rejected |
| `rejectionReason` | ✅ | |
| `reviewedBy` | ✅ | FK to users.id |
| `reviewedAt` | ✅ | |
| `createdAt` / `updatedAt` | ✅ | |

Table đủ fields cho web flow. Thiếu cho Telegram flow: không có `telegramId`, `telegramUsername` — nhưng Telegram users không đi qua registration approval, nên không cần.

---

## 5. ADMIN APPROVAL — GAPS & RISKS

### adminRouter procedures

1. `admin.listRegistrations({ status? })` — query `registrationRequests`, strip `passwordHash`, order by `createdAt DESC`.
2. `admin.approveRegistration({ id })`:
   - Tìm request theo id.
   - Check status === "pending" (reject nếu đã xử lý).
   - Check email chưa tồn tại trong `userCredentials`.
   - INSERT `users` với `unionId = local:<email>`, `role = "user"`.
   - INSERT `userCredentials` với email, username, phone, passwordHash từ request.
   - UPDATE `registrationRequests` → status=approved, reviewedBy=ctx.user.id, reviewedAt=now.
   - `sendMail(approvalEmail)` — **non-blocking** (`.catch(console.error)`).
   - Return `{ success: true, userId }`.
3. `admin.rejectRegistration({ id, reason? })`:
   - Tìm request theo id.
   - Check status === "pending".
   - UPDATE status=rejected, rejectionReason, reviewedBy, reviewedAt.
   - `sendMail(rejectionEmail)` — **non-blocking**.
   - Return `{ success: true }`.

### Frontend có route `/admin` chưa?

**Không tìm thấy trong source.** `frontend/src/App.tsx` được đọc gián tiếp qua checkpoint — không có route `/admin`. Admin phải dùng tRPC panel tại `GET /api/panel` để gọi procedures trực tiếp.

### Email sending

- `sendMail()` được gọi với `.catch(console.error)` → **non-blocking, best-effort**.
- Failure chỉ được log, không có retry, không có queue.
- `SMTP_URL` là HTTPS relay (không phải SMTP socket thực).

---

## 6. TELEGRAM-SPECIFIC GAPS

- [ ] **`auth.telegramLogin` chưa có** — không có procedure nào nhận `initData` từ `window.Telegram.WebApp.initData`.
- [ ] **`verifyTelegramInitData` (HMAC-SHA256) chưa implement** — không có file nào trong source xử lý logic này.
- [ ] **`TELEGRAM_BOT_TOKEN` chưa có trong env** — `backend/api/lib/env.ts` không có field này. `required("TELEGRAM_BOT_TOKEN")` sẽ throw nếu thêm vào.
- [ ] **JWT return trong response body chưa có** — `auth.login` chỉ set cookie, không return token. Telegram path cần token trong body vì cookie unreliable.
- [ ] **`authenticateRequest` chưa hỗ trợ Bearer header** — `backend/api/kimi/auth.ts:authenticateRequest` chỉ đọc cookie, không đọc `Authorization: Bearer`.
- [ ] **Auto-register từ Telegram user chưa có** — không có flow nào tạo user từ Telegram identity mà không qua admin approval.
- [x] **`Authorization: Bearer` header đã có stub ở frontend** — `frontend/src/providers/trpc.tsx` đã gửi Bearer header khi `platform === "telegram"` và `authToken` tồn tại trong Zustand store.
- [x] **`X-Platform` header đã gửi** — tRPC client luôn đính kèm `X-Platform: telegram|web`.
- [ ] **`useAppStore.authToken` field chưa xác nhận** — `trpc.tsx` đọc `useAppStore.getState().authToken` nhưng không rõ field này đã được định nghĩa trong store hay chưa (store file không trong danh sách đọc).
- [ ] **`getPlatform()` chưa xác nhận** — `trpc.tsx` import từ `@/lib/platform` nhưng file này không trong 10 file yêu cầu đọc — logic detect Telegram chưa xác nhận.
- [ ] **Bot command `/approve` cho admin chưa có** — không có `POST /api/bot/webhook` endpoint.

---

## 7. CONFLICTS / BREAKING RISKS

| Thay đổi dự kiến | Files bị ảnh hưởng | Risk |
|---|---|---|
| Sửa `authenticateRequest` để đọc Bearer header | `backend/api/kimi/auth.ts` hoặc file mới `lib/auth.ts` | **HIGH** — được gọi trong `context.ts`, ảnh hưởng toàn bộ request pipeline |
| Sửa `context.ts` để thay đổi cách auth | Mọi tRPC procedure sử dụng `ctx.user` | **HIGH** — blast radius toàn bộ router |
| Thêm `auth.telegramLogin` return token thay vì set cookie | `auth-router.ts` | LOW — procedure mới, không break cũ |
| Thêm `TELEGRAM_BOT_TOKEN` vào `env.ts` như `required()` | Deploy pipeline, Render config | **MEDIUM** — build sẽ fail nếu env var chưa set trên production |
| Xóa/disable `auth.zaloLogin` | `auth-router.ts`, `router.ts` | LOW — nếu không có client nào gọi |
| Xóa Kimi OAuth callback khỏi `boot.ts` | `boot.ts` | LOW — dead endpoint, xóa an toàn |
| Xóa `KIMI_AUTH_URL` / `KIMI_OPEN_URL` khỏi `required()` | `env.ts`, deploy env config | **MEDIUM** — cần remove khỏi Render env vars cùng lúc |
| Thêm `authToken` vào Zustand store | `useAppStore.ts` | LOW — additive change |
| `trpc.tsx` đã đọc `authToken` từ store | `useAppStore.ts` phải có field này | **MEDIUM** — nếu field chưa có, `undefined` được truyền nhưng không crash (guard `&& token`) |

---

## 8. RECOMMENDED CHANGES SUMMARY

- `backend/api/kimi/auth.ts` → Tách `authenticateRequest` ra `backend/api/lib/auth.ts`; thêm nhánh đọc `Authorization: Bearer <token>` trước khi fallback về cookie.
- `backend/api/context.ts` → Đổi import từ `./kimi/auth` sang `./lib/auth`.
- `backend/api/auth-router.ts` → Thêm `auth.telegramLogin(initData)`: verify HMAC, upsert user `unionId=telegram:<id>`, return `{ token, user }` thay vì set cookie. Xóa `auth.zaloLogin`.
- `backend/api/lib/telegram.ts` → Tạo mới: `verifyTelegramInitData(initData, botToken)` với HMAC-SHA256.
- `backend/api/lib/env.ts` → Thêm `telegramBotToken: required("TELEGRAM_BOT_TOKEN")`; bỏ `required()` cho `kimiAuthUrl`, `kimiOpenUrl`.
- `backend/api/boot.ts` → Xóa `createOAuthCallbackHandler()` mount; thêm `POST /api/bot/webhook` cho Telegram bot admin commands; wrap `GET /api/dev/login` trong `if (!env.isProduction)`.
- `frontend/src/shared/store/useAppStore.ts` → Xác nhận / thêm `authToken: string | null` field; thêm `setAuthToken(token)` action.
- `frontend/src/providers/trpc.tsx` → Không cần sửa nếu `authToken` đã có trong store (stub đã đúng).
- `frontend/src/features/auth/` → Tạo `useTelegramAuth.ts` hook: gọi `window.Telegram.WebApp.initData`, mutate `auth.telegramLogin`, lưu token vào store.
- `frontend/src/App.tsx` → Thêm route `/admin` với guard `role === "admin"`; thêm Telegram auto-login flow khi platform là telegram.
- `.env.example` → Thêm `TELEGRAM_BOT_TOKEN=` và `TELEGRAM_BOT_SECRET=`.

---

AUTH-AUDIT-001 COMPLETE. Review auth-audit.md before proceeding to AUTH-DESIGN-002.
