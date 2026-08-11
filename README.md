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

The connection is configured as **discrete values, not a URL** — the same names
the Go services use, so a deployment's SSM parameters look consistent:

```bash
DB_HOST="127.0.0.1"     # default 127.0.0.1
DB_PORT="3306"          # default 3306
DB_USER="root"          # default root
DB_PASS=""              # empty is valid on a fresh local MySQL
DB_NAME="inforvio_pm"   # required — no default
```

Only `DB_NAME` is mandatory; silently defaulting *which database* is how you
migrate the wrong schema. There is no `DATABASE_URL`: the runtime client hands
these to the driver adapter as an object (so a password containing `@`, `:`, `/`
or `#` needs no escaping), and `prisma.config.ts` composes a percent-encoded URL
for the Prisma CLI, which only understands URLs.

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

## AWS credentials

S3 and SES resolve **separate** credentials, so each can be a least-privilege IAM
user — an attachment key that cannot send mail, and a mail key that cannot read
the bucket. Resolution happens in
[src/lib/aws-credentials.ts](src/lib/aws-credentials.ts).

```bash
S3_ACCESS_KEY_ID="AKIA..."       # needs only s3:{Put,Get,Delete}Object
S3_SECRET_ACCESS_KEY="..."

SES_ACCESS_KEY_ID="AKIA..."      # needs only ses:SendEmail
SES_SECRET_ACCESS_KEY="..."
```

Per service, first match wins:

1. `<SERVICE>_ACCESS_KEY_ID` + `<SERVICE>_SECRET_ACCESS_KEY` — the separate key.
2. `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` — a shared key, if one IAM user
   is fine for both.
3. Neither — the SDK's default provider chain (shared profile, or an EC2/ECS
   instance role).

**A half-configured pair is a hard error, at every level.** A mistyped
`SES_SECRET_ACCESS_KEY` must not silently drop to the shared key, or to an
instance role in another account — that is how mail starts sending from an
identity nobody intended. The error names the missing variable.

| Permission | Key |
|---|---|
| `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>/*` | `S3_*` |
| `ses:SendEmail` | `SES_*` |

Static keys are long-lived secrets you rotate by hand. `.env` is gitignored —
keep it that way, and prefer an instance role in production, where there is
nothing to rotate and nothing to leak.

## Attachment storage (Amazon S3)

**S3 is the only attachment store — there is no local-disk fallback.** Attachment
upload and download therefore need AWS credentials and a bucket, including in
development. Everything else in the app runs without AWS.

```bash
S3_BUCKET="inforvio-pm-attachments"     # required, must be PRIVATE
S3_REGION="ap-south-1"
# S3_PREFIX="production"                # optional, share one bucket per env
# S3_KMS_KEY_ID="..."                   # optional, SSE-KMS instead of SSE-S3
# S3_ENDPOINT="..."                     # optional, MinIO/LocalStack only
```

Setup:

1. **Create a private bucket.** Block Public Access on, no public policy. The app
   never grants public reads.
2. **Grant** `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on
   `arn:aws:s3:::<bucket>/*` to the `S3_*` key. It needs nothing else.
3. **Optionally set a lifecycle rule** to expire old versions, and enable
   versioning if you want deleted attachments recoverable.

Objects are encrypted at rest (SSE-S3 by default, SSE-KMS with `S3_KMS_KEY_ID`).

**Downloads stream through the app rather than via a presigned URL.** That is
deliberate: `GET /api/v1/attachments/:id/download` authorises the caller against
the owning project before any byte moves, whereas a presigned URL is a bearer
credential anyone could forward for its lifetime. With a 25 MB cap, proxying is
cheap. If you later need presigned URLs for much larger files, add a fourth
method to the interface rather than loosening the download route.

Missing `S3_BUCKET` raises a named error the first time attachment storage is
touched. Env access is lazy so that `next build` works without secrets present,
which means the failure surfaces on the first upload rather than at process
start — but it names the missing variable, and there is no fallback that could
quietly put bytes somewhere they would be lost.

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
3. **Grant `ses:SendEmail`** to the `SES_*` key. It needs nothing else — and in
   particular no access to the attachment bucket.
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
