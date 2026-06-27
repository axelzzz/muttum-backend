CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL    PRIMARY KEY,
  email         TEXT         NOT NULL UNIQUE,
  username      TEXT         NOT NULL,
  password_hash TEXT         NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS words (
  id         BIGSERIAL    PRIMARY KEY,
  word       TEXT         NOT NULL UNIQUE,
  source     TEXT         NOT NULL DEFAULT 'wiktionary',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_words_word ON words (word);

CREATE TABLE IF NOT EXISTS definitions (
  id             BIGSERIAL  PRIMARY KEY,
  word_id        BIGINT     NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  part_of_speech TEXT       NOT NULL DEFAULT '',
  definition     TEXT       NOT NULL,
  examples       TEXT[]     NOT NULL DEFAULT '{}',
  position       SMALLINT   NOT NULL,
  UNIQUE (word_id, position)
);

CREATE INDEX IF NOT EXISTS idx_definitions_word_id ON definitions (word_id);

CREATE TABLE IF NOT EXISTS user_words (
  id                BIGSERIAL    PRIMARY KEY,
  user_id           BIGINT       NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  word_id           BIGINT       NOT NULL REFERENCES words(id)  ON DELETE CASCADE,
  notes             TEXT         NOT NULL DEFAULT '',
  tags              TEXT[]       NOT NULL DEFAULT '{}',
  favorite          BOOLEAN      NOT NULL DEFAULT FALSE,
  first_searched_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_searched_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  search_count      INTEGER      NOT NULL DEFAULT 1,
  UNIQUE (user_id, word_id)
);

CREATE INDEX IF NOT EXISTS idx_user_words_user_id ON user_words (user_id);
