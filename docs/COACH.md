# AI Career Coach (Phase 13)

The Career Coach is a protected, user-owned chat workspace at `/coach`. It streams Gemini responses while grounding personalized claims in the signed-in user's active resume summary, interview history, evaluation history, analytics, strong topics, weak topics, and inferred target role. When a source is absent, the coach says that it lacks the data instead of inventing it.

## Architecture

1. `coachRoutes` authenticates every request and rate-limits generation.
2. `coachController` validates chat input, enforces ownership, and writes Server-Sent Events (SSE).
3. `contextBuilder` reads bounded, safe, user-owned context. Raw resume text and file paths are not used.
4. `promptBuilder` creates the private system instruction and normalized conversation contents.
5. `coachService` calls Gemini from the backend and forwards text chunks.
6. `historyService` stores, lists, searches, renames, pins, and deletes conversations.

The frontend consumes SSE with `fetch()` and `ReadableStream`, renders Markdown as React elements without raw HTML, highlights common code tokens, and supports copy/regenerate controls. Chat history becomes an off-canvas sidebar below 850px.

## API

All routes require `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/coach/chat` | Stream a new or regenerated response as SSE |
| `GET` | `/api/coach/chats?search=` | List/search the user's chats, pinned first |
| `POST` | `/api/coach/chats` | Create an empty chat with an optional title |
| `GET` | `/api/coach/chats/:id` | Load one owned chat |
| `PATCH` | `/api/coach/chats/:id` | Rename and/or pin an owned chat |
| `DELETE` | `/api/coach/chats/:id` | Delete an owned chat |

New message body:

```json
{ "message": "Create a 30-day practice plan", "chatId": "optional-chat-id" }
```

Regeneration body:

```json
{ "chatId": "required-chat-id", "regenerate": true }
```

The stream emits `meta`, one or more `chunk`, and `done` events. A provider failure after streaming starts emits `error`. Chats hold at most 100 messages; prompts hold at most 4,000 characters.

## Manual testing

1. Start MongoDB, the backend, and the Vite frontend, then log in.
2. Open **Coach** from Dashboard or Analytics and select a suggested prompt.
3. Send it and verify text appears progressively, then refresh and reload the saved chat.
4. Search by title/message text; rename, pin, unpin, and delete a chat.
5. Copy a response and regenerate its last assistant answer.
6. Switch Light/Dark/System and check both the Coach and Analytics pages.
7. Resize below 850px and confirm the chat sidebar opens from the menu and typing remains available.
8. Log in as another user and confirm the first user's chat IDs return `403`.

## Known limitations

- Streaming depends on browser `ReadableStream` support and an available Gemini model/quota.
- Search is MongoDB regular-expression search over up to 100 recent conversations, not full-text/vector search.
- Target role is inferred from the user's most-practiced role because a separate target-role preference is not stored yet.
- The custom Markdown renderer intentionally supports a safe subset and does not render raw HTML or complex tables.
