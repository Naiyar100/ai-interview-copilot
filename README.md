# AI Interview Copilot

AI Interview Copilot is a React and Express application for private, AI-assisted interview practice. It supports JWT authentication, MongoDB-backed interview history, Gemini-generated questions and evaluations, PDF resume analysis, and browser voice interviews.

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

Backend variables are documented in [server/.env.example](server/.env.example). `CLIENT_URL` accepts a comma-separated allowlist. Production should use a long random `JWT_SECRET`, an HTTPS frontend origin, and `NODE_ENV=production`.

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

Health monitoring is available at `GET /api/health`. See [docs/API.md](docs/API.md) for endpoint details.

## Production build

`npm run build` creates the optimized frontend in `dist/`, including route-level code splitting. Deployment is intentionally outside Phase 10.
