# BYU-I Mentor Connect

Peer mentorship platform for BYU-Idaho students. Next.js 15 + Drizzle + Neon Postgres + Auth.js, deployed on Vercel.

## Stack

- **Framework**: Next.js 15 (App Router) + React 19
- **Database**: Neon Postgres (serverless) via Drizzle ORM
- **Auth**: NextAuth v5 (magic-link email, `@byui.edu` enforced)
- **UI**: Tailwind CSS + Inter/Outfit fonts (BYU-I navy)
- **Host**: Vercel

## Data model

Members table = `user`. Every signup is a member; mentors are flagged via `is_mentor` after admin approval of a `mentor_application`. There is no "role" field — anyone can apply to mentor.

| Table | Purpose |
|---|---|
| `user` | All members (mentor flag, profile, career interests) |
| `mentor_application` | Pending/approved/rejected applications |
| `request` | Mentee → mentor pairing requests |
| `match` | Accepted pairings (active/completed/cancelled) |
| `meeting_log` | Mentor-recorded session logs |
| `monthly_feedback` | Monthly survey responses |

## Setup

### 1. Install

```bash
cd app
npm install
```

### 2. Create a Neon project

- Go to https://console.neon.tech and create a new project (e.g. `byui-mentor-connect`).
- Copy the `DATABASE_URL` (use the **pooled** connection string for runtime).
- For local migrations you can use the **direct** (unpooled) URL.

### 3. Configure env

Copy `.env.example` to `.env.local` and fill in:

```ini
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
AUTH_SECRET=  # generate with: openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Email for magic links — Resend (https://resend.com).
# Verify byuican.com in Resend → Domains before going live.
AUTH_RESEND_KEY=re_xxx
EMAIL_FROM="BYUI CAN Mentor Connect <noreply@byuican.com>"
```

### 4. Push schema to Neon

```bash
npm run db:push
```

This creates all tables in your Neon database. To inspect with Drizzle Studio:

```bash
npm run db:studio
```

### 5. Make yourself an admin

After signing in once with your @byui.edu address, run a one-off update against the database:

```sql
update "user" set is_admin = true where email = 'YOUR_EMAIL@byui.edu';
```

### 6. Run locally

```bash
npm run dev
```

## Deploy to Vercel

```bash
# from the app/ folder
vercel link
vercel env add DATABASE_URL
vercel env add AUTH_SECRET
vercel env add AUTH_URL          # production URL, e.g. https://byuican.com
vercel env add AUTH_RESEND_KEY
vercel env add EMAIL_FROM        # "BYUI CAN Mentor Connect <noreply@byuican.com>"
vercel --prod
```

Don't forget to push the schema to the production Neon DB too:

```bash
DATABASE_URL='<prod-url>' npm run db:push
```

## Routes

| Path | Purpose |
|---|---|
| `/` | Landing page (redirects signed-in users to `/dashboard`) |
| `/login` | Magic-link sign-in (BYU-I email only) |
| `/login/check-email` | "We sent you a link" confirmation |
| `/onboarding` | First-time profile completion |
| `/dashboard` | Member home, stats, quick actions |
| `/mentors` | Browse available mentors |
| `/apply-mentor` | Submit a mentor application |
| `/requests` | Incoming + outgoing requests |
| `/matches` | Active matches with unlocked contact info |
| `/admin` | Application review + program stats (admin-only) |
| `/profile` | Edit profile |
| `/api/me`, `/api/mentors`, `/api/requests`, `/api/matches`, `/api/mentor-applications`, `/api/meeting-logs`, `/api/feedback` | REST API |

## Demo accounts

For evaluations and proposal demos, the app ships with three pre-seeded accounts and a one-click "Sign in as…" panel on `/login`.

| Role | Email | What they see |
|---|---|---|
| Admin | `admin.demo@byui.edu` | Program metrics, mentor application review |
| Mentor | `mentor.demo@byui.edu` | Incoming requests, capacity, meeting logging |
| Member | `member.demo@byui.edu` | Browse mentors, send requests, apply to mentor |

To enable:

```bash
# In .env.local (or Vercel env vars)
DEMO_ENABLED=true

# After db:push
npm run db:seed
```

The demo panel is hidden when `DEMO_ENABLED` is not `true`, so production deployments can ship without it.

## Spec changes from previous Firebase build

- Removed: `role`, `birthday`, `maritalStatus`
- Added: `expectedGraduation`, `isMentor` (flag), `mentor_application` table
- Career interests: controlled vocabulary, see `src/lib/careers.ts`
- Auth: Firebase Auth → Auth.js magic links
- Storage: Firestore → Neon Postgres via Drizzle
