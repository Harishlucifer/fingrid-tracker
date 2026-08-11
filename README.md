# Inforvio PM

Internal project-management tool: projects, kanban board, comments and
@mentions, file attachments, sprints, time tracking and reports.

**Sign-in is Google-only and restricted to email domains an admin configures in
the app.** Everyone else is refused.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind 4 ·
shadcn/ui · TanStack Query · Auth.js v5 · Prisma 7 · MySQL

## Setup

### 1. Database

```bash
brew services start mysql
mysql -u root -e "CREATE DATABASE inforvio_pm CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

### 2. Google OAuth client

In [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **OAuth consent screen** → user type **Internal** if the target domain is a
   Google Workspace you own (no verification needed); otherwise **External**.
   Scopes: `openid`, `email`, `profile` — nothing more.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
3. **Authorized redirect URIs**, exactly:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<prod-host>/api/auth/callback/google`
4. **Authorized JavaScript origins**: `http://localhost:3000` and your prod host.

### 3. Environment

```bash
cp .env.example .env
npx auth secret        # writes AUTH_SECRET
```

Then set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and
`BOOTSTRAP_ALLOWED_DOMAINS` / `BOOTSTRAP_ADMIN_EMAILS`.

### 4. Migrate and seed

```bash
npm install
npm run db:migrate
npm run db:seed        # REQUIRED — without it nobody can sign in
npm run dev
```

The seed is not optional. The sign-in callback reads the `allowed_domain` table
and nothing else, so an empty table refuses everyone — deliberately, because a
config fallback in the sign-in path would be a way around the allowlist.

## Attachment storage (Amazon S3)

Attachments go through a small `Storage` interface with two drivers. Local disk is
the default so development needs no AWS account; `STORAGE_DRIVER=s3` switches to
S3 and nothing else changes.

```bash
STORAGE_DRIVER="s3"
S3_BUCKET="inforvio-pm-attachments"     # must be PRIVATE
S3_REGION="ap-south-1"
# S3_PREFIX="production"                # optional, share one bucket per env
# S3_KMS_KEY_ID="..."                   # optional, SSE-KMS instead of SSE-S3
```

Setup:

1. **Create a private bucket.** Block Public Access on, no public policy. The app
   never grants public reads.
2. **Grant the app's role** `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject`
   on `arn:aws:s3:::<bucket>/*`. Credentials come from the SDK's default provider
   chain (environment, shared profile, or instance/task role) — none go in `.env`.
3. **Optionally set a lifecycle rule** to expire old versions, and enable
   versioning if you want deleted attachments recoverable.

Objects are encrypted at rest (SSE-S3 by default, SSE-KMS with `S3_KMS_KEY_ID`).

**Downloads stream through the app rather than via a presigned URL.** That is
deliberate: `GET /api/v1/attachments/:id/download` authorises the caller against
the owning project before any byte moves, whereas a presigned URL is a bearer
credential anyone could forward for its lifetime. With a 25 MB cap, proxying is
cheap. If you later need presigned URLs for much larger files, add a fourth
method to the interface rather than loosening the download route.

Missing `S3_BUCKET` makes the app fail at **boot**, not on the first upload — a
misconfigured server should not silently write attachments to local disk.

## Email notifications (Amazon SES)

People are emailed when a task is **assigned** to them, when they are
**@mentioned**, and when someone comments on a task they are the assignee or
reporter of. Nobody is ever emailed about their own action.

Locally, nothing needs configuring: `MAIL_DRIVER=log` prints each message to the
server console.

### Switching on SES

1. **Verify the sender identity** — SES → Verified identities → verify the domain
   `loanwiser.in` (preferred; covers every address on it) or a single address.
   Enable **DKIM** while you are there, or mail lands in spam.
2. **Leave the sandbox.** A new SES account can only send *to* verified
   addresses. Request production access, or every teammate's address has to be
   verified individually first. This is the step people miss.
3. **Grant `ses:SendEmail`** to the role the app runs as. Credentials are read by
   the AWS SDK's default provider chain — environment, shared profile, or
   instance/task role — so no secret goes in `.env`.
4. **Optional but recommended:** create a configuration set with an SNS
   destination for bounces and complaints, and set `SES_CONFIGURATION_SET`.
   Without it, repeated bounces quietly damage your sending reputation.
5. Set these in `.env`:

```bash
MAIL_DRIVER="ses"
MAIL_FROM="Inforvio PM <no-reply@loanwiser.in>"   # a verified identity
SES_REGION="ap-south-1"
APP_URL="https://pm.your-host"                     # links in emails are absolute
```

### If an email does not arrive

```bash
curl -s localhost:3000/api/v1/admin/notifications | jq       # delivery state + counts
curl -X POST localhost:3000/api/v1/admin/notifications       # force a flush
curl -X POST 'localhost:3000/api/v1/admin/notifications?reset_failed=true'
```

Notifications are a durable outbox: a failed send keeps the row with its error
and retries, so fixing SES and forcing a flush delivers everything that queued
while it was broken. Nothing is lost silently.

## How access control works

| | |
|---|---|
| **Allowlist** | `allowed_domain` table, managed at **Settings → Allowed domains**. Checked on *every* sign-in, not just the first. |
| **Matching** | Exact. `inforvio.com` does not admit `mail.inforvio.com` — add each domain separately. |
| **Roles** | Org: `ADMIN` / `MEMBER` / `VIEWER`. Project: `LEAD` / `MEMBER` / `VIEWER`. The **narrower of the two wins**; admins reach every project. |
| **Revocation** | Sessions are database-backed. Disabling a domain or deactivating a member deletes their sessions, cutting access immediately. |
| **Failure mode** | Fail closed. If the database is unreachable, sign-in is refused rather than allowed through. |

## Verifying it works

```bash
npm run typecheck && npm run lint && npm run test
curl localhost:3000/api/healthz    # {"data":{"status":"ok"}}
curl localhost:3000/api/readyz     # 503 if MySQL is down
```

End-to-end, including the test that matters most:

1. Visit `/projects` signed out → redirected to `/login`.
2. Sign in with an account on a seeded domain → lands on the dashboard, and the
   account listed in `BOOTSTRAP_ADMIN_EMAILS` becomes `ADMIN`.
3. **Negative test:** sign out, then try an account on a domain that is *not*
   allowed → refused with an explanation, and **no user row is created**.
4. As admin, add that domain under Settings → Allowed domains → retry → now
   admitted as `MEMBER`. Toggle it off → that user is refused and their live
   session is revoked.
5. Stop MySQL and attempt sign-in → refused (fails closed, not open).

## Scripts

| | |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm run build` / `start` | production build / serve |
| `npm run typecheck` | `tsc --noEmit` — the primary gate |
| `npm run lint` | eslint |
| `npm run test` | vitest (pure logic; no database needed) |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | seed the allowlist and promote bootstrap admins |
| `npm run db:studio` | browse the database |

See [AGENTS.md](AGENTS.md) for architecture and conventions.
