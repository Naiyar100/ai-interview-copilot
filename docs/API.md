# API reference

Phase 12 analytics routes and schemas are documented in [ANALYTICS.md](ANALYTICS.md). All `/api/analytics/*` routes require a Bearer JWT.

Phase 13 Career Coach routes, SSE events, and payloads are documented in [COACH.md](COACH.md). All `/api/coach/*` routes require a Bearer JWT and enforce conversation ownership.

Base URL: `http://localhost:5000/api`

All responses use `{ "success": boolean, "message": string, "data": object }` on success and `{ "success": false, "message": string, "errors": [] }` on failure. Protected endpoints require `Authorization: Bearer <JWT>`.

## System

- `GET /health` — server status, MongoDB state, Gemini configuration state, uptime, memory usage, and timestamp.

## Authentication and users

- `POST /auth/register` — `{ name, email, password }`
- `POST /auth/login` — `{ email, password }`
- `GET /auth/me` — current authenticated user
- `GET /users/me` — safe profile fields
- `PUT /users/me` — `{ name, email }`

## Dashboard

- `GET /dashboard/summary` — owned interview totals, completion/evaluation metrics, role/difficulty statistics, duration, and recent reports.
- `GET /dashboard/overview?timezone=Asia/Calcutta` — consolidated Dashboard 2.0 response containing summary, goal, continue session, weekly progress, 12-week heatmap, recent interviews/activity, topic insights, coaching, XP, streaks, badges, calendar activity, resume state, and upcoming schedules.
- `GET /dashboard/goal?timezone=Asia/Calcutta` — persistent daily goal settings.
- `PUT /dashboard/goal` — `{ target, timezone }`; target must be 1–50 questions.
- `GET /dashboard/activity?limit=30` — sanitized activity timeline, maximum 100 events.
- `GET /dashboard/badges` — compact progress overview.

## Scheduled practice

- `GET /scheduled-interviews`
- `POST /scheduled-interviews` — `{ title, role, interviewType, difficulty, scheduledAt, notes?, reminderEnabled? }`
- `PUT /scheduled-interviews/:id` — partial schedule update.
- `DELETE /scheduled-interviews/:id` — safely marks the schedule cancelled.

Scheduled dates must be in the future. Every operation is JWT-protected and owner-scoped.

## Interviews

- `POST /interviews` — `{ role, experienceLevel, difficulty, interviewType, questionCount }`
- `GET /interviews` — query: `page`, `limit`, `difficulty`, `status`, `role`, `date`, `search`, `sortBy`, `sortOrder`
- `GET /interviews/:id`
- `PUT /interviews/:id` — incremental metadata, answers, transcripts, and voice metadata
- `PATCH /interviews/:id/complete`
- `DELETE /interviews/:id`
- `POST /interviews/:id/generate`
- `POST /interviews/:id/regenerate` — `{ confirmAnswerReset }` when answers exist
- `POST /interviews/:id/evaluate`
- `POST /interviews/:id/re-evaluate` — `{ mode: "keep" | "replace" }`
- `GET /interviews/:id/evaluations`
- `GET /interviews/:id/evaluations/:evaluationId`

Every interview query is scoped to the JWT user. Direct access to an existing document owned by another user returns `403`.

## Resumes

- `POST /resumes` — multipart form field `resume`; PDF only
- `GET /resumes`
- `GET /resumes/:id`
- `PATCH /resumes/:id/active`
- `DELETE /resumes/:id`

Stored file names, server paths, and raw extracted text are not returned. Resume access is owner-only.

## Common statuses

- `200/201` success
- `400` invalid request
- `401` missing/expired JWT
- `403` ownership or CORS denial
- `404` missing API resource
- `409` duplicate/conflicting operation
- `413/415/422` upload size/type/content failure
- `429` rate limit
- `502/503/504` AI provider or timeout failure
