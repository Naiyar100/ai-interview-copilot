# Testing guide

Phase 12 adds backend coverage for analytics authorization, empty data, score/median/topic/trend calculations, filters, comparison ownership, saved views, and PDF export. Frontend coverage includes loading, no-data behavior, overview rendering, readiness disclaimers, and filter controls. See [ANALYTICS.md](ANALYTICS.md#testing).

## Automated coverage matrix

Backend Jest/Supertest integration tests cover registration, login, safe user output, JWT protection, validation, NoSQL injection rejection, security headers, CORS, health monitoring, interview CRUD, ownership, pagination, filters, search, sorting, voice transcript persistence, AI generation, AI evaluation, duplicate evaluation prevention, provider failure mapping, resume listing, resume ownership, and invalid uploads.

Phase 11 tests additionally cover empty/active dashboard overviews, interview/score/topic aggregation, weekly and heatmap shapes, continue-interview selection, timezone-aware goals, streak/XP/badge idempotency, activity synchronization, scheduled interview CRUD, schedule validation, and cross-user schedule ownership.

Frontend Vitest/React Testing Library tests cover login, signup validation, protected/loading routes, dashboard loading/data/error states, interview creation and AI generation flow, resume upload, report rendering, centralized expired-token handling, voice support detection, and live transcription.

Dashboard 2.0 tests cover premium widgets, independent empty states, retry behavior, continue navigation, daily-goal updates, recent interview deletion, theme switching/persistence, chart empty states, and authenticated rendering.

## Run tests

Start local MongoDB before the backend suite. The suite uses only `ai_interview_copilot_test`.

```powershell
cd server
npm test
npm run test:coverage

cd ..
npm test
npm run test:coverage
npm run lint
npm run build
```

AI calls are mocked in automated tests; they do not spend Gemini quota. Browser speech APIs are also mocked.

## Manual smoke test

1. Start MongoDB, backend, and frontend.
2. Open `GET http://localhost:5000/api/health` and confirm `status: ok` and `database: connected`.
3. Register, log out, and log in again.
4. Confirm an unauthenticated request to `/api/interviews` returns `401`.
5. Create two users and confirm neither can fetch the other's interview or resume IDs.
6. Create an interview, generate questions, save typed and voice transcripts, refresh, and resume.
7. Complete and evaluate it; confirm dashboard/report history updates.
8. Upload a valid PDF and reject a non-PDF and oversized PDF.
9. Verify an unlisted browser origin is rejected by CORS.
10. Review structured backend logs and confirm passwords, JWTs, and API keys do not appear.

## Known testing limits

- Web Speech behavior still requires manual Chrome/Edge device testing because browser speech services and microphone permissions cannot be fully simulated in jsdom.
- Gemini correctness and quota behavior require a controlled staging smoke test; automated suites validate response handling using deterministic mocks.
- Backend integration tests require a reachable local MongoDB instance.
