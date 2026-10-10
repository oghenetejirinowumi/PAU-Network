# PAU Network

PAU Network connects Pan-Atlantic University students with alumni from their own course. Students filter alumni by department, view LinkedIn-style profiles, book 30-minute mentorship sessions, send message requests, and join live Q&A spaces. Alumni publish availability, post to the timeline, host spaces, and earn badges, tiers and awards for helping.

Built in 6 hours for the Technology Innovation Club Mini Hackathon (Challenge 06: Alumni networking).

> All people in the seed data are fictional. Employers are real Nigerian companies, used only for realism.

## Architecture

```
PAU-Network/
├── backend/                 Express 5 + TypeScript REST API and Socket.IO server
│   ├── prisma/
│   │   ├── schema.prisma    Data model (single source of truth)
│   │   ├── migrations/      SQL migrations (includes partial unique index + check constraints)
│   │   ├── seed.ts          Demo users, work history, 20 months of activity, spaces, posts, messages
│   │   └── seed-awards.ts   Computes historical monthly/yearly awards from the points ledger
│   ├── prisma.config.ts     Prisma 7 config (CLI uses DIRECT_URL)
│   └── src/
│       ├── app.ts           Express app, routes mounted under /api/v1
│       ├── server.ts        HTTP + Socket.IO entry point
│       ├── config/env.ts    Validated environment variables
│       ├── lib/             prisma client (driver adapter), JWT, errors, validation, shared selects
│       ├── middleware/      authenticate, requireRole, error handler
│       ├── realtime/        Socket.IO rooms: user:<id>, space:<id>
│       └── modules/         One folder per feature: <feature>.routes.ts (+ .service.ts / .config.ts)
│           ├── auth  users  profile  departments
│           ├── availability  bookings
│           ├── conversations  posts  spaces
│           ├── gamification  awards  notifications
└── frontend/                Next.js 15 (App Router) + Tailwind CSS v4
    └── src/
        ├── theme.ts         ALL colours live here (see "Theming")
        ├── app/             Pages: feed, alumni, profile/[userId], settings, spaces, spaces/[spaceId],
        │                    messages, messages/[conversationId], bookings, availability, achievements, awards
        ├── components/      AppShell, ui kit, PostCard, BookingModal, EmojiPicker, Toast
        └── lib/             api client, session + socket context, types, formatters, image resizing
```

**Request flow:** browser → REST `/api/v1/*` (JWT bearer token) → Prisma 7 (`@prisma/adapter-pg`) → PostgreSQL (Neon). State changes emit Socket.IO events (`resource:action-past-tense`, e.g. `space:hand-raised`) so open tabs update live.

**Audio/video** in sessions and spaces uses Jitsi Meet rooms (no API key). Raised hands, speakers, questions, upvotes and emoji reactions run on our own Socket.IO server.

## Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Prisma models | PascalCase, singular | `SpaceQuestion` |
| Database tables | snake_case, plural | `space_questions` |
| Fields / JSON keys | camelCase | `graduationYear` |
| Database columns | snake_case | `graduation_year` |
| Enums | PascalCase type, SCREAMING_SNAKE values | `BookingStatus.PENDING` |
| Primary / foreign keys | `id` (UUID) / `<relation>Id` | `authorId` |
| Booleans | `is` / `has` prefix | `isVerified`, `hasOpenSlots` |
| Timestamps | `<event>At`, UTC ISO 8601 | `createdAt`, `startsAt` |
| Counters | `<thing>Count` | `commentCount` |
| REST paths | plural kebab-case nouns, actions as sub-resources | `POST /bookings/:bookingId/accept` |
| Socket events | `resource:action-past-tense` | `space:question-created` |
| Responses | `{ data, meta? }` / `{ error: { code, message, details? } }` | |

## Features

- **Directory** filtered by department, class year, industry and open slots. Students see their own course first.
- **Profiles** with a backdrop banner, profile photo, headline, about, experience (current and past roles), education, skills, badges and awards. Images are resized in the browser (avatar 320×320, banner 1500×375).
- **Mentorship sessions**: alumni publish slots (one-off or weekly pattern); students request with a topic and message; a request holds the slot; accepting creates a Jitsi link; students rate completed sessions.
- **Message requests**: students message alumni; nothing more can be sent until the alumnus accepts.
- **Timeline**: only alumni post; everyone comments (with one level of replies) and reacts 👍 ❤️ 🎉 💡 😂 🤝. Emoji picker in posts, comments and chat.
- **Spaces**: alumni schedule or go live; students RSVP, join, raise hands, get invited on stage, ask and upvote questions, and send floating emoji reactions.
- **Gamification**: an immutable points ledger with daily limits; tiers Bronze (0) → Silver (500) → Gold (2,000) → Platinum (5,000); 23 badges, each with a Bronze to Platinum level; monthly / yearly / all-time leaderboards.
- **Awards**: Alumni of the Month (3-month cooldown), Student of the Month, Department Champion, and yearly Alumni of the Year, Rising Star, Space of the Year and Students' Choice (community voting).
- **Notifications** stored and pushed live.

## Theming

Every colour is defined once in [`frontend/src/theme.ts`](frontend/src/theme.ts). The root layout turns it into CSS variables, and [`globals.css`](frontend/src/app/globals.css) maps them to Tailwind classes (`bg-primary`, `text-muted`, `border-line`, `bg-tier-gold`, …). Change a hex value in `theme.ts` and the whole app updates. To add a new colour, add it to `theme.ts` and add one `--color-<name>: var(--<name>);` line to `@theme inline` in `globals.css`.

## Running locally

Requirements: Node 20+.

```bash
# 1. Backend
cd backend
cp .env.example .env          # paste your Neon DATABASE_URL and DIRECT_URL
npm install
npx prisma migrate deploy
npm run db:seed               # demo data; every account's password is demo1234
npm run dev                   # http://localhost:4000/api/v1

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

No Neon yet? `npx prisma dev` starts a local Postgres; put its URL in both `DATABASE_URL` and `DIRECT_URL` and set `DATABASE_POOL_MAX=1`.

Demo logins (password `demo1234`): `david.olawale@pau-network.demo` (CS student), `chinedu.okafor@pau-network.demo` (alumni, Paystack), `admin@pau-network.demo` (admin). The login page has one-click demo buttons.

## Deployment

- **Database:** Neon. Use the pooled URL for `DATABASE_URL` and the direct URL for `DIRECT_URL`.
- **Backend:** Render, using [`render.yaml`](render.yaml). Set `DATABASE_URL`, `DIRECT_URL` and `CORS_ORIGINS` (your Vercel URL).
- **Frontend:** Vercel with root directory `frontend` and `NEXT_PUBLIC_API_URL=https://<your-render-app>.onrender.com/api/v1`.
- **Awards:** call `POST /api/v1/awards/compute` as an admin on the 1st of each month (and on 1 January for yearly awards), e.g. from a cron job.
