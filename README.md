# AI Interview Copilot — v1.0.0

AI Interview Copilot is a production-oriented interview-practice SaaS application. It combines private interview sessions, Gemini-generated questions and evaluations, resume-aware coaching, ATS analysis, analytics, voice practice, and gamification in one responsive React experience.

Phase 15 adds a database-backed gamification center with XP, levels, streaks, daily challenges, weekly missions, badges, reward history, and an internal leaderboard. See [docs/GAMIFICATION.md](docs/GAMIFICATION.md).

The Dashboard 2.0 workspace adds authenticated weekly progress, a 12-week heatmap, daily goals, streaks, XP, badges, topic insights, deterministic coaching recommendations, recent activity, and scheduled practice sessions. See [docs/DASHBOARD.md](docs/DASHBOARD.md).

Phase 12 adds a protected Analytics Center with global filters, previous-period KPI comparisons, performance trends, topic mastery, explainable readiness estimates, deterministic recommendations, interview comparison, saved views, and safe PDF/CSV/JSON exports. See [docs/ANALYTICS.md](docs/ANALYTICS.md).

Phase 13 adds a private AI Career Coach with streamed Gemini responses, grounded user context, searchable conversation history, pin/rename/delete controls, safe Markdown and code rendering, and responsive light/dark UI. See [docs/COACH.md](docs/COACH.md).

Phase 14 extends the private Resume Library with ATS and resume scores, target keyword analysis, missing skills, action-verb guidance, database-backed versions, comparison, grounded AI improvements, and PDF/CSV reports. See [docs/ATS_RESUME_REVIEWER.md](docs/ATS_RESUME_REVIEWER.md).

## Architecture

- Frontend: React 19, Vite, React Router, plain CSS
- Backend: Node.js, Express, ES Modules
- Database: MongoDB through Mongoose
- AI: Google Gemini, called only from the backend
- Tests: Vitest/React Testing Library and Jest/Supertest
- Dashboard visualization: lightweight accessible React/CSS charts with no additional chart runtime

The backend follows route → controller → model/service → database. Secrets and uploaded PDFs never pass through the frontend bundle or a public upload directory.

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB Community Server/Compass or MongoDB Atlas
- A Gemini API key for question generation, evaluation, resume analysis, and career coaching

## Installation

Install frontend and backend dependencies in separate terminals:

```powershell
cd "C:\AI Interview Capilot\AI Interview Project"
npm install
cd server
npm install
```

Create the environment files from the included examples, then insert your own values. Never commit `.env`.

Start MongoDB, then run:

```powershell
# Terminal 1
cd "C:\AI Interview Capilot\AI Interview Project\server"
npm run dev

# Terminal 2
cd "C:\AI Interview Capilot\AI Interview Project"
npm run dev
```

Open `http://localhost:5173`. The API defaults to `http://localhost:5000`.

## Environment variables

Backend variables are documented in [server/.env.example](server/.env.example). `CLIENT_URL` accepts a comma-separated allowlist. Production requires `NODE_ENV=production`, a JWT secret of at least 32 characters, Gemini, `STORAGE_PROVIDER=cloudinary`, and all three Cloudinary credentials.

Frontend variables are documented in [.env.example](.env.example). Only variables prefixed with `VITE_` are included in the browser bundle; never place secrets there.

## Testing

MongoDB must be running for backend integration tests. Tests use the separate database `ai_interview_copilot_test`, and clear only its collections.

```powershell
# Backend
cd server
npm test
npm run test:coverage

# Frontend
cd ..
npm test
npm run test:coverage

# Quality gates
npm run lint
npm run build
```

See [docs/TESTING.md](docs/TESTING.md) for the test matrix and manual checks.

## Security and operations

- Helmet security headers and disabled Express fingerprinting
- Exact CORS origin allowlist
- Global and authentication-specific rate limits
- JWT protection and per-document ownership checks
- Central request validation and NoSQL operator/key rejection
- JSON body and PDF size/type/integrity limits
- Structured JSON logging with credential/token redaction
- Consistent JSON errors without internal stack/provider details
- Graceful shutdown and bounded MongoDB connection pool

Health monitoring is available at `GET /health` and the compatible `GET /api/health`. See [docs/API.md](docs/API.md) for endpoint details.

## Production deployment

The repository includes [vercel.json](vercel.json) for the React SPA and [render.yaml](render.yaml) for the Express service. Production uses MongoDB Atlas and authenticated Cloudinary raw assets for private PDFs. Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for account setup, environment mapping, CORS, health checks, demo seeding, verification, and rollback.

`npm run build` creates an optimized frontend in `dist/` with route-level code splitting and fingerprinted assets. The public health endpoint is `GET /health`; `GET /api/health` remains compatible.

## Demo account

The idempotent seed creates three evaluated interviews, analytics/activity data, XP history, and a private resume with an ATS review:

```powershell
cd server
$env:DEMO_PASSWORD="choose-a-strong-demo-password"
npm run seed:demo
```

Configure `DEMO_EMAIL` and `DEMO_NAME` if desired, then sign in through the normal login page. Never commit or publish the demo password.

## Screenshots and recruiter demo

Capture public screenshots from the connected, seeded production environment so dashboards and storage-backed views are accurate and contain no developer credentials. Recommended views are `/dashboard`, `/interview/history`, `/resumes`, `/analytics`, `/coach`, and `/gamification`.

## Production checklist

- Verify registration, login, refresh, logout, and expired-token handling.
- Upload, preview, activate, compare, and delete a PDF.
- Create, generate, answer, complete, evaluate, and delete an interview.
- Confirm dashboard, analytics, activities, and rewards update.
- Verify coach streaming and chat ownership.
- Check light/dark themes, keyboard focus, reduced motion, and mobile portrait/landscape.
- Confirm cross-user resources return 403 and unapproved origins fail CORS.
- Confirm host logs and browser responses contain no secrets, raw prompts, or resume text.

## Roadmap

- HttpOnly refresh-token rotation
- Object-storage malware scanning
- Provider-independent AI and storage adapters
- Organization workspaces and recruiter-managed practice plans
- End-to-end browser automation in CI

## Contributing

Create a focused branch, preserve ES Modules and ownership rules, add tests, and run frontend tests/lint/build plus backend tests. Never commit `.env`, uploaded resumes, test databases, or credentials.

## License

Distributed under the ISC License. See [LICENSE](LICENSE).
