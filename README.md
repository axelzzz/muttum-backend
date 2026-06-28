# Dictionary App - Backend

Node.js / Express / TypeScript / PostgreSQL backend for the Ionic dictionary application.

## Architecture

- **Shared cache**: the `words` table stores each word only once (shared across users).
- **Personal list**: the `user_words` table links each user to their own words (notes, tags, favorites, history).
- **Search flow**: cache → fallback to Wiktionary FR API → insert into cache → upsert into user list.

## Prerequisites

- Node.js 18+
- Docker (PostgreSQL runs in a container — no system installation required)

## Installation

```bash
npm install
cp .env.example .env
# edit .env (at minimum JWT_SECRET)
```

## Starting locally

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

Data is stored in a named Docker volume (`pgdata`) and persists across restarts. The schema (`src/db/schema.sql`) is applied automatically on first boot (empty volume only).

### 2. Start the server

```bash
npm start        # ts-node (no build step)
npm run dev      # watch mode with nodemon
```

The server listens on the port defined by `PORT` (default: 3000).

### Stopping PostgreSQL

```bash
docker compose down          # stops containers, data preserved
docker compose down -v       # stops containers and deletes volume (data lost)
```

## Endpoints

### Auth
- `POST /api/auth/register` → `{ email, username, password }` ⇒ `{ user, token }`
- `POST /api/auth/login` → `{ email, password }` ⇒ `{ user, token }`
- `GET /api/auth/me` (Bearer JWT) ⇒ `{ user }`

### Words (Bearer JWT required)
- `GET /api/words/search?word=xxx` → searches, caches, adds to the list
- `GET /api/words?page=1&limit=20&search=xxx` → paginated list of the user's words
- `GET /api/words/:id` → details of one entry
- `PATCH /api/words/:id` → updates notes / tags / favorite
- `DELETE /api/words/:id` → removes from the personal list

## API documentation & client generation

The OpenAPI 3.0 spec is served in development mode:

- **Swagger UI**: `http://localhost:3000/api-docs`
- **Raw JSON spec**: `http://localhost:3000/api-docs.json`

The JSON endpoint is consumed by [orval](https://orval.dev/) in the frontend project to auto-generate TypeScript models and Angular services. Whenever the contract changes, update the schemas in `src/config/swagger.ts` to reflect the actual response shape, then run the following from the frontend root:

```bash
npm run generate:api
```

This regenerates `src/app/core/api/` and keeps the static types in sync with the runtime responses.

> Keep `src/config/swagger.ts` honest: if a field is serialized as `id` in the JSON response, declare it as `id` in the schema — not `_id`. Silent mismatches between the spec and the actual payload are the main source of frontend type drift.

## Docker

The image runs the Express server on port 3000. PostgreSQL runs as a separate container in the same Compose stack.

**Run the full stack:**

```bash
docker compose up -d
```

**Environment variables (production):**

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | yes | — | Must be changed; startup fails if left as the dev default |
| `DATABASE_URL` | yes | `postgresql://localhost:5432/dictionary-app` | PostgreSQL connection string |
| `PORT` | no | `3000` | Listening port |
| `JWT_EXPIRES_IN` | no | `7d` | Token lifetime |
| `BCRYPT_SALT_ROUNDS` | no | `12` | Hashing cost factor |
| `CORS_ORIGIN` | no | `*` | Restrict to the frontend origin in production |
| `NODE_ENV` | no | `development` | Set to `production` to enable strict checks |

Key files:
- `Dockerfile` — single-stage Node 22 Alpine image, production deps only (`--omit=dev`)
- `docker-compose.yml` — PostgreSQL + backend services with healthcheck dependency
- `.dockerignore` — excludes `node_modules`, `tests/`
- `.env.example` — template for local development

## Tests

```bash
npm test                  # all tests
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
npm run test:coverage     # with coverage report
```

Tests use **pg-mem** (in-memory PostgreSQL) and **mock the Wiktionary API**: no network calls, no running database required.

### Test coverage

**Unit** (`tests/unit/`)
- `dictionaryService.test.ts`: wikitext parser, Wiktionary response parser, API error handling
- `userModel.test.ts`: bcrypt hash, validation, password comparison, JSON serialization
- `wordModel.test.ts`: Unicode/case normalization, uniqueness
- `wordService.test.ts`: cache scenarios, isolation between users, race conditions, errors
- `auth.test.ts`: JWT signing/verification, authentication middleware

**Integration** (`tests/integration/`)
- `auth.test.ts`: register, login, me, validation, conflicts
- `words.test.ts`: **key shared-cache scenario**, isolation, pagination, CRUD
- `smoke.test.ts`: healthcheck

## Structure

```
backend/
├── src/
│   ├── config/        configuration (env vars, Swagger spec)
│   ├── db/            pg Pool singleton + schema.sql
│   ├── types/         domain types (index.ts) + Express augmentation (express.d.ts)
│   ├── services/      dictionaryService, wordService
│   ├── controllers/   authController, wordController
│   ├── routes/        authRoutes, wordRoutes
│   ├── middlewares/   auth, validate, errorHandler
│   └── utils/         jwt, normalize
├── tests/
│   ├── fixtures/      test data (users, wiktionary responses)
│   ├── unit/
│   ├── integration/
│   └── setup.ts       pg-mem setup + pool injection
├── server.ts
└── .env.example
```
