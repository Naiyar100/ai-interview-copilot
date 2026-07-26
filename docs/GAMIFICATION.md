# Gamification system

Phase 15 extends the existing dashboard activity ledger rather than creating a second XP source.

## Progression

`level = floor(totalXp / 250) + 1`

XP is calculated from immutable, user-owned `UserActivity` records. `UserProgress` stores synchronized XP, level, streak, question, and practice totals.

## XP rules

| Event | XP |
| --- | ---: |
| Interview created | 10 |
| Question answered | 5 |
| Interview completed | 50 |
| Evaluation generated | 15 |
| Score of 80 or higher | 25 bonus |
| Daily goal completed | 30 |
| First resume | 50 |
| First voice interview | 40 |

Challenge XP is configured in `server/services/gamificationService.js`.

## Reward safety

Challenge claims are stored in `ChallengeClaim`. A unique index on `user + challengeKey + periodKey` prevents duplicate rewards, including concurrent requests. User data queries are scoped to the authenticated JWT owner. Claimed XP is added to the shared activity ledger.

Daily periods reset at 00:00 UTC. Weekly missions reset Monday at 00:00 UTC.

## Protected API

- `GET /api/gamification/profile`
- `GET /api/gamification/challenges`
- `POST /api/gamification/challenges/:challengeKey/claim`
- `GET /api/gamification/badges`
- `GET /api/gamification/history`
- `GET /api/gamification/leaderboard`

## Testing

Run `npm test` from the frontend directory and `npm test` from `server/`.
