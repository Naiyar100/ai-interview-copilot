# Analytics Center (Phase 12)

The protected `/analytics` route turns the authenticated user's interview, evaluation, resume, voice, activity, goal, XP, and badge records into deterministic performance intelligence. It never accepts a `userId`, calls Gemini on page load, or returns raw resume text, prompts, tokens, transcripts, file paths, or credentials.

## Architecture and endpoints

- `GET /api/analytics/overview` is the consolidated initial-load endpoint.
- `POST /api/analytics/compare` compares 2–4 owned interviews on demand.
- `POST /api/analytics/export` creates PDF, CSV, or JSON and is limited to 10 requests per 15 minutes outside tests.
- `GET|POST /api/analytics/views` and `PUT|DELETE /api/analytics/views/:id` provide owned saved-view CRUD with a 10-view limit.
- The frontend reuses the authenticated API client, debounces filters by 280 ms, aborts stale requests, preserves prior results while refreshing, and lazy-loads the route.
- Charts reuse Phase 11's dependency-free SVG/CSS approach.

## Query parameters and response

`preset` accepts `7d`, `30d`, `90d`, `6m`, `12m`, `all`, or `custom`. Custom ranges require `startDate` and `endDate` in `YYYY-MM-DD` format. Other parameters are `timezone`, `role`, `interviewType`, `difficulty`, `status`, `category`, `resumeId`, `voiceMode`, `scoreMin`, `scoreMax`, and `aggregation` (`day`, `week`, or `month`).

Values are allow-listed, bounded, sanitized, and combined with the authenticated user in every MongoDB predicate. Local-midnight boundaries and grouping use the selected IANA timezone. Future-only and reversed ranges are rejected.

The overview contains `range`, normalized `filters`, `summary`, `narrative`, trends, skill radar, topic mastery and heatmap, strengths/weaknesses, difficulty/type analyses, answer quality, practice time, voice, resume, consistency, role/company readiness, goals, XP/badges, recommendations, data-availability flags, cache metadata, and `generatedAt`.

Unavailable evidence is `null` and explained. The current evaluation schema does not store independent communication, clarity, completeness, or problem-solving scores, so they are not fabricated. Resume scoring is explicitly a deterministic readiness score, not an ATS or hiring score.

## Calculation rules

### Previous period

Finite ranges compare with the immediately preceding range of equal inclusive length. All-time views have no previous comparison. Percentage change is omitted when the previous value is zero.

### Topic mastery and confidence

Topics use structured question category, expected topics, and evaluation `topicsToStudy`. Scores use the latest evaluation and per-question score × 10.

- Beginner: fewer than two attempts or below 40
- Developing: 40–59
- Competent: 60–74
- Strong: 75–89, or 90+ with fewer than five attempts
- Mastered: 90+ with at least five attempts

Confidence is Low for 1–2 attempts, Medium for 3–7, and High for 8+. One answer can never produce Mastered.

### Consistency

- Active-day rate: 40%
- Daily-goal completion: 30%
- Session-spacing consistency: 20%
- Current-streak factor, capped at seven days: 10%

Only meaningful activity types count. Dates use the user's timezone.

### Role readiness

Weights are interview score 30%, topic coverage 20%, difficulty exposure 15%, communication 10%, consistency 10%, resume relevance 10%, and recency 5%. Missing factors are excluded and available weights normalized. Evidence count controls confidence.

Labels: Getting Started (<35), Building Foundation (35–54), Nearly Ready (55–69), Interview Ready (70–84), and Strong Candidate (85+). The UI states: “Readiness is an estimate based on your practice data, not a hiring prediction.”

### Company preparation

Google, Amazon, Microsoft, Adobe, Meta, Atlassian, Flipkart, Oracle, and Salesforce profiles live in `server/config/companyPreparationProfiles.js`. They weight available technical, problem-solving, system-design, communication, behavioral, and project evidence, plus 10% consistency. They are preparation estimates, not hiring probabilities.

### Resume readiness

The score uses 70% section completeness across skills, education, experience, projects, certifications, and technologies, plus 30% unique keyword coverage capped at 20 keywords. Stored versions can be compared without exposing extracted text.

## Caching and saved views

Overview results use a process-local 60-second cache keyed by schema version, user ID, normalized range, filters, timezone, and aggregation. Entries are capped and isolated per user. Interview, evaluation, resume, activity, and goal mutations invalidate that user's entries. Redis is not required.

Users can create, apply, rename, and delete up to 10 owned views. Names are sanitized, limited to 60 characters, and unique per user. Filters are revalidated.

## Exports

PDF includes user, range, filters, core metrics, topic/readiness summaries, recommendations, timestamp, and disclaimer. CSV includes summary, topics, and recommendations. JSON contains the safe response. Raw resume text, transcripts, internal paths, prompts, tokens, and secrets are excluded.

## Indexes

Phase 12 adds Interview indexes for `user + status + completedAt` and `user + role + completedAt`, plus AnalyticsSavedView indexes for `user + createdAt` and unique `user + name`. Existing user/date, type/date, score, evaluation-date, resume, badge, and activity indexes are reused. Mongoose creates these indexes during normal startup; no data migration or seed is required.

## Testing

```powershell
cd "C:\AI Interview Capilot\AI Interview Project"
npm run lint
npm test
npm run build
cd server
npm test
```

Manual test: sign in, open `/analytics`, try every preset and a custom range, combine and clear filters, refresh, save/rename/apply/delete a view, compare two interviews, export PDF/CSV, toggle theme, and test desktop/tablet/mobile widths. Repeat with a new account, an account without evaluations, and an active account with voice and resume history.

## Known limitations

- Cache is per process; multi-instance deployment should use a shared invalidation-aware cache.
- Historical daily-goal targets are not stored, so goal analytics use recorded completion events and the current target.
- Separate communication/clarity/problem-solving scores need a future evaluation-schema migration.
- Resume readiness is not an ATS score because Phase 7 stores extracted structure rather than ATS scoring history.
- Raw audio is not stored; voice analytics use transcripts and metadata only.
