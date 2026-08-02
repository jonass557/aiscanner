# AI Chart Scanner

A production-grade SaaS platform that lets traders upload a screenshot of any trading chart (Forex, Crypto, Indices, Commodities, or Deriv Synthetic Indices) and receive a complete, institutional-grade technical analysis powered by AI — a clear **BUY / SELL / NO-TRADE** decision, a confidence score, a full trade plan, and a detailed reasoning report.

## Features

- **AI chart analysis** — Smart Money Concepts (BOS, CHoCH, MSS, order blocks, FVGs, breaker/mitigation blocks, liquidity, premium/discount zones) plus classic technical analysis.
- **Clear decisions** — every scan returns exactly `BUY`, `SELL`, or `NO_TRADE`. Confidence below 70% forces `NO_TRADE`.
- **Full trade plan** — entry, stop loss, three take-profits, risk/reward, estimated duration and probability.
- **Provider-agnostic AI** — swap OpenAI / Claude / Gemini (or a custom model) via a single env var, with a deterministic mock fallback for development.
- **Auth** — register, login, email verification, password reset, JWT + refresh tokens.
- **Dashboard** — usage stats, activity charts, history with search/filter/pagination, PDF + CSV export.
- **Subscriptions** — Free / Pro / Premium plans with per-plan scan limits and monthly reset.
- **Admin panel** — platform stats, user management, credit grants, system logs, AI-config visibility.
- **Modern UX** — responsive, dark mode, animations, glassmorphism, lazy-loaded routes.

## Tech Stack

| Layer     | Technology                                            |
| --------- | ----------------------------------------------------- |
| Frontend  | React (Vite), Tailwind CSS, React Router, Framer Motion, Recharts |
| Backend   | Node.js, Express, modular architecture, REST API      |
| Database  | MongoDB (Mongoose)                                    |
| Media     | Cloudinary                                            |
| AI        | OpenAI / Anthropic Claude / Google Gemini (abstracted)|
| Auth      | JWT (access + refresh), bcrypt                        |
| Testing   | Jest, Supertest, mongodb-memory-server, Vitest        |

## Project Structure

```
AIscanner/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/       # Reusable UI + landing + analysis components
│       ├── context/          # Auth & Theme providers
│       ├── layouts/          # Auth / Dashboard / Admin shells
│       ├── pages/            # Route pages (landing, auth, dashboard, admin)
│       ├── services/         # axios instance + typed endpoint wrappers
│       └── utils/            # formatting helpers
│
├── server/                  # Express backend
│   └── src/
│       ├── config/           # env, logger, database, plans
│       ├── controllers/      # auth, scan, analysis, user, admin
│       ├── middleware/       # auth, validate, rate limit, upload, errors
│       ├── models/           # User, Analysis, Log
│       ├── routes/           # versioned REST routes (/api/v1)
│       ├── services/         # ai/ (provider abstraction), email, upload, export, logs, tokens
│       ├── validators/       # Joi schemas
│       └── scripts/          # seedAdmin
│
├── PROJECT_PLAN.md          # Full development plan
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ (uses native `fetch`)
- MongoDB (local or Atlas)
- (Optional) Cloudinary account, an AI provider API key, and SMTP credentials

### 1. Backend

```bash
cd server
npm install
cp .env.example .env      # then edit .env
npm run seed:admin        # create the admin account
npm run dev               # starts on http://localhost:5000
```

### 2. Frontend

```bash
cd client
npm install
npm run dev               # starts on http://localhost:3000 (proxies /api -> :5000)
```

Open http://localhost:3000.

> **Zero-config dev mode:** with no AI key, no Cloudinary, and no SMTP configured, the app still runs end-to-end — the AI falls back to a deterministic mock analyst, images use inline data URLs, and emails print to the server console.

## Environment Variables

See [`server/.env.example`](server/.env.example) for the full list. Key ones:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets |
| `AI_PROVIDER` | `openai` \| `claude` \| `gemini` \| `mock` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Provider keys |
| `CLOUDINARY_*` | Image storage |
| `EMAIL_*` | SMTP for verification / reset emails |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeded admin credentials |

## Swapping the AI Provider

The analysis logic depends only on `services/ai/BaseProvider`. To change providers, set `AI_PROVIDER` and the matching API key — no code changes required. To add a new provider (e.g. a custom computer-vision model), implement `isConfigured()` and `analyze()` in a new class extending `BaseProvider` and register it in `services/ai/index.js`.

## API Overview

Base URL: `/api/v1`

- `POST /auth/register` · `POST /auth/login` · `GET /auth/me` · `POST /auth/verify-email` · `POST /auth/forgot-password` · `POST /auth/reset-password`
- `POST /scan` — upload an image, get an analysis (multipart, field `image`)
- `GET /analyses` — history (filters: `symbol`, `market`, `decision`, `dateFrom/To`, pagination, sort)
- `GET /analyses/:id` · `DELETE /analyses/:id` · `GET /analyses/stats`
- `GET /analyses/:id/export/pdf` · `GET /analyses/export/csv`
- `GET /users/plans` · `PATCH /users/profile` · `PATCH /users/password` · `POST /users/subscription`
- `GET /admin/stats` · `GET/PATCH/DELETE /admin/users` · `GET /admin/logs` · `GET /admin/ai-config`

## Testing

```bash
# Backend (Jest + in-memory MongoDB)
cd server && npm test

# Frontend (Vitest)
cd client && npm test
```

## Security Notes

- Passwords hashed with bcrypt; reset/verification tokens stored hashed.
- Helmet, CORS, NoSQL-injection sanitization, and rate limiting (global, auth, scan).
- Input validation with Joi on every mutating endpoint.
- File uploads restricted by MIME type and size.
- Admin routes gated by a role guard.

## Disclaimer

AI Chart Scanner is an educational and analytical tool. Nothing it produces is financial advice. Trade at your own risk.

## License

MIT
