# Dictionary App - Backend

Node.js / Express / MongoDB backend for the Ionic dictionary application.

## Architecture

- **Shared cache**: the `words` collection stores each word only once (shared across users).
- **Personal list**: the `userWords` collection links each user to their own words (notes, tags, favorites, history).
- **Search flow**: cache → fallback to Wiktionary FR API → insert into cache → upsert into user list.

## Prerequisites

- Node.js 18+
- MongoDB local OR Atlas (for dev/prod). Tests use `mongodb-memory-server` (no installation required).

## Installation

```bash
npm install
cp .env.example .env
# edit .env (at minimum JWT_SECRET and MONGODB_URI)
```

## Starting locally

### 1. Start MongoDB

```bash
mkdir -p /tmp/mongodb-data
mongod --dbpath /tmp/mongodb-data --logpath /tmp/mongod.log --fork
```

This forks MongoDB in the background, storing data in `/tmp/mongodb-data`. Make sure `MONGODB_URI` in `.env` points to `mongodb://localhost:27017/<dbname>`.

### 2. Start the server

```bash
npm start        # production-style (no auto-reload)
npm run dev      # development mode with nodemon
```

The server listens on the port defined by `PORT` (default: 3000). A successful startup prints:

```
✓ MongoDB connected
✓ Server listening on port 3000 (development)
```

### Stopping MongoDB

```bash
mongod --dbpath /tmp/mongodb-data --shutdown
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

## Tests

```bash
npm test                  # all tests
npm run test:unit         # unit tests only
npm run test:integration  # integration tests only
npm run test:coverage     # with coverage report
```

Tests use **in-memory MongoDB** (mongodb-memory-server) and **mock the Wiktionary API**: no network calls, no MongoDB installation required.

### Test coverage

**Unit** (`tests/unit/`)
- `dictionaryService.test.js`: HTML parser, Wiktionary response parser, API error handling
- `userModel.test.js`: bcrypt hash, validation, password comparison, JSON serialization
- `wordModel.test.js`: Unicode/case normalization, uniqueness
- `wordService.test.js`: cache scenarios, isolation between users, race conditions, errors
- `auth.test.js`: JWT signing/verification, authentication middleware

**Integration** (`tests/integration/`)
- `auth.test.js`: register, login, me, validation, conflicts
- `words.test.js`: **key shared-cache scenario**, isolation, pagination, CRUD
- `smoke.test.js`: healthcheck

## Structure

```
backend/
├── src/
│   ├── config/        configuration (env, DB)
│   ├── models/        User, Word, UserWord
│   ├── services/      dictionaryService, wordService
│   ├── controllers/   authController, wordController
│   ├── routes/        authRoutes, wordRoutes
│   ├── middlewares/   auth, validate, errorHandler
│   ├── utils/         jwt
│   └── app.js
├── tests/
│   ├── fixtures/      test data (users, wiktionary)
│   ├── unit/
│   ├── integration/
│   └── setup.js       MongoMemoryServer + cleanup
├── server.js
└── .env.example
```
