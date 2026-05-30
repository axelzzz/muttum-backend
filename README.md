# Dictionary App - Backend

Backend Node.js / Express / MongoDB pour l'application Ionic de dictionnaire.

## Architecture

- **Cache mutualisé** : la collection `words` stocke chaque mot une seule fois (partagé entre utilisateurs).
- **Liste personnelle** : la collection `userWords` lie chaque utilisateur à ses mots (notes, tags, favoris, historique).
- **Flux de recherche** : cache → fallback API Wiktionary FR → insertion en cache → upsert dans la liste utilisateur.

## Prérequis

- Node.js 18+
- MongoDB local OU Atlas (pour le dev/prod). Les tests utilisent `mongodb-memory-server` (aucune installation requise).

## Installation

```bash
npm install
cp .env.example .env
# éditer .env (au minimum JWT_SECRET et MONGODB_URI)
npm run dev
```

## Endpoints

### Auth
- `POST /api/auth/register` → `{ email, username, password }` ⇒ `{ user, token }`
- `POST /api/auth/login` → `{ email, password }` ⇒ `{ user, token }`
- `GET /api/auth/me` (Bearer JWT) ⇒ `{ user }`

### Mots (Bearer JWT obligatoire)
- `GET /api/words/search?word=xxx` → cherche, cache, ajoute à la liste
- `GET /api/words?page=1&limit=20&search=xxx` → liste paginée des mots de l'utilisateur
- `GET /api/words/:id` → détail d'une entrée
- `PATCH /api/words/:id` → met à jour notes / tags / favorite
- `DELETE /api/words/:id` → retire de la liste personnelle

## Tests

```bash
npm test                  # tous les tests
npm run test:unit         # uniquement unitaires
npm run test:integration  # uniquement intégration
npm run test:coverage     # avec rapport de couverture
```

Les tests utilisent **MongoDB en mémoire** (mongodb-memory-server) et **mockent l'API Wiktionary** : aucun appel réseau, aucune installation MongoDB requise.

### Couverture des tests

**Unitaires** (`tests/unit/`)
- `dictionaryService.test.js` : parser HTML, parser réponse Wiktionary, gestion erreurs API
- `userModel.test.js` : hash bcrypt, validation, comparaison password, sérialisation JSON
- `wordModel.test.js` : normalisation Unicode/case, unicité
- `wordService.test.js` : scénario cache, isolation entre utilisateurs, race conditions, errors
- `auth.test.js` : signature/vérification JWT, middleware d'authentification

**Intégration** (`tests/integration/`)
- `auth.test.js` : register, login, me, validation, conflits
- `words.test.js` : **scénario clé du cache mutualisé**, isolation, pagination, CRUD
- `smoke.test.js` : healthcheck

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
│   ├── fixtures/      données de test (users, wiktionary)
│   ├── unit/
│   ├── integration/
│   └── setup.js       MongoMemoryServer + nettoyage
├── server.js
└── .env.example
```
