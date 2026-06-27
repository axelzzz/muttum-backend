const { getPool } = require('../db/pool');
const dictionaryService = require('./dictionaryService');
const { normalizeWord } = require('../utils/normalize');

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function toInt(id) {
  return parseInt(id, 10);
}

function formatUserWord(uw, wordText, definitions) {
  return {
    id: String(uw.id),
    word: wordText,
    definitions,
    firstSearchedAt: uw.first_searched_at,
    lastSearchedAt: uw.last_searched_at,
    searchCount: uw.search_count,
    notes: uw.notes || '',
    tags: uw.tags || [],
    favorite: uw.favorite,
  };
}

function buildDefinitions(rows) {
  return rows.map((r) => ({
    partOfSpeech: r.part_of_speech || '',
    definition: r.definition,
    examples: r.examples || [],
  }));
}

async function getDefinitions(pool, wordId) {
  const res = await pool.query(
    'SELECT part_of_speech, definition, examples FROM definitions WHERE word_id = $1 ORDER BY position',
    [wordId]
  );
  return buildDefinitions(res.rows);
}

async function fetchFromDictionary(normalized) {
  try {
    return await dictionaryService.fetchDefinition(normalized);
  } catch (err) {
    if (err.code === 'NOT_FOUND') throw httpError(`Word "${normalized}" not found in dictionary`, 404);
    throw httpError('Dictionary service unavailable', 502);
  }
}

async function insertDefinitions(pool, wordId, definitions) {
  await Promise.all(
    definitions.map((def, i) =>
      pool.query(
        `INSERT INTO definitions (word_id, part_of_speech, definition, examples, position)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (word_id, position) DO NOTHING`,
        [wordId, def.partOfSpeech || '', def.definition, def.examples || [], i]
      )
    )
  );
}

async function fetchAndCacheWord(pool, normalized) {
  const definitions = await fetchFromDictionary(normalized);

  // ON CONFLICT ensures atomic upsert even under concurrent inserts for the same word
  const wordRes = await pool.query(
    `INSERT INTO words (word, source) VALUES ($1, 'wiktionary')
     ON CONFLICT (word) DO UPDATE SET source = EXCLUDED.source
     RETURNING id`,
    [normalized]
  );
  const wordId = wordRes.rows[0].id;

  await insertDefinitions(pool, wordId, definitions);
  return { wordId, fromCache: false };
}

async function resolveWord(pool, normalized) {
  const res = await pool.query('SELECT id FROM words WHERE word = $1', [normalized]);
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

async function trackSearch(pool, userId, wordId) {
  try {
    // search_count > 1 after upsert means the row pre-existed (alreadyInList = true)
    const res = await pool.query(
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
    const isFkViolation = err.code === '23503' || /foreign key/i.test(err.message || '');
    if (isFkViolation) throw httpError('Invalid or expired session', 401);
    throw err;
  }
}

async function searchAndTrack(rawWord, userId) {
  const normalized = normalizeWord(rawWord);
  if (!normalized) throw httpError('Word is required', 400);

  const pool = getPool();
  const numericUserId = toInt(userId);

  const { wordId, fromCache } = await resolveWord(pool, normalized);
  const { userWordId, alreadyInList } = await trackSearch(pool, numericUserId, wordId);

  const wordRow = (await pool.query('SELECT word, source FROM words WHERE id = $1', [wordId])).rows[0];
  const definitions = await getDefinitions(pool, wordId);

  return {
    id: String(userWordId),
    word: wordRow.word,
    wordId: String(wordId),
    definitions,
    source: wordRow.source,
    fromCache,
    alreadyInList,
  };
}

async function listUserWords(userId, { page = 1, limit = 20, search = '' } = {}) {
  const pool = getPool();
  const numericUserId = toInt(userId);
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_LIMIT));
  const offset = (safePage - 1) * safeLimit;
  const searchTerm = search || '';

  const [countRes, rowsRes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total
       FROM user_words uw JOIN words w ON w.id = uw.word_id
       WHERE uw.user_id = $1 AND ($2 = '' OR w.word ILIKE '%' || $2 || '%')`,
      [numericUserId, searchTerm]
    ),
    pool.query(
      `SELECT uw.id, uw.notes, uw.tags, uw.favorite,
              uw.first_searched_at, uw.last_searched_at, uw.search_count,
              w.id AS word_id, w.word
       FROM user_words uw JOIN words w ON w.id = uw.word_id
       WHERE uw.user_id = $1 AND ($2 = '' OR w.word ILIKE '%' || $2 || '%')
       ORDER BY uw.last_searched_at DESC
       LIMIT $3 OFFSET $4`,
      [numericUserId, searchTerm, safeLimit, offset]
    ),
  ]);

  const total = parseInt(countRes.rows[0].total, 10);
  // Parse to integers so pg-mem infers BIGINT[] instead of TEXT[] for ANY($1)
  const wordIds = rowsRes.rows.map((r) => parseInt(r.word_id, 10));

  const defsByWordId = {};
  if (wordIds.length > 0) {
    const placeholders = wordIds.map((_, i) => `$${i + 1}`).join(', ');
    const defRes = await pool.query(
      `SELECT word_id, part_of_speech, definition, examples FROM definitions WHERE word_id IN (${placeholders}) ORDER BY word_id, position`,
      wordIds
    );
    for (const row of defRes.rows) {
      const key = parseInt(row.word_id, 10);
      if (!defsByWordId[key]) defsByWordId[key] = [];
      defsByWordId[key].push({
        partOfSpeech: row.part_of_speech || '',
        definition: row.definition,
        examples: row.examples || [],
      });
    }
  }

  const items = rowsRes.rows.map((uw) =>
    formatUserWord(uw, uw.word, defsByWordId[parseInt(uw.word_id, 10)] || [])
  );

  return {
    items,
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

async function getUserWord(userId, userWordId) {
  const pool = getPool();
  const res = await pool.query(
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

async function updateUserWord(userId, userWordId, payload) {
  const pool = getPool();
  const sets = [];
  const values = [];

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
    values
  );

  if (res.rows.length === 0) throw httpError('Word not found in your list', 404);
  return getUserWord(userId, userWordId);
}

async function deleteUserWord(userId, userWordId) {
  const pool = getPool();
  const res = await pool.query(
    'DELETE FROM user_words WHERE id = $1 AND user_id = $2 RETURNING id',
    [toInt(userWordId), toInt(userId)]
  );

  if (res.rows.length === 0) throw httpError('Word not found in your list', 404);
  return { id: String(res.rows[0].id) };
}

module.exports = { searchAndTrack, listUserWords, getUserWord, updateUserWord, deleteUserWord };
