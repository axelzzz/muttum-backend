# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start with nodemon (auto-reload)
npm start            # Start without auto-reload

npm test             # All tests (unit + integration)
npm run test:unit    # Unit tests only (tests/unit/)
npm run test:integration  # Integration tests only (tests/integration/)
npm run test:coverage     # With coverage report
```

Run a single test file:
```bash
npx jest tests/unit/wordService.test.js --runInBand
```

Tests require no external services — `mongodb-memory-server` is used and Wiktionary API calls are mocked via Jest.

## Environment

Required `.env` variables (see `src/config/index.js`):
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret (required in production)
- `PORT` — default 3000
- `WIKTIONARY_BASE_URL` — default `https://fr.wiktionary.org/api/rest_v1/page/definition`
- `CORS_ORIGIN` — default `*`

## Architecture

The backend is a French dictionary app. The core design separates **shared word cache** from **per-user word lists**:

- `Word` — one document per unique word, shared across all users. Populated lazily on first search via the Wiktionary FR REST API.
- `UserWord` — join document linking a `userId` to a `wordId`, with per-user metadata (notes, tags, favorite, searchCount, timestamps). Unique compound index on `(userId, wordId)`.

### Search flow (`wordService.searchAndTrack`)

1. Normalize the word (`trim + lowercase + NFC`)
2. Look up `Word` collection (cache hit)
3. On miss: call `dictionaryService.fetchDefinition` → Wiktionary FR API
4. Insert into `Word` cache (handles race condition via duplicate key catch + re-fetch)
5. Upsert `UserWord` — creates on first search, increments `searchCount` on repeat

### Key files

- `src/app.js` — Express factory (`createApp`), mounts routes and middleware
- `src/services/wordService.js` — all word business logic (search, list, CRUD on user list)
- `src/services/dictionaryService.js` — Wiktionary API client + HTML parser; exports `DictionaryError` with codes `NOT_FOUND` / `UPSTREAM_ERROR`
- `src/middlewares/errorHandler.js` — converts `err.status` / Mongoose errors to HTTP responses; services attach `.status` to thrown errors to control response code

### Error handling convention

Services throw plain `Error` objects with a `.status` property (400, 404, 502). The global `errorHandler` middleware reads `err.status` and responds accordingly. Mongoose-specific errors (`ValidationError`, `CastError`, duplicate key `11000`) are also handled there.
