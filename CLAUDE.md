# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start with nodemon (auto-reload)
npm start            # Start without auto-reload (ts-node)

npm test             # All tests (unit + integration)
npm run test:unit    # Unit tests only (tests/unit/)
npm run test:integration  # Integration tests only (tests/integration/)
npm run test:coverage     # With coverage report
```

Run a single test file:
```bash
npx jest tests/unit/wordService.test.ts --runInBand
```

Tests require no external services — `pg-mem` is used as an in-memory PostgreSQL and Wiktionary API calls are mocked via Jest.

## Environment

Required `.env` variables (see `src/config/index.ts`):
- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgresql://muttum:muttum@localhost:5432/dictionary-app`)
- `JWT_SECRET` — JWT signing secret (required in production)
- `PORT` — default 3000
- `JWT_EXPIRES_IN` — default `7d`
- `BCRYPT_SALT_ROUNDS` — default `12`
- `WIKTIONARY_BASE_URL` — default `https://fr.wiktionary.org`
- `CORS_ORIGIN` — default `*`

For local development, PostgreSQL runs in Docker:
```bash
docker compose up -d postgres
```

## Architecture

The backend is a French dictionary app. The core design separates **shared word cache** from **per-user word lists**:

- `words` table — one row per unique word, shared across all users. Populated lazily on first search via the Wiktionary FR REST API.
- `user_words` table — join row linking a `user_id` to a `word_id`, with per-user metadata (notes, tags, favorite, search_count, timestamps). Unique compound index on `(user_id, word_id)`.

Domain types live in `src/types/index.ts` (`Definition`, `UserWordDto`, `SearchResult`, etc.). The Express `Request` is augmented with `userId: string` in `src/types/express.d.ts`.

### Search flow (`wordService.searchAndTrack`)

1. Normalize the word (`trim + lowercase + NFC`)
2. Look up `words` table (cache hit)
3. On miss: call `dictionaryService.fetchDefinition` → Wiktionary FR API
4. Insert into `words` table (handles race condition via `ON CONFLICT DO NOTHING` + re-fetch)
5. Upsert `user_words` — creates on first search, increments `search_count` on repeat

### Key files

- `src/app.ts` — Express factory (`createApp`), mounts routes and middleware
- `src/db/pool.ts` — `pg.Pool` singleton; `setPool` lets tests inject an in-memory pool
- `src/services/wordService.ts` — all word business logic (search, list, CRUD on user list)
- `src/services/dictionaryService.ts` — Wiktionary API client + wikitext parser; exports `DictionaryError` with codes `NOT_FOUND` / `UPSTREAM_ERROR`
- `src/types/index.ts` — shared domain types and `DictionaryErrorCode` union
- `src/middlewares/errorHandler.ts` — maps `err.status` and PostgreSQL error codes to HTTP responses

### Error handling convention

Services throw plain `Error` objects with a `.status` property (400, 404, 502). The global `errorHandler` middleware reads `err.status` and responds accordingly. PostgreSQL-specific errors are also handled there by `code` (`23505` duplicate, `23503` foreign key, `23502`/`23514` constraint violations).
