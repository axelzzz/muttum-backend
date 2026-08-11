import type { Pool } from 'pg';
import { getPool } from '../db/pool';
import { fetchDefinition } from './dictionaryService';
import { normalizeWord } from '../utils/normalize';
import type { Definition, SearchResult, UserWordDto, UserWordList } from '../types';

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

interface HttpError extends Error {
  status: number;
}

function httpError(message: string, status: number): HttpError {
  return Object.assign(new Error(message), { status }) as HttpError;
}

function toInt(id: string | number): number {
  return parseInt(String(id), 10);
}

function toBool(value: string | boolean | undefined): boolean {
  return value === true || value === 'true';
}

interface UserWordRow {
  id: number;
  notes: string | null;
  tags: string[] | null;
  favorite: boolean;
  first_searched_at: Date;
  last_searched_at: Date;
  search_count: number;
  word_id: number;
  word: string;
}

interface DefinitionRow {
  part_of_speech: string | null;
  definition: string;
  example: string | null;
}

function formatUserWord(uw: UserWordRow, wordText: string, definitions: Definition[]): UserWordDto {
  return {
    id: String(uw.id),
    word: wordText,
    definitions,
    firstSearchedAt: uw.first_searched_at,
    lastSearchedAt: uw.last_searched_at,
    searchCount: uw.search_count,
    notes: uw.notes ?? '',
    tags: uw.tags ?? [],
    favorite: uw.favorite,
  };
}

function buildDefinitions(rows: DefinitionRow[]): Definition[] {
  return rows.map((r) => ({
    partOfSpeech: r.part_of_speech ?? '',
    definition: r.definition,
    example: r.example ?? null,
  }));
}

async function getDefinitions(pool: Pool, wordId: number): Promise<Definition[]> {
  const res = await pool.query<DefinitionRow>(
    'SELECT part_of_speech, definition, example FROM definitions WHERE word_id = $1 ORDER BY position',
    [wordId]
  );
  return buildDefinitions(res.rows);
}

async function fetchFromDictionary(normalized: string): Promise<Definition[]> {
  try {
    return await fetchDefinition(normalized);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'NOT_FOUND') throw httpError(`Word "${normalized}" not found in dictionary`, 404);
    throw httpError('Dictionary service unavailable', 502);
  }
}

async function insertDefinitions(pool: Pool, wordId: number, definitions: Definition[]): Promise<void> {
  await Promise.all(
    definitions.map((def, i) =>
      pool.query(
        `INSERT INTO definitions (word_id, part_of_speech, definition, example, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (word_id, position) DO NOTHING`,
        [wordId, def.partOfSpeech || '', def.definition, def.example ?? null, i]
      )
    )
  );
}

async function fetchAndCacheWord(pool: Pool, normalized: string): Promise<{ wordId: number; fromCache: boolean }> {
  const definitions = await fetchFromDictionary(normalized);

  // ON CONFLICT ensures atomic upsert even under concurrent inserts for the same word
  const wordRes = await pool.query<{ id: number }>(
    `INSERT INTO words (word, source) VALUES ($1, 'wiktionary')
     ON CONFLICT (word) DO UPDATE SET source = EXCLUDED.source
     RETURNING id`,
    [normalized]
  );
  const wordId = wordRes.rows[0].id;

  await insertDefinitions(pool, wordId, definitions);
  return { wordId, fromCache: false };
}

async function resolveWord(pool: Pool, normalized: string): Promise<{ wordId: number; fromCache: boolean }> {
  const res = await pool.query<{ id: number }>('SELECT id FROM words WHERE word = $1', [normalized]);
  if (res.rows.length > 0) {
    const wordId = res.rows[0].id;
    // Backfill definitions for words cached before the definitions table existed
    const defCheck = await pool.query('SELECT 1 FROM definitions WHERE word_id = $1 LIMIT 1', [wordId]);
    if (defCheck.rows.length === 0) {
      const definitions = await fetchFromDictionary(normalized);
      await insertDefinitions(pool, wordId, definitions);
    }
    return { wordId, fromCache: true };
  }
  return fetchAndCacheWord(pool, normalized);
}

async function trackSearch(
  pool: Pool,
  userId: number,
  wordId: number
): Promise<{ userWordId: number; alreadyInList: boolean }> {
  try {
    // search_count > 1 after upsert means the row pre-existed (alreadyInList = true)
    const res = await pool.query<{ id: number; search_count: number }>(
      `INSERT INTO user_words (user_id, word_id, first_searched_at, last_searched_at, search_count)
       VALUES ($1, $2, now(), now(), 1)
       ON CONFLICT (user_id, word_id)
       DO UPDATE SET last_searched_at = now(), search_count = user_words.search_count + 1
       RETURNING id, search_count`,
      [userId, wordId]
    );
    const row = res.rows[0];
    return { userWordId: row.id, alreadyInList: row.search_count > 1 };
  } catch (err) {
    // word_id is already resolved at this point, so any FK violation must be on user_id
    const e = err as { code?: string; message?: string };
    const isFkViolation = e.code === '23503' || /foreign key/i.test(e.message ?? '');
    if (isFkViolation) throw httpError('Invalid or expired session', 401);
    throw err;
  }
}

export async function searchAndTrack(rawWord: string, userId: string): Promise<SearchResult> {
  const normalized = normalizeWord(rawWord);
  if (!normalized) throw httpError('Word is required', 400);

  const pool = getPool();
  const numericUserId = toInt(userId);

  const { wordId, fromCache } = await resolveWord(pool, normalized);
  const { userWordId, alreadyInList } = await trackSearch(pool, numericUserId, wordId);

  const wordRow = (await pool.query<{ word: string; source: string }>('SELECT word, source FROM words WHERE id = $1', [wordId])).rows[0];
  const definitions = await getDefinitions(pool, wordId);

  return {
    id: String(userWordId),
    word: wordRow.word,
    wordId: String(wordId),
    definitions,
    source: wordRow.source,
    fromCache,
    alreadyInList,
    firstSearchedAt: new Date(),
    lastSearchedAt: new Date(),
    searchCount: 1,
    notes: '',
    tags: [],
    favorite: false,
  };
}

interface ListOptions {
  page?: string | number;
  limit?: string | number;
  search?: string;
  favorite?: string | boolean;
}

export async function listUserWords(userId: string, options: ListOptions = {}): Promise<UserWordList> {
  const pool = getPool();
  const numericUserId = toInt(userId);
  const safePage = Math.max(1, parseInt(String(options.page ?? 1), 10) || 1);
  const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(String(options.limit ?? DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT));
  const offset = (safePage - 1) * safeLimit;
  const searchTerm = options.search ?? '';
  const favoriteOnly = toBool(options.favorite);

  const [countRes, rowsRes] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total
       FROM user_words uw JOIN words w ON w.id = uw.word_id
       WHERE uw.user_id = $1 AND ($2 = '' OR unaccent(w.word) ILIKE '%' || unaccent($2) || '%') AND ($3 = false OR uw.favorite = true)`,
      [numericUserId, searchTerm, favoriteOnly]
    ),
    pool.query<UserWordRow>(
      `SELECT uw.id, uw.notes, uw.tags, uw.favorite,
              uw.first_searched_at, uw.last_searched_at, uw.search_count,
              w.id AS word_id, w.word
       FROM user_words uw JOIN words w ON w.id = uw.word_id
       WHERE uw.user_id = $1 AND ($2 = '' OR unaccent(w.word) ILIKE '%' || unaccent($2) || '%') AND ($3 = false OR uw.favorite = true)
       ORDER BY uw.last_searched_at DESC
       LIMIT $4 OFFSET $5`,
      [numericUserId, searchTerm, favoriteOnly, safeLimit, offset]
    ),
  ]);

  const total = parseInt(countRes.rows[0].total, 10);
  // Parse to integers so pg-mem infers BIGINT[] instead of TEXT[] for ANY($1)
  const wordIds = rowsRes.rows.map((r) => parseInt(String(r.word_id), 10));

  const defsByWordId: Record<number, Definition[]> = {};
  if (wordIds.length > 0) {
    const placeholders = wordIds.map((_, i) => `$${i + 1}`).join(', ');
    const defRes = await pool.query<DefinitionRow & { word_id: number }>(
      `SELECT word_id, part_of_speech, definition, example FROM definitions WHERE word_id IN (${placeholders}) ORDER BY word_id, position`,
      wordIds
    );
    for (const row of defRes.rows) {
      const key = parseInt(String(row.word_id), 10);
      if (!defsByWordId[key]) defsByWordId[key] = [];
      defsByWordId[key].push({
        partOfSpeech: row.part_of_speech ?? '',
        definition: row.definition,
        example: row.example ?? null,
      });
    }
  }

  const items = rowsRes.rows.map((uw) =>
    formatUserWord(uw, uw.word, defsByWordId[parseInt(String(uw.word_id), 10)] ?? [])
  );

  return {
    items,
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

export async function getUserWord(userId: string, userWordId: string): Promise<UserWordDto> {
  const pool = getPool();
  const res = await pool.query<UserWordRow>(
    `SELECT uw.id, uw.notes, uw.tags, uw.favorite,
            uw.first_searched_at, uw.last_searched_at, uw.search_count,
            w.id AS word_id, w.word
     FROM user_words uw JOIN words w ON w.id = uw.word_id
     WHERE uw.id = $1 AND uw.user_id = $2`,
    [toInt(userWordId), toInt(userId)]
  );

  if (res.rows.length === 0) throw httpError('Word not found in your list', 404);

  const uw = res.rows[0];
  const definitions = await getDefinitions(pool, uw.word_id);
  return formatUserWord(uw, uw.word, definitions);
}

interface UpdatePayload {
  notes?: string;
  tags?: string[];
  favorite?: boolean;
}

export async function updateUserWord(userId: string, userWordId: string, payload: UpdatePayload): Promise<UserWordDto> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof payload.notes === 'string') sets.push(`notes = $${values.push(payload.notes)}`);
  if (Array.isArray(payload.tags)) sets.push(`tags = $${values.push(payload.tags)}`);
  if (typeof payload.favorite === 'boolean') sets.push(`favorite = $${values.push(payload.favorite)}`);

  if (sets.length === 0) return getUserWord(userId, userWordId);

  const idIdx = values.length + 1;
  const userIdIdx = values.length + 2;
  values.push(toInt(userWordId), toInt(userId));

  const res = await pool.query(
    `UPDATE user_words SET ${sets.join(', ')}
     WHERE id = $${idIdx} AND user_id = $${userIdIdx}
     RETURNING id`,
    values as unknown[]
  );

  if (res.rows.length === 0) throw httpError('Word not found in your list', 404);
  return getUserWord(userId, userWordId);
}

export async function deleteUserWord(userId: string, userWordId: string): Promise<{ id: string }> {
  const pool = getPool();
  const res = await pool.query<{ id: number }>(
    'DELETE FROM user_words WHERE id = $1 AND user_id = $2 RETURNING id',
    [toInt(userWordId), toInt(userId)]
  );

  if (res.rows.length === 0) throw httpError('Word not found in your list', 404);
  return { id: String(res.rows[0].id) };
}
