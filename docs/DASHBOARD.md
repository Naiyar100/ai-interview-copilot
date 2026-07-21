# Dashboard 2.0 architecture

## Data flow

`GET /api/dashboard/overview` is the consolidated authenticated read endpoint. The controller passes `req.user` to the dashboard service; the frontend never supplies a user ID. The service uses parallel owner-scoped queries, then composes compact derived widgets without returning raw resume text, AI prompts, answers, or private file metadata.

Interview, evaluation, and resume documents remain the analytics source of truth. Derived weekly/chart/topic values are not duplicated in MongoDB. Persistent state is limited to goals, activity/reward events, progress snapshots, earned badges, and scheduled sessions.

## Models

- `UserGoal`: one persistent question target and IANA timezone per user.
- `UserActivity`: unique `(user, eventKey)` activity/reward ledger.
- `UserProgress`: XP, level, streak, question, and practice-minute snapshot.
- `UserBadge`: unique `(user, badgeKey)` award.
- `ScheduledInterview`: owner-scoped internal practice schedule.

Mongoose creates these collections and indexes automatically. No manual migration or seed is required. Existing interviews and resumes are synchronized into stable activity event keys on the first dashboard request.

## XP and levels

XP rules are centralized on the backend:

- Interview created: 10 XP
- Question answered: 5 XP
- Interview completed: 50 XP
- Initial evaluation: 15 XP
- Score of 80 or higher: additional 25 XP
- Daily goal completed: 30 XP
- First resume uploaded: 50 XP
- First voice interview completed: 40 XP

Re-evaluation does not award repeat XP. Every reward uses a stable unique event key, so retries, refreshes, and historical synchronization cannot duplicate it. Each level requires 250 XP: `level = floor(XP / 250) + 1`.

## Daily goal and streak

The initial goal is five answered questions per local day. Users can select a target from 1–50. Progress is derived from question activity using the saved IANA timezone; the frontend never resets it. A completed day uses one date-keyed reward event regardless of later target changes.

Streaks use unique local activity dates. Activity today continues the current run; activity yesterday keeps a run alive until the user practices today. Multiple events on one date count as one streak day. `longestStreak` records the largest consecutive run.

## Badges

Current definitions:

- First Interview
- Five Interviews
- Ten Interviews
- First 80+ Score
- First 90+ Score
- Resume Ready
- Voice Interview
- Seven-Day Streak

Definitions live in the gamification service. Awards use a unique user/badge index, making repeated overview requests idempotent.

## Activity events

Current event types include interview creation, answered questions, interview completion, AI evaluation, resume upload, first voice completion, daily-goal completion, badge events, and scheduled practice creation. Controllers call the reusable activity service after core actions. Tracking failures are logged without normally breaking the completed user action.

## Topic and coach logic

Topic insights combine stored `expectedTopics`, evaluation study topics, and per-question scores. Topics below 75% are weak; topics at or above 75% are strong. Empty states are returned when there is insufficient evidence.

The coach is deterministic and cached implicitly by stored interview data. It does not call Gemini on dashboard loads. It selects the clearest weak topic and compares the two most recent evaluated interview scores when possible.

## Visualization and theme

The weekly chart, heatmap, progress rings, and calendar use lightweight semantic React and CSS. The chart includes an accessible data table and text/tooltips; no chart dependency was added.

`ThemeProvider` centralizes light, dark, and system preferences. The preference is stored locally because it is device UI state, not server-backed user data. An inline head script applies the resolved theme before React and CSS render, preventing a theme flash.

## Performance and limits

- Dashboard requests use one consolidated response and parallel primary queries.
- Recent schedules and visible activity are limited.
- Heatmap data is capped at 84 days.
- Interview projections omit raw resume text and unrelated fields.
- Route-level code splitting from Phase 10 remains active.
- Activity synchronization uses unordered bulk upserts and unique event keys.

For accounts with extremely large interview histories, a future analytics phase can move lifetime aggregates into incremental rollups. That expansion is intentionally outside Phase 11.
