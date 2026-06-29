# CHECKPOINT SOURCE CODE - Lunis House Mini App

> **Checkpoint #:** `CP-002`
> **Ngay cap nhat:** 28/06/2026
> **Nguoi cap nhat:** Codex
> **Muc tieu:** Tai lieu hoa source hien tai de AI agents doc file nay co the hieu nhanh kien truc, flow, API, DB, rui ro va huong tiep theo.

---

## 0. TOM TAT CHO AI AGENTS

Day la monorepo TypeScript gom:

- `frontend/`: React 19 + Vite 7 SPA, React Router, Zustand, TanStack Query, tRPC client, Tailwind/Radix/shadcn-style UI.
- `backend/`: Hono + tRPC 11 + Drizzle ORM, PostgreSQL/Neon, session cookie/JWT, Zalo/Kimi auth, Render deployment.
- `backend/db/schema.ts`: schema trung tam cho users, auth credentials, registration approval, house, members, tasks, wallet, shop, punishments, notebook, notifications, logs, wheel.
- `scripts/`: cac script apply/verify schema bang postgres raw SQL.
- Production frontend tren Vercel rewrite `/api/*` sang backend Render `https://queststreak-1.onrender.com/api/:path*`.
- Dev frontend Vite chay port `3000` va mount Hono backend qua `@hono/vite-dev-server` cho `/api/*`.

Nguyen tac khi sua code:

- Neu sua function/class/method: phai chay GitNexus `impact({ target, direction: "upstream", repo: "QuestStreak" })` truoc.
- Worktree dang co nhieu thay doi chua commit tu truoc checkpoint nay; khong revert file khac neu khong duoc yeu cau.
- Cac page lon nhu `TasksPage.tsx`, `ShopPage.tsx`, `PunishmentsPage.tsx` nen co regression tests truoc khi tach/refactor.
- Auth/register/admin approval dang la khu vuc moi va can test ky.

---

## 1. THONG TIN DU AN

| Truong | Noi dung |
|---|---|
| Ten du an | Lunis House Mini App / QuestStreak |
| Mo ta ngan | Mini app quan ly house gamification: tasks, shop rewards/privileges, punishments, wallet, notebook, invite/join room, notifications, auth/register approval. |
| Repository | `D:\Projects\Company\Lunis_house_mini_app` |
| Git branch | `handle_db_feature` |
| HEAD short hash | `d2bbade` |
| Package version | `0.0.0` |
| GitNexus repo | `QuestStreak` |
| GitNexus index | 172 files, 1254 symbols, 2717 edges, 78 processes, branch `handle_db_feature` |
| Current status | Source dang WIP/dirty; checkpoint nay chi cap nhat tai lieu. |

---

## 2. TECH STACK

| Layer | Stack |
|---|---|
| Root workspace | npm workspaces: `frontend`, `backend` |
| Frontend | React `19.2`, Vite `7.2`, TypeScript `5.9`, React Router `7.6`, Zustand `5`, TanStack Query `5`, tRPC React `11`, Tailwind `3.4`, Radix UI, framer-motion, lucide-react, zmp-sdk |
| Backend | Hono `4.8`, `@hono/node-server`, tRPC server `11`, Drizzle ORM `0.45`, postgres, Neon serverless, jose, cookie, superjson, zod |
| DB | PostgreSQL-compatible database, likely local Postgres or Neon via `DATABASE_URL` |
| Auth/session | HTTP-only cookie `Session.cookieName`, JWT signing through `backend/api/kimi/session.ts`, local password hash by `scrypt`, Zalo/Kimi OAuth support |
| Email | `backend/api/lib/mailer.ts`; HTTPS relay style for Resend/Brevo-like endpoint, console fallback in dev |
| Tooling | ESLint 9, Prettier 3, Vitest 4, drizzle-kit, esbuild |

---

## 3. ROOT SCRIPTS

```bash
npm run dev              # frontend workspace dev; Vite mounts backend in dev
npm run dev:frontend
npm run build            # frontend build then backend build
npm run build:frontend
npm run build:backend
npm run preview
npm run start            # backend start from built dist
npm run lint
npm run check            # tsc -b
npm run test             # vitest run --passWithNoTests
```

Backend workspace:

```bash
npm run build --workspace backend
npm run start --workspace backend
npm run check --workspace backend
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
npm run db:push --workspace backend
```

Frontend workspace:

```bash
npm run dev --workspace frontend
npm run build --workspace frontend
npm run preview --workspace frontend
npm run check --workspace frontend
```

---

## 4. CAU TRUC SOURCE CHINH

```text
project-root/
|-- frontend/
|   |-- src/
|   |   |-- main.tsx                       # React entry, BrowserRouter, TRPCProvider
|   |   |-- App.tsx                        # Routes + main authenticated shell
|   |   |-- providers/trpc.tsx             # tRPC React Query client
|   |   |-- lib/api.ts                     # API URL resolver from VITE_API_URL/same-origin
|   |   |-- shared/
|   |   |   |-- store/useAppStore.ts        # Zustand UI/navigation/create sheet/toast state
|   |   |   |-- hooks/                     # useCurrentUser, useGamification, use-mobile
|   |   |   |-- layout/                    # TopBar, BottomNav
|   |   |   `-- components/                # FAB, Toast, NotificationBell, GamificationPanel
|   |   |-- features/
|   |   |   |-- auth/                      # Login, Register, DemoLogin, InviteJoin, hooks
|   |   |   |-- tasks/                     # task/wheel workflow
|   |   |   |-- shop/                      # rewards, privileges, wallet actions
|   |   |   |-- punishments/               # punishment catalog/assignment/redeem/forgive
|   |   |   |-- notebook/                  # limits, agreements, journals, notes
|   |   |   |-- house/                     # house/member/room/invite management
|   |   |   `-- not-found/
|   |   `-- components/ui/                # shadcn/Radix primitives
|   |-- vite.config.ts                    # Vite, Hono dev server, aliases
|   `-- package.json
|-- backend/
|   |-- api/
|   |   |-- boot.ts                       # Hono app, CORS, tRPC fetch handler
|   |   |-- router.ts                     # appRouter composition
|   |   |-- middleware.ts                 # public/authed/admin/dom procedures
|   |   |-- context.ts                    # optional auth context
|   |   |-- auth-router.ts                # zalo/local register/login/me/preferences/logout
|   |   |-- admin-router.ts               # registration approval/rejection
|   |   |-- house-router.ts               # house, room code, members, join requests
|   |   |-- task-router.ts                # tasks, assignments, submissions, review
|   |   |-- reward-router.ts              # reward CRUD, purchase, gift, purchases
|   |   |-- privilege-router.ts           # privilege CRUD, assign, use
|   |   |-- punishment-router.ts          # punishment CRUD, assign, redeem, forgive
|   |   |-- wallet-router.ts              # chym/chay balance mutations
|   |   |-- wheel-router.ts               # wheel CRUD/spin history
|   |   |-- gamification-router.ts        # member summary
|   |   |-- notification-router.ts        # list/count/read
|   |   |-- invite-router.ts              # invite code list/create/revoke/preview/join
|   |   |-- notebook-router.ts            # limits/agreements/journals/notes
|   |   |-- log-router.ts                 # dom-only logs
|   |   |-- kimi/                         # OAuth/session/platform integration
|   |   |-- lib/                          # env, cookies, http, gamification, mailer, notifications
|   |   `-- queries/                      # DB connection/user helpers
|   |-- db/
|   |   |-- schema.ts                     # Drizzle tables/enums/types
|   |   |-- relations.ts                  # Drizzle relations
|   |   |-- index.ts                      # DB client
|   |   `-- seed.ts                       # seed data
|   |-- contracts/                        # constants, errors, shared types
|   `-- package.json
|-- scripts/                              # schema apply/verify scripts
|-- .env.example
|-- .env.local.example
|-- vercel.json
|-- vitest.config.ts
`-- checkpoint.md
```

---

## 5. FRONTEND FLOW

### 5.1 Routing

`frontend/src/App.tsx` defines:

- `/` -> `MainApp`
- `/login` -> `LoginPage`
- `/register` -> `RegisterPage`
- `/demo-login` -> `DemoLoginPage`
- `*` -> `NotFoundPage`

### 5.2 Authenticated shell

`MainApp` behavior:

1. Calls `trpc.house.get`.
2. If loading: black screen spinner.
3. If `UNAUTHORIZED`: redirects to `/login`.
4. If authenticated but no house: renders `InviteJoinPage`.
5. If `managementPanel` exists in Zustand: renders `HouseManagementPage`.
6. Else renders main app shell with `TopBar`, tab content, `BottomNav`, `Toast`.

Tabs from `useAppStore.activeTab`:

- `tasks` -> `TasksPage`
- `shop` -> `ShopPage`
- `punishments` -> `PunishmentsPage`
- `notebook` -> `NotebookPage`

### 5.3 Client state

`frontend/src/shared/store/useAppStore.ts` stores:

- main tab: `tasks | shop | punishments | notebook`
- house management panel: `account | room | null`
- create sheet state and type: `task | wheel | reward | privilege | punishment | note | journal | agreement`
- selected category
- FAB open state
- toast object
- shop sub-tab: `rewards | privileges`
- notebook sub-tab string

### 5.4 Feature-to-API mapping

| Frontend area | Main tRPC dependencies |
|---|---|
| `LoginPage` | `auth.login` |
| `RegisterPage` | `auth.register` |
| `InviteJoinPage` | `invite.preview`, `invite.join`, `house.create` |
| `HouseManagementPage` | `house.get`, `house.update`, `house.member.*`, `house.roomCode.rotate`, `house.approval.update`, `house.joinRequest.review`, `auth.updatePreferences` |
| `InviteManagementPanel` | `invite.list`, `invite.create`, `invite.revoke` |
| `TasksPage` | `task.list/create/update/assign/delete/accept/submit/submissions/review/toggleStatus`, `wheel.list/create/update/delete/spin` |
| `ShopPage` | `reward.list/create/update/delete/purchase/gift/myPurchases`, `privilege.list/create/update/delete/assign`, `wallet.get/addChym/removeChym` |
| `PunishmentsPage` | `punishment.list/create/update/delete/assign/myAssignments/allAssignments/redeem/forgive`, `wallet.get/addChay/forgiveChay` |
| `NotebookPage` | `notebook.limits.*`, `notebook.agreements.*`, `notebook.journals.*`, `notebook.notes.*` |
| `NotificationBell` | `notification.list`, `notification.unreadCount`, `notification.markRead`, `notification.markAllRead` |
| `GamificationPanel` / hook | `gamification.summary` |

---

## 6. BACKEND FLOW

### 6.1 Hono entry

`backend/api/boot.ts`:

- `GET /` returns `{ ok: true, service: "lunis-house-backend" }`.
- `GET /healthz` returns `{ ok: true }`.
- CORS on `/api/*` with credentials enabled.
- Body limit: `50MB`.
- `GET /api/dev/login` -> dev login handler.
- `POST /api/auth/demo` -> demo auth handler.
- OAuth callback path from `Paths.oauthCallback` -> Kimi OAuth handler.
- `GET /api/panel` -> tRPC panel.
- `/api/trpc/*` -> `fetchRequestHandler` using `appRouter` and `createContext`.
- Catch-all `/api/*` returns 404 JSON.
- In production, starts node server on `process.env.PORT || 3000`.

### 6.2 tRPC root router

`backend/api/router.ts` exposes:

```text
ping
auth
admin
house
wallet
task
reward
privilege
punishment
wheel
gamification
notification
invite
notebook
log
```

### 6.3 Auth boundaries

Defined in `backend/api/middleware.ts`:

- `publicQuery`: no auth required.
- `authedQuery`: requires `ctx.user`.
- `adminQuery`: requires authenticated user with `role === "admin"`.
- `domQuery`: requires authenticated user who is a house member with `lifestyleRole` `dominant` or `switch`.

`createContext` in `backend/api/context.ts` tries `authenticateRequest(headers)` and silently leaves `ctx.user` undefined if auth fails. This means auth enforcement belongs to tRPC procedures, not context creation.

---

## 7. AUTH / REGISTER / ADMIN APPROVAL

This is the most recently changed area and should be treated as WIP until tested.

### 7.1 Register request

Frontend: `frontend/src/features/auth/RegisterPage.tsx`

User submits:

- name
- email
- optional username
- optional phone
- password + confirm password
- lifestyle role: `dominant | submissive | switch`
- gender: `male | female | other`

Backend: `auth.register`

- Normalizes email.
- Rejects existing credential by email.
- Rejects pending/approved registration request by email.
- Hashes password using `scrypt`.
- Inserts into `registrationRequests` with `status = pending`.
- Returns `{ id, status }`.

### 7.2 Admin approval

Backend: `adminRouter`

- `admin.listRegistrations({ status })`
- `admin.approveRegistration({ id })`
- `admin.rejectRegistration({ id, reason? })`

Approval:

- Finds pending registration request.
- Ensures email not already used in `userCredentials`.
- Creates user with `unionId = local:<email>`, `role = user`.
- Creates `userCredentials` with email/username/phone/passwordHash.
- Marks registration request `approved`, with reviewer metadata.
- Sends approval email asynchronously.

Rejection:

- Marks request `rejected`, stores optional reason and reviewer metadata.
- Sends rejection email asynchronously.

### 7.3 Login

Frontend: `LoginPage`

- User enters `Email / Ten dang nhap / So dien thoai` and password.
- Calls `auth.login`.

Backend: `auth.login`

- Looks up `userCredentials` by `email OR username OR phone`.
- Verifies password hash.
- Loads `users`.
- Updates `lastSignInAt`.
- Signs session token and sets HTTP-only session cookie.

### 7.4 Other auth surfaces

- `auth.zaloLogin`: verifies Zalo access token, creates/updates user with `unionId = zalo:<id>`, signs session cookie.
- `auth.me`: returns authenticated user plus language preference.
- `auth.updatePreferences`: upserts language preference.
- `auth.logout`: clears session cookie.
- `createOAuthCallbackHandler` handles Kimi OAuth callback path.
- Demo/dev auth endpoints exist for local/demo workflows.

---

## 8. DOMAIN API SURFACE

| Router | Procedures |
|---|---|
| `auth` | `zaloLogin`, `register`, `login`, `me`, `updatePreferences`, `logout` |
| `admin` | `listRegistrations`, `approveRegistration`, `rejectRegistration` |
| `house` | `get`, `create`, `update`, `roomCode.rotate`, `approval.update`, `joinRequest.review`, `member.update`, `member.remove`, `member.selfUpdate`, `member.add` |
| `invite` | `list`, `create`, `revoke`, `preview`, `join` |
| `task` | `list`, `create`, `update`, `assign`, `delete`, `accept`, `submit`, `submissions`, `review`, `toggleStatus` |
| `wheel` | `list`, `create`, `update`, `delete`, `spin`, `spins` |
| `wallet` | `get`, `addChym`, `removeChym`, `addChay`, `forgiveChay` |
| `reward` | `list`, `create`, `update`, `delete`, `purchase`, `gift`, `myPurchases` |
| `privilege` | `list`, `create`, `update`, `delete`, `assign`, `myAssignments`, `use` |
| `punishment` | `list`, `create`, `update`, `delete`, `assign`, `myAssignments`, `allAssignments`, `redeem`, `forgive` |
| `notebook` | `limits.list`, `limits.create`, `limits.delete`, `agreements.list`, `agreements.create`, `agreements.sign`, `journals.list`, `journals.create`, `journals.entries.list`, `journals.entries.create`, `notes.list`, `notes.create`, `notes.update`, `notes.delete` |
| `notification` | `list`, `unreadCount`, `markRead`, `markAllRead` |
| `gamification` | `summary` |
| `log` | `list` |

---

## 9. DATABASE MODEL

Primary schema file: `backend/db/schema.ts`.

### 9.1 Enums

- `role`: `user | admin`
- `registrationStatus`: `pending | approved | rejected`
- `lifestyleRole`: `dominant | submissive | switch`
- `gender`: `male | female | other`
- `language`: `en | vi`
- `taskCategory`: `daily | weekly | monthly | special | superSpecial`
- `taskStatus`: `pending | active | submitted | completed | failed`
- `taskSubmissionStatus`: pending/review states in schema
- `rarity`: `common | rare | epic | legendary`
- `purchaseStatus`: `active | used | expired`
- `assignmentStatus`: `active | redeemed | forgiven`
- `privilegeStatus`: `active | used | expired`
- `limitType`: `limit | desire`
- `agreementStatus`: `pending | active | void`
- `mood`: `sad | neutral | happy | excited | loved`
- `visibility`: `public | private`
- `inviteStatus`: `active | accepted | revoked | expired`
- `joinRequestStatus`: pending/review states in schema
- `streakSource`: `task`
- `notificationType`: notification event types in schema
- `achievementCriteria`: `total_completions | current_streak | xp | level`

### 9.2 Tables

| Area | Tables |
|---|---|
| Auth/users | `users`, `userPreferences`, `userCredentials`, `registrationRequests` |
| House | `houses`, `roomCodes`, `roomJoinRequests`, `houseMembers`, `houseInvites` |
| Wallet/progress | `wallets`, `memberProgress`, `streaks`, `achievements`, `memberAchievements` |
| Tasks | `tasks`, `taskSubmissions` |
| Shop | `rewards`, `rewardPurchases`, `rewardGiftDetails`, `privileges`, `privilegeAssignments` |
| Punishments | `punishments`, `punishmentAssignments` |
| Notebook | `limits`, `agreements`, `journals`, `journalEntries`, `notes` |
| System | `notifications`, `logs`, `wheels`, `wheelSpins` |

### 9.3 Registration migration script

`scripts/apply-registration-schema.mjs`:

- Adds `username`, `phone` columns to `userCredentials`.
- Creates `registrationStatus` enum if missing.
- Creates `registrationRequests` table if missing.
- Adds unique email index and status index.
- Run with:

```bash
node --env-file=.env scripts/apply-registration-schema.mjs
```

Other apply/verify scripts already exist for invite, gamification, notification, reward gifting, task submission, room code, language, user login, text encoding cleanup.

---

## 10. GAMIFICATION SIDE EFFECTS

`backend/api/lib/gamification.ts` centralizes task completion progress:

- `calculateLevel(xp)`: 100 XP per level, min level 1.
- `getCompletionXp(chymReward)`: base 25 XP + `chymReward * 2`.
- `ensureDefaultAchievements`: seeds default achievements if missing.
- `ensureMemberProgress`: creates progress row if missing.
- `awardCompletionProgress`: updates streak, XP, level, achievements after task completion.

Default achievements:

- `first_step`
- `streak_3`
- `streak_7`
- `xp_100`
- `level_5`

Any change to task review/completion, wallet reward, or member progress should review this helper and run regression tests.

---

## 11. ENVIRONMENT / CONFIG / DEPLOY

### 11.1 Important env vars

From `.env.example`, `.env.local.example`, and `backend/api/lib/env.ts`:

```text
APP_ID
APP_SECRET
JWT_SECRET                 # canonical for demo auth endpoint
DATABASE_URL
VITE_API_URL               # optional frontend API origin
VITE_KIMI_AUTH_URL
VITE_APP_ID
KIMI_AUTH_URL
KIMI_OPEN_URL
OWNER_UNION_ID
ZALO_APP_ID
ZALO_OPEN_API_URL
SMTP_URL
SMTP_API_KEY
MAIL_FROM
DEMO_MODE
NODE_ENV
PORT
```

Backend `env.ts` requires:

- `APP_ID`
- `APP_SECRET`
- `DATABASE_URL`
- `KIMI_AUTH_URL`
- `KIMI_OPEN_URL`

### 11.2 Dev config

`frontend/vite.config.ts`:

- Port: `3000`.
- Mounts backend entry `../backend/api/boot.ts` in dev.
- Excludes non-API paths from backend.
- Uses `kimi-plugin-inspect-react`.
- Aliases:
  - `@` -> `frontend/src`
  - `@contracts` -> `backend/contracts`
  - `@db` -> `backend/db`
  - `db` -> `backend/db`

### 11.3 Production config

`vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://queststreak-1.onrender.com/api/:path*"
    }
  ]
}
```

`backend/render.yaml`:

- Service: `lunis-house-backend`
- Runtime: Node
- Region: Singapore
- Plan: free
- Build: `npm run build`
- Start: `node dist/boot.js`
- `DEMO_MODE=true` by default in Render config

---

## 12. CURRENT GIT / WORKTREE NOTES

Observed before editing this checkpoint:

```text
 M .env.example
 M AGENTS.md
 M CLAUDE.md
 M backend/api/auth-router.ts
 M backend/api/lib/env.ts
 M backend/api/router.ts
 M backend/db/schema.ts
 M frontend/src/App.tsx
 M frontend/src/features/auth/LoginPage.tsx
?? backend/api/admin-router.ts
?? backend/api/lib/mailer.ts
?? checkpoint.md
?? frontend/src/features/auth/RegisterPage.tsx
?? scripts/apply-registration-schema.mjs
```

Interpretation:

- Registration/admin approval work appears uncommitted.
- `checkpoint.md` was untracked before this update.
- Do not assume HEAD `d2bbade` contains all current behavior; source working tree has newer changes.
- Before committing any code change, run GitNexus `detect_changes({ scope: "all", repo: "QuestStreak" })`.

---

## 13. KNOWN RISKS

| Risk | Severity | Notes |
|---|---|---|
| Auth/register approval is newly added and uncommitted | High | Needs typecheck, tests, DB migration verification, admin UI integration. |
| Registration approval has backend admin procedures but no obvious admin UI route yet | High | `adminRouter` exists; frontend admin management screen for registration review still pending. |
| Email sending is best-effort/non-blocking | Medium | Good for UX, but failures are only logged. Need operational monitoring if production depends on email. |
| `sendMail` supports HTTPS relay, not real SMTP sockets | Medium | `SMTP_URL` name can be misleading; non-HTTPS URL logs skip because nodemailer is not bundled. |
| Dev and prod API topology differ | Medium | Dev same Vite origin with mounted Hono; prod Vercel rewrite to Render. CORS/cookie behavior must be tested on deploy domains. |
| Large feature pages | Medium | `TasksPage`, `ShopPage`, `PunishmentsPage` are large and carry many mutations; refactor only after regression tests. |
| README still Vite template | Low/Medium | New agents should rely on this checkpoint and source, not README. |
| Test coverage unclear | Medium | Vitest config exists, but no broad test suite documented. |

---

## 14. BACKLOG / RECOMMENDED NEXT WORK

### Highest priority

- [ ] Run `npm run check`, `npm run lint`, `npm run test`, `npm run build` and record results.
- [ ] Apply/verify registration schema on the intended dev/staging DB.
- [ ] Add admin UI for registration review, or document where admins should call `admin.listRegistrations/approveRegistration/rejectRegistration`.
- [ ] Add regression tests for:
  - `auth.register`
  - duplicate registration handling
  - `admin.approveRegistration`
  - `admin.rejectRegistration`
  - `auth.login` by email/username/phone
  - session cookie set/clear

### Medium priority

- [ ] Update README to describe monorepo architecture, env setup, dev/build/deploy flow.
- [ ] Add CI pipeline for check/lint/test/build.
- [ ] Verify Vercel + Render CORS/cookie behavior under HTTPS.
- [ ] Add DB migration verification scripts for registration if missing from standard verify suite.
- [ ] Add operational note for email provider config (`SMTP_URL` HTTPS relay semantics).

### Refactor candidates after tests

- [ ] Split `TasksPage` into task list, task form, submission review, wheel management hooks/components.
- [ ] Split `ShopPage` into rewards, privileges, wallet admin actions, gift/purchase dialogs.
- [ ] Split `PunishmentsPage` into catalog/admin assignment/user assignment lifecycle.
- [ ] Centralize repeated `house.get` member/role derivation if it keeps growing.

---

## 15. VERIFICATION STATUS OF THIS CHECKPOINT

Analysis performed:

- Read GitNexus repo context, clusters, process summary, and architecture query for `QuestStreak`.
- Read current `checkpoint.md`.
- Read root/frontend/backend package metadata.
- Read `frontend/src/App.tsx`, Zustand store, auth pages.
- Read backend `boot.ts`, `router.ts`, `middleware.ts`, `context.ts`, `auth-router.ts`, `admin-router.ts`, `lib/gamification.ts`, `lib/mailer.ts`.
- Scanned schema exports/tables/enums from `backend/db/schema.ts`.
- Scanned tRPC client usage from frontend.
- Read deployment configs `frontend/vite.config.ts`, `vercel.json`, `backend/render.yaml`.
- Read registration schema script.

Not run in this checkpoint update:

- `npm run check`
- `npm run lint`
- `npm run test`
- `npm run build`
- DB migration against real database
- Browser/manual UI verification

Reason: requested task was source analysis and checkpoint update; no application logic was changed.

---

## 16. LINKS / ENTRY POINTS

| Purpose | Path |
|---|---|
| Main frontend app | `frontend/src/App.tsx` |
| Frontend entry | `frontend/src/main.tsx` |
| tRPC provider | `frontend/src/providers/trpc.tsx` |
| API URL helper | `frontend/src/lib/api.ts` |
| UI state store | `frontend/src/shared/store/useAppStore.ts` |
| Backend Hono entry | `backend/api/boot.ts` |
| tRPC root router | `backend/api/router.ts` |
| tRPC auth middleware | `backend/api/middleware.ts` |
| tRPC context/session load | `backend/api/context.ts` |
| Auth router | `backend/api/auth-router.ts` |
| Admin registration router | `backend/api/admin-router.ts` |
| Database schema | `backend/db/schema.ts` |
| Database relations | `backend/db/relations.ts` |
| DB client | `backend/db/index.ts` |
| Gamification helper | `backend/api/lib/gamification.ts` |
| Notification helper | `backend/api/lib/notifications.ts` |
| Mail helper | `backend/api/lib/mailer.ts` |
| Registration schema script | `scripts/apply-registration-schema.mjs` |
| Vite config | `frontend/vite.config.ts` |
| Vercel rewrite | `vercel.json` |
| Render backend config | `backend/render.yaml` |

---

*Checkpoint CP-002 cap nhat luc: 28/06/2026*
