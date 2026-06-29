# AUTH DESIGN — Dual-Mode Web + Telegram
> Task: AUTH-DESIGN-002 | Depends on: AUTH-AUDIT-001 | Branch: handle_db_feature | Date: 2026-06-28
> Zalo và Kimi OAuth đã bị loại bỏ hoàn toàn.

---

## SECTION 1: DUAL-MODE FLOW DIAGRAM

### Web Flow

```
[RegisterPage.tsx]
  User điền form: name, email, username?, phone?, password, lifestyleRole, gender
  └─ Client validate: password === confirmPassword
     └─ trpc.auth.register.mutate(form)
        │
        ▼
[Backend: auth.register — publicQuery]
  normalizedEmail = email.trim().toLowerCase()
  check duplicate (registrationRequests + userCredentials)
  hashPassword(password) → scrypt
  INSERT registrationRequests (status = pending)
  return { id, status: "pending" }
        │
        ▼
[RegisterPage.tsx]
  setSuccess(true) → show "Yêu cầu đã được gửi" screen
        │
        ▼
[Admin đăng nhập web tại /admin — role = admin]
  trpc.admin.listRegistrations({ status: "pending" })
  Admin xem danh sách → click Approve hoặc Reject
        │
        ├─ [Approve] trpc.admin.approveRegistration({ id })
        │    INSERT users (unionId = local:<email>, role = "user")
        │    INSERT userCredentials (email, username, phone, passwordHash)
        │    UPDATE registrationRequests (status = approved, reviewedBy, reviewedAt)
        │    sendMail(approvalEmail) [non-blocking]
        │    return { success: true, userId }
        │
        └─ [Reject] trpc.admin.rejectRegistration({ id, reason? })
             UPDATE registrationRequests (status = rejected, rejectionReason, reviewedBy, reviewedAt)
             sendMail(rejectionEmail) [non-blocking]
             return { success: true }
        │
        ▼
[User nhận email thông báo → vào LoginPage]
  User nhập identifier (email / username / phone) + password
  └─ trpc.auth.login.mutate({ identifier, password })
        │
        ▼
[Backend: auth.login — publicQuery]
  query userCredentials WHERE email OR username OR phone = identifier
  verifyPassword(password, credential.passwordHash) → scrypt timingSafeEqual
  query users WHERE id = credential.userId
  UPDATE users.lastSignInAt = now
  signSessionToken({ unionId: user.unionId, clientId: env.appId }) → JWT HS256
  set-cookie: SESSION=<jwt> (HTTP-only, maxAge=Session.maxAgeMs/1000)
  return User
        │
        ▼
[Mọi tRPC request tiếp theo]
  Browser tự gửi cookie SESSION kèm request (credentials: "include")
        │
        ▼
[Backend: createContext() — context.ts]
  authenticateRequest(headers)
    └─ parse cookie[Session.cookieName]
       └─ verifySessionToken(token) → { unionId, clientId }
          └─ findUserByUnionId(unionId) → User
  ctx.user = User  (silent fail nếu không auth)
        │
        ▼
[middleware.ts: requireAuth]
  ctx.user tồn tại → next()
  ctx.user undefined → throw UNAUTHORIZED
```

---

### Telegram Flow

```
[App.tsx — khi mount]
  getPlatform() === "telegram"
  └─ render <TelegramAutoLogin />  (hoặc gọi useTelegramAuth hook)
        │
        ▼
[useTelegramAuth.ts hook]
  window.Telegram.WebApp.initData  → chuỗi URL-encoded từ Telegram
  └─ trpc.auth.telegramLogin.mutate({ initData })
        │
        ▼
[Backend: auth.telegramLogin — publicQuery]  ← PROCEDURE MỚI
  verifyTelegramInitData(initData, env.telegramBotToken)
    └─ parse URLSearchParams từ initData
       sort params (exclude "hash"), join bằng "\n" → checkString
       secretKey = HMAC-SHA256("WebAppData", botToken)
       expectedHash = HMAC-SHA256(checkString, secretKey)
       so sánh expectedHash === params.hash  [timing-safe]
       check auth_date không quá 1 giờ
       parse user: { id, first_name, last_name?, photo_url? }
  unionId = "telegram:" + data.user.id
  query users WHERE unionId = unionId
  ├─ [Tồn tại] UPDATE users (name, avatar, lastSignInAt)
  └─ [Chưa có] INSERT users (unionId, name, avatar, role="user", lastSignInAt)
  signSessionToken({ unionId, clientId: "telegram-mini-app" }) → JWT HS256, expiry 30 ngày
  KHÔNG set cookie
  return { token: "<jwt>", user: User }
        │
        ▼
[useTelegramAuth.ts hook]
  onSuccess: useAppStore.getState().setAuthToken(token)
  navigate("/")  hoặc trigger App re-render
        │
        ▼
[Mọi tRPC request tiếp theo]
  frontend/src/providers/trpc.tsx
    platform = getPlatform() === "telegram"
    token = useAppStore.getState().authToken  (non-null sau login)
    → gửi header: Authorization: Bearer <token>
        │
        ▼
[Backend: createContext() — context.ts]
  authenticateRequest(headers)
    └─ [Path 1] Authorization: Bearer <token> header tồn tại
         verifySessionToken(token) → { unionId, clientId }
         findUserByUnionId(unionId) → User
    └─ [Path 2] fallback: đọc cookie SESSION  ← Web path
  ctx.user = User
        │
        ▼
[middleware.ts: requireAuth]
  ctx.user tồn tại → next()
  ctx.user undefined → throw UNAUTHORIZED
```

---

## SECTION 2: BACKEND CHANGES CHI TIẾT

### File 1: `backend/api/lib/telegram.ts` — TẠO MỚI

**Việc cần làm:**
- Export function `verifyTelegramInitData(initData: string, botToken: string): ParsedInitData`
- Logic:
  1. Parse `initData` bằng `URLSearchParams`
  2. Tách `hash` ra khỏi params
  3. Sort các params còn lại, join bằng `\n` → `checkString`
  4. `secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()`
  5. `expectedHash = createHmac("sha256", secretKey).update(checkString).digest("hex")`
  6. So sánh `expectedHash === hash` bằng `timingSafeEqual` (chống timing attack)
  7. Check `auth_date`: reject nếu `Date.now()/1000 - auth_date > 3600`
  8. Parse `user` field từ JSON
- Export type `TelegramUser { id, first_name, last_name?, username?, photo_url? }`
- Export type `ParsedInitData { user: TelegramUser, auth_date: number, hash: string }`

**Lý do:** Audit section 6 — `verifyTelegramInitData` chưa có trong source. Là dependency của auth.telegramLogin.

**Risk:** LOW — pure utility, không phụ thuộc file nào khác trong project.

**Thứ tự:** Bước 1 — không có dependency.

---

### File 2: `backend/api/lib/auth.ts` — TẠO MỚI

**Việc cần làm:**
- Move `authenticateRequest(headers: Headers): Promise<User>` từ `kimi/auth.ts` sang đây
- Mở rộng để hỗ trợ 2 path:
  ```
  Path 1 — Telegram Bearer:
    if Authorization header starts with "Bearer "
      extract token
      verifySessionToken(token) → claim
      findUserByUnionId(claim.unionId) → user
      return user
      throw Errors.forbidden nếu verify fail

  Path 2 — Web Cookie (fallback):
    parse cookie[Session.cookieName]
    verifySessionToken(token) → claim
    findUserByUnionId(claim.unionId) → user
    return user
    throw Errors.forbidden nếu không có cookie hoặc verify fail
  ```
- Import từ `./session` (signSessionToken, verifySessionToken), `../queries/users`, `./cookies`, `@contracts/constants`, `@contracts/errors`
- **Không** import bất kỳ thứ gì từ `kimi/` module

**Lý do:** Audit section 7 (HIGH risk) — sửa `authenticateRequest` ảnh hưởng toàn bộ pipeline. Tách ra file riêng để isolate change, không đụng vào `kimi/auth.ts` trực tiếp.

**Risk:** HIGH — function này được gọi trong `context.ts` → ảnh hưởng mọi request. Giảm thiểu bằng cách tạo file mới thay vì sửa file cũ.

**Thứ tự:** Bước 2 — phụ thuộc bước 1 (telegram.ts) nếu cần import type, nhưng thực tế `authenticateRequest` không import telegram.ts.

---

### File 3: `backend/api/lib/env.ts` — SỬA

**Việc cần làm:**

| Thay đổi | Chi tiết |
|---|---|
| Thêm `telegramBotToken` | `telegramBotToken: required("TELEGRAM_BOT_TOKEN")` |
| Xóa `kimiAuthUrl` khỏi required | Đổi thành `kimiAuthUrl: process.env.KIMI_AUTH_URL ?? ""` hoặc xóa hoàn toàn |
| Xóa `kimiOpenUrl` khỏi required | Tương tự |
| Xóa `zaloAppId`, `zaloOpenApiUrl` | Không còn dùng sau khi xóa zaloLogin |
| Giữ nguyên `appSecret` | Dùng cho JWT signing — audit section 2 |
| Xác nhận `JWT_SECRET` | Dùng bởi `demo-auth` endpoint — nếu giữ demo mode thì giữ, nếu không thì optional |

**Lý do:** Audit section 6 — `TELEGRAM_BOT_TOKEN` chưa có. Audit section 7 (MEDIUM risk) — xóa `KIMI_AUTH_URL` / `KIMI_OPEN_URL` khỏi required cần sync với Render dashboard.

**Risk:** MEDIUM — nếu `required()` throw trên production khi env var chưa được set trên Render → server không start. Cần set `TELEGRAM_BOT_TOKEN` trên Render **trước** khi deploy.

**Thứ tự:** Bước 3 — các bước sau cần env mới.

---

### File 4: `backend/api/context.ts` — SỬA

**Việc cần làm:**
- Đổi import duy nhất:
  ```
  // Trước:
  import { authenticateRequest } from "./kimi/auth";
  // Sau:
  import { authenticateRequest } from "./lib/auth";
  ```
- Không thay đổi logic trong `createContext()` — hàm vẫn gọi `authenticateRequest(opts.req.headers)` và silent fail.

**Lý do:** Audit section 7 (HIGH risk) — `context.ts` ảnh hưởng toàn bộ tRPC procedures. Thay đổi minimal (chỉ đổi import) để giảm blast radius.

**Risk:** HIGH — nhưng change rất nhỏ (1 dòng import). Test bằng cách verify `auth.me` vẫn hoạt động sau khi đổi.

**Thứ tự:** Bước 4 — phụ thuộc bước 2 (`lib/auth.ts` phải tồn tại).

---

### File 5: `backend/api/auth-router.ts` — SỬA

**Việc cần làm:**

1. **Thêm procedure `auth.telegramLogin`:**
   - Input: `z.object({ initData: z.string().min(1) })`
   - Logic: gọi `verifyTelegramInitData`, upsert users, `signSessionToken({ unionId: "telegram:<id>", clientId: "telegram-mini-app" })`
   - **KHÔNG set cookie** — return `{ token: string, user: User }`
   - JWT expiry: `"30d"` (thay vì `"1 year"` của web path — audit section 2)
   - Guard: `publicQuery`

2. **Xóa `auth.zaloLogin`** — toàn bộ procedure và import liên quan (`verifyZaloAccessToken`, `verifyZaloAccessToken` từ `./zalo-auth`)

**Lý do:** Audit section 6 — telegramLogin chưa có. Audit section 8 — zaloLogin nằm ngoài scope.

**Risk:** LOW — telegramLogin là procedure mới. Xóa zaloLogin không ảnh hưởng nếu không có client nào gọi (audit section 7).

**Thứ tự:** Bước 5 — phụ thuộc bước 1 (telegram.ts) và bước 3 (env.ts có telegramBotToken).

---

### File 6: `backend/api/boot.ts` — SỬA

**Việc cần làm:**

1. **Guard `GET /api/dev/login`** — audit section 1 ghi nhận endpoint không có production guard:
   ```
   // Trước: app.get("/api/dev/login", createDevLoginHandler())
   // Sau:
   if (!env.isProduction) {
     app.get("/api/dev/login", createDevLoginHandler());
   }
   ```

2. **Xóa Kimi OAuth callback:**
   ```
   // Xóa dòng:
   app.get(Paths.oauthCallback, createOAuthCallbackHandler());
   // Xóa import:
   import { createOAuthCallbackHandler } from "./kimi/auth";
   ```

**Lý do:** Audit section 1 (HIGH risk) — dev login không guard production. Audit section 8 — Kimi OAuth là dead endpoint.

**Risk:** LOW cho xóa Kimi (dead code). MEDIUM cho guard dev login — cần test local dev vẫn hoạt động sau khi wrap if.

**Thứ tự:** Bước 6 — phụ thuộc bước 3 (env.ts có `isProduction`).

---

### File 7: `backend/api/router.ts` — SỬA NẾU CẦN

**Việc cần làm:**
- Kiểm tra xem `router.ts` có import trực tiếp từ `kimi/` hoặc expose `zaloLogin` riêng không.
- Nếu `zaloLogin` bị xóa khỏi `auth-router.ts` thì `router.ts` không cần sửa (authRouter tự co lại).
- Nếu có import `createOAuthCallbackHandler` hoặc Kimi module trực tiếp → xóa.

**Lý do:** Audit section 8 — cleanup dead code.

**Risk:** LOW — additive removal.

**Thứ tự:** Bước 7 — sau bước 5 và 6.

---

## SECTION 3: FRONTEND CHANGES CHI TIẾT

### File 1: `frontend/src/shared/store/useAppStore.ts` — XÁC NHẬN / SỬA

**Việc cần làm:**
- Đọc file để xác nhận `authToken: string | null` đã tồn tại chưa (audit section 6 ghi "chưa xác nhận").
- Nếu chưa có: thêm field `authToken: string | null` vào state interface, khởi tạo `null`.
- Thêm action `setAuthToken: (token: string | null) => void`.

**Lý do:** Audit section 6 — `trpc.tsx` đọc `useAppStore.getState().authToken` nhưng field chưa xác nhận tồn tại. Audit section 7 (MEDIUM risk) — nếu field không có, `undefined` được pass nhưng không crash do guard `&& token`.

**Risk:** LOW — additive change, không ảnh hưởng logic hiện tại.

---

### File 2: `frontend/src/features/auth/useTelegramAuth.ts` — TẠO MỚI

**Việc cần làm:**
- Hook `useTelegramAuth()`:
  1. Check `window.Telegram?.WebApp?.initData` — nếu empty/undefined → return sớm (không phải TG context)
  2. Lấy `initData = window.Telegram.WebApp.initData`
  3. Gọi `trpc.auth.telegramLogin.useMutation()`
  4. `onSuccess({ token, user })`: gọi `useAppStore.getState().setAuthToken(token)`; có thể lưu user vào store nếu cần
  5. `onError`: log error, redirect về error page hoặc show fallback
  6. Auto-trigger mutation khi mount nếu chưa có `authToken` trong store

**Lý do:** Audit section 6 — auto-register từ Telegram chưa có. Frontend cần trigger `auth.telegramLogin` khi detect Telegram context.

**Risk:** LOW — hook mới, không ảnh hưởng Web flow.

---

### File 3: `frontend/src/App.tsx` — SỬA

**Việc cần làm:**

1. **Telegram auto-login:** Trong component root (hoặc trong một component riêng được render khi `platform === "telegram"`), gọi `useTelegramAuth()` hook. Hook này tự handle init → mutate → store token.

2. **Route `/admin`:**
   ```
   <Route path="/admin" element={<AdminRoute />} />
   ```
   Trong `AdminRoute`:
   - Lấy user từ `trpc.auth.me`
   - Nếu `user.role !== "admin"` → redirect về `/`
   - Nếu `role === "admin"` → render `<AdminRegistrationsPage />`

**Lý do:** Audit section 5 — không có route `/admin`, admin phải dùng tRPC panel. Audit section 6 — auto-login Telegram chưa có.

**Risk:** MEDIUM — sửa `App.tsx` là file routing trung tâm. Cần test Web flow không bị ảnh hưởng sau khi thêm TG logic.

---

### File 4: `frontend/src/features/auth/AdminRegistrationsPage.tsx` — TẠO MỚI

**Việc cần làm:**
- Query `trpc.admin.listRegistrations({ status: "pending" })` → render danh sách
- Mỗi row hiển thị: name, email, username?, phone?, lifestyleRole, gender, createdAt
- Button **Approve** → gọi `trpc.admin.approveRegistration({ id })` → invalidate list
- Button **Reject** → mở modal nhập `reason?: string` → gọi `trpc.admin.rejectRegistration({ id, reason })` → invalidate list
- Filter tab: `pending | approved | rejected | all`
- Loading / error states

**Lý do:** Audit section 5 — admin UI không tồn tại, admin workflow bị chặn trên production.

**Risk:** LOW — component mới, không ảnh hưởng code hiện tại.

---

## SECTION 4: ENV VARS CHANGES

| Var | Action | Lý do |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **Thêm mới — required** | Cần cho `verifyTelegramInitData` trong `auth.telegramLogin`. Audit section 6. |
| `TELEGRAM_BOT_SECRET` | Thêm mới — optional | Dùng để verify `X-Telegram-Bot-Api-Secret-Token` trên webhook endpoint (out of scope hiện tại, nhưng nên khai báo sẵn). |
| `KIMI_AUTH_URL` | **Xóa khỏi `required()`** | Dead dependency sau khi loại Kimi. Audit section 7 (MEDIUM). |
| `KIMI_OPEN_URL` | **Xóa khỏi `required()`** | Tương tự. |
| `APP_SECRET` | Giữ nguyên | Dùng cho JWT signing (cả web lẫn Telegram path). Audit section 2. |
| `APP_ID` | Giữ nguyên | Dùng làm `clientId` trong JWT payload cho web path. |
| `JWT_SECRET` | Optional — giữ nếu giữ demo mode | Chỉ dùng bởi `demo-auth` endpoint (`POST /api/auth/demo`). Nếu demo mode bị tắt hoặc xóa thì xóa var này. |
| `ZALO_APP_ID` | **Xóa** | Dead var sau khi xóa `auth.zaloLogin`. |
| `ZALO_OPEN_API_URL` | **Xóa** | Tương tự. |
| `DATABASE_URL` | Giữ nguyên | Required. |
| `SMTP_URL`, `SMTP_API_KEY`, `MAIL_FROM` | Giữ nguyên | Dùng cho email approval/rejection. |

### Cần làm trên Render dashboard TRƯỚC khi deploy

> **Thứ tự quan trọng** — sai thứ tự sẽ khiến backend không start trên production.

1. **Thêm** `TELEGRAM_BOT_TOKEN` = `<bot token từ BotFather>` vào Render env vars.
2. **Thêm** `TELEGRAM_BOT_SECRET` = `<random secret>` (optional, cho webhook sau).
3. **Sau khi** merge code xóa `required("KIMI_AUTH_URL")` và `required("KIMI_OPEN_URL")` → có thể xóa các vars này khỏi Render (thứ tự ngược: xóa code trước, xóa env sau).
4. Xóa `ZALO_APP_ID`, `ZALO_OPEN_API_URL` khỏi Render sau khi code không còn reference.

---

## SECTION 5: DATABASE CHANGES

### users table có support `unionId = telegram:<id>` chưa?

**Có.** `users.unionId` là `varchar(255) NOT NULL UNIQUE` (schema.ts:66). Pattern `telegram:<id>` hoàn toàn fit — không cần alter table.

### registrationRequests có cần thêm gì cho Telegram flow không?

**Không.** Telegram users bypass registration approval hoàn toàn — `auth.telegramLogin` upsert thẳng vào `users` table mà không tạo `registrationRequests` row. Table `registrationRequests` chỉ dùng cho Web flow.

### Có cần tạo migration script mới không?

**Không cần.** Không có schema change nào trong design này:
- `users` table đã đủ fields (unionId, name, avatar, role, lastSignInAt).
- `houseMembers.telegramAvatar` đã có sẵn trong schema (schema.ts:225).
- Telegram users không cần `userCredentials` row — intentional.

### Lý do không có DB change

Thiết kế sử dụng pattern `unionId` đã có sẵn (`local:<email>`, `telegram:<id>`) — đây là discriminator duy nhất cần thiết. Không có cross-platform identity linking trong scope này.

---

## SECTION 6: IMPLEMENTATION ORDER

| Bước | Task | File | Depends on | Risk |
|---|---|---|---|---|
| 1 | Tạo `verifyTelegramInitData` | `backend/api/lib/telegram.ts` | — | LOW |
| 2 | Tạo `authenticateRequest` dual-mode | `backend/api/lib/auth.ts` | Bước 1 (type imports) | HIGH |
| 3 | Thêm `telegramBotToken`, xóa Kimi required | `backend/api/lib/env.ts` | — | MEDIUM |
| 4 | Đổi import sang `./lib/auth` | `backend/api/context.ts` | Bước 2 | HIGH |
| 5 | Thêm `auth.telegramLogin`, xóa `auth.zaloLogin` | `backend/api/auth-router.ts` | Bước 1, Bước 3 | LOW |
| 6 | Guard dev login, xóa Kimi callback | `backend/api/boot.ts` | Bước 3 | LOW |
| 7 | Cleanup Kimi imports nếu còn | `backend/api/router.ts` | Bước 5, Bước 6 | LOW |
| 8 | Xác nhận / thêm `authToken` + `setAuthToken` | `frontend/src/shared/store/useAppStore.ts` | — | LOW |
| 9 | Tạo Telegram auto-login hook | `frontend/src/features/auth/useTelegramAuth.ts` | Bước 5, Bước 8 | LOW |
| 10 | Thêm Telegram auto-login + `/admin` route | `frontend/src/App.tsx` | Bước 9 | MEDIUM |
| 11 | Tạo Admin UI cho registration review | `frontend/src/features/auth/AdminRegistrationsPage.tsx` | Bước 10 | LOW |
| 12 | Update `.env.example` | `.env.example` | Bước 3 | LOW |

**Checkpoint sau bước 4:** Test `auth.me` trên web vẫn trả đúng user — đây là smoke test cho HIGH risk changes (bước 2 + 4).

**Checkpoint sau bước 7:** Chạy `npm run check` và `npm run build` — verify không có TypeScript errors sau khi xóa Kimi code.

**Checkpoint sau bước 11:** Test end-to-end cả 2 flows trên staging trước khi merge.

---

## SECTION 7: RISKS VÀ ROLLBACK PLAN

### HIGH RISK 1: Sửa `authenticateRequest` ảnh hưởng toàn bộ request pipeline

**Nguồn:** Audit section 7.

**Giảm thiểu:**
- Tạo file mới `lib/auth.ts` thay vì sửa `kimi/auth.ts` — nếu có vấn đề, chỉ cần đổi import trong `context.ts` về cũ.
- Logic Path 2 (cookie) phải là bản copy chính xác của logic hiện tại trong `kimi/auth.ts` — không thay đổi behavior.
- Path 1 (Bearer) chỉ được kích hoạt khi header `Authorization: Bearer` tồn tại — không ảnh hưởng Web requests (web không gửi header này).

**Rollback:**
```
// context.ts — đổi lại 1 dòng:
import { authenticateRequest } from "./kimi/auth";  // thay vì "./lib/auth"
```
Rollback trong vòng 30 giây, không cần DB change.

**Test trước khi merge:**
- [ ] `auth.me` trả đúng user khi dùng web cookie
- [ ] `auth.me` trả đúng user khi dùng Bearer token (test với token hợp lệ)
- [ ] `auth.me` throw UNAUTHORIZED khi không có cookie và không có Bearer
- [ ] `auth.me` throw UNAUTHORIZED khi Bearer token invalid
- [ ] `trpc.house.get` (authedQuery) vẫn hoạt động trên web sau khi đổi

---

### HIGH RISK 2: Sửa `context.ts` ảnh hưởng toàn bộ tRPC procedures

**Nguồn:** Audit section 7.

**Giảm thiểu:**
- Change là 1 dòng import duy nhất — không sửa logic `createContext()`.
- Nếu `lib/auth.ts` export đúng signature `authenticateRequest(headers: Headers): Promise<User>` thì TypeScript sẽ catch mismatch tại compile time.

**Rollback:**
```
// context.ts — 1 dòng:
import { authenticateRequest } from "./kimi/auth";
```

**Test trước khi merge:**
- [ ] `npm run check` không có TypeScript error
- [ ] Smoke test: bất kỳ `authedQuery` nào (e.g. `auth.me`) hoạt động

---

### MEDIUM RISK 3: Thêm `TELEGRAM_BOT_TOKEN` vào `required()` — build fail nếu chưa set trên Render

**Nguồn:** Audit section 7.

**Giảm thiểu:**
- Set `TELEGRAM_BOT_TOKEN` trên Render **trước** khi push code lên production.
- Có thể dùng `process.env.TELEGRAM_BOT_TOKEN ?? ""` tạm thời trong bước đầu, nâng lên `required()` sau khi confirm Render đã có var.

**Rollback:** Xóa `telegramBotToken` khỏi `env.ts` nếu Render chưa có var.

**Test:**
- [ ] Verify `TELEGRAM_BOT_TOKEN` đã có trên Render trước khi merge
- [ ] `npm run build` không throw trên local với `.env` có đủ vars

---

### MEDIUM RISK 4: Xóa `KIMI_AUTH_URL` / `KIMI_OPEN_URL` khỏi `required()`

**Nguồn:** Audit section 7.

**Giảm thiểu:**
- Thứ tự: merge code xóa `required()` → verify deploy thành công → xóa vars khỏi Render.
- Không xóa vars khỏi Render trước khi deploy code mới (vars thừa không gây hại).

**Rollback:** Add lại `required()` trong `env.ts`.

**Test:**
- [ ] Backend start thành công trên staging sau khi xóa Kimi required
- [ ] Không có runtime error liên quan đến `kimiAuthUrl` undefined

---

### MEDIUM RISK 5: `trpc.tsx` đọc `authToken` từ store — field chưa xác nhận

**Nguồn:** Audit section 7.

**Giảm thiểu:**
- Bước 8 (sửa store) phải được thực hiện trước bước 10 (sửa App.tsx).
- `trpc.tsx` đã có guard `platform === "telegram" && token` nên nếu `authToken` là `undefined`, header không được gửi — không crash.

**Rollback:** Remove `authToken` field từ store.

**Test:**
- [ ] TypeScript: `useAppStore.getState().authToken` không có type error
- [ ] Telegram login: sau khi `setAuthToken(token)` → tRPC request tiếp theo có `Authorization` header

---

## SECTION 8: OUT OF SCOPE

Những thứ **KHÔNG** thuộc design này — agent implement sau không nhầm:

| Item | Lý do out of scope |
|---|---|
| Telegram bot command `/approve <id>` cho admin | Yêu cầu bot webhook infrastructure riêng — phức tạp hơn scope này |
| Rate limiting và CAPTCHA trên `auth.register` | Infrastructure concern, cần thêm middleware layer |
| Email confirmation khi user submit register request | UX improvement, không blocking cho core auth flow |
| `auth.logout` cho Telegram (clear token khỏi store) | Đơn giản nhưng chưa được spec — store `setAuthToken(null)` là đủ, không cần backend |
| Account linking giữa Web identity và Telegram identity | Cùng 1 người có thể có 2 user records — merge flow phức tạp, chưa được yêu cầu |
| Refresh token / token rotation | JWT expiry 30 ngày được chấp nhận cho scope này |
| `password` complexity requirement và format validation cho `username`/`phone` | Validation improvement, không blocking |
| Telegram bot webhook endpoint `POST /api/bot/webhook` | Phụ thuộc bot command feature — out of scope |
| Xóa hoàn toàn `kimi/` module | Một số function (`signSessionToken`, `verifySessionToken`) vẫn được dùng bởi `lib/auth.ts` — cleanup sau khi có thời gian |
| Admin approve qua Telegram Mini App UI | Telegram admin dùng bot command (out of scope) hoặc web `/admin` |

---

AUTH-DESIGN-002 COMPLETE.

Backend changes: 7 files.

Frontend changes: 4 files.

Estimated implementation tasks: 12.

Review auth-design.md before proceeding to AUTH-IMPL-003.
