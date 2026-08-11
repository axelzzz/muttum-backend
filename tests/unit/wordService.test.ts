import * as dictionaryService from '../../src/services/dictionaryService';

jest.mock('../../src/services/dictionaryService', () => {
  const actual = jest.requireActual('../../src/services/dictionaryService');
  return { ...actual, fetchDefinition: jest.fn() };
});

import * as wordService from '../../src/services/wordService';
import { getPool } from '../../src/db/pool';
import { createUser } from '../fixtures/users';
import type { Definition } from '../../src/types';

const mockedFetchDefinition = jest.mocked(dictionaryService.fetchDefinition);

const mockDefinitions: Definition[] = [
  { partOfSpeech: 'n.f.', definition: 'Capacité de découvrir par hasard.', example: null },
];

async function insertWord(word: string, source = 'wiktionary'): Promise<{ id: number }> {
  const pool = getPool();
  const res = await pool.query<{ id: number }>(
    'INSERT INTO words (word, source) VALUES ($1, $2) RETURNING id',
    [word, source]
  );
  return res.rows[0];
}

async function insertDefinitions(wordId: number, defs: Partial<Definition>[]): Promise<void> {
  const pool = getPool();
  for (let i = 0; i < defs.length; i++) {
    await pool.query(
      'INSERT INTO definitions (word_id, part_of_speech, definition, example, position) VALUES ($1, $2, $3, $4, $5)',
      [wordId, defs[i].partOfSpeech ?? '', defs[i].definition, defs[i].example ?? null, i]
    );
  }
}

async function insertUserWord(
  userId: number,
  wordId: number,
  overrides: { lastSearchedAt?: Date; searchCount?: number; favorite?: boolean } = {}
): Promise<{ id: number }> {
  const pool = getPool();
  const lastSearchedAt = overrides.lastSearchedAt ?? new Date();
  const res = await pool.query<{ id: number }>(
    `INSERT INTO user_words (user_id, word_id, last_searched_at, search_count, favorite)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, wordId, lastSearchedAt, overrides.searchCount ?? 1, overrides.favorite ?? false]
  );
  return res.rows[0];
}

async function countRows(table: string, whereUserId?: number): Promise<number> {
  const pool = getPool();
  if (whereUserId !== undefined) {
    const res = await pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = $1`, [whereUserId]);
    return parseInt(res.rows[0].n, 10);
  }
  const res = await pool.query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return parseInt(res.rows[0].n, 10);
}

describe('wordService.searchAndTrack', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches from API and caches when word is not in DB', async () => {
    mockedFetchDefinition.mockResolvedValue(mockDefinitions);
    const user = await createUser();

    const result = await wordService.searchAndTrack('Sérendipité', String(user.id));

    expect(result.fromCache).toBe(false);
    expect(result.alreadyInList).toBe(false);
    expect(result.word).toBe('sérendipité');
    expect(result.definitions).toEqual(mockDefinitions);
    expect(mockedFetchDefinition).toHaveBeenCalledTimes(1);

    expect(await countRows('words')).toBe(1);
    expect(await countRows('user_words', user.id)).toBe(1);
  });

  it('reads from cache when word is already in DB (does NOT call API)', async () => {
    const w = await insertWord('cache');
    await insertDefinitions(w.id, mockDefinitions);
    const user = await createUser();

    const result = await wordService.searchAndTrack('cache', String(user.id));

    expect(result.fromCache).toBe(true);
    expect(mockedFetchDefinition).not.toHaveBeenCalled();
  });

  it('adds word to user list automatically on first search', async () => {
    const w = await insertWord('auto');
    await insertDefinitions(w.id, mockDefinitions);
    const user = await createUser();

    expect(await countRows('user_words', user.id)).toBe(0);
    await wordService.searchAndTrack('auto', String(user.id));
    expect(await countRows('user_words', user.id)).toBe(1);
  });

  it('increments searchCount and updates lastSearchedAt on repeated search', async () => {
    const w = await insertWord('repeat');
    await insertDefinitions(w.id, mockDefinitions);
    const user = await createUser();

    const r1 = await wordService.searchAndTrack('repeat', String(user.id));
    expect(r1.alreadyInList).toBe(false);

    await new Promise((r) => setTimeout(r, 10));
    const r2 = await wordService.searchAndTrack('repeat', String(user.id));
    expect(r2.alreadyInList).toBe(true);

    const pool = getPool();
    const uw = (await pool.query('SELECT * FROM user_words WHERE user_id = $1', [user.id])).rows[0];
    expect(uw.search_count).toBe(2);
    expect(new Date(uw.last_searched_at).getTime()).toBeGreaterThanOrEqual(
      new Date(uw.first_searched_at).getTime()
    );
  });

  it('isolates words per user (two users searching same word get separate user_word rows)', async () => {
    mockedFetchDefinition.mockResolvedValue(mockDefinitions);
    const u1 = await createUser({ email: 'u1@x.com' });
    const u2 = await createUser({ email: 'u2@x.com' });

    await wordService.searchAndTrack('partage', String(u1.id));
    await wordService.searchAndTrack('partage', String(u2.id));

    expect(await countRows('words')).toBe(1);
    expect(await countRows('user_words', u1.id)).toBe(1);
    expect(await countRows('user_words', u2.id)).toBe(1);
    expect(mockedFetchDefinition).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when word not found in upstream API', async () => {
    mockedFetchDefinition.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'NOT_FOUND' })
    );
    const user = await createUser();
    await expect(wordService.searchAndTrack('xyzunknown', String(user.id))).rejects.toMatchObject({ status: 404 });
    expect(await countRows('words')).toBe(0);
    expect(await countRows('user_words')).toBe(0);
  });

  it('throws 502 when upstream API errors', async () => {
    mockedFetchDefinition.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'UPSTREAM_ERROR' })
    );
    const user = await createUser();
    await expect(wordService.searchAndTrack('any', String(user.id))).rejects.toMatchObject({ status: 502 });
  });

  it('throws 400 when word is empty', async () => {
    const user = await createUser();
    await expect(wordService.searchAndTrack('   ', String(user.id))).rejects.toMatchObject({ status: 400 });
  });

  it('normalizes word before storing (case + accents)', async () => {
    mockedFetchDefinition.mockResolvedValue(mockDefinitions);
    const user = await createUser();

    await wordService.searchAndTrack('  CAFÉ  ', String(user.id));
    const r = await wordService.searchAndTrack('café', String(user.id));

    expect(r.fromCache).toBe(true);
    expect(await countRows('words')).toBe(1);
  });
});

describe('wordService.listUserWords', () => {
  it('returns paginated list sorted by lastSearchedAt desc', async () => {
    const user = await createUser();
    const w1 = await insertWord('alpha');
    const w2 = await insertWord('beta');
    await insertDefinitions(w1.id, [{ definition: 'a' }]);
    await insertDefinitions(w2.id, [{ definition: 'b' }]);

    await insertUserWord(user.id, w1.id, { lastSearchedAt: new Date('2024-01-01') });
    await insertUserWord(user.id, w2.id, { lastSearchedAt: new Date('2024-02-01') });

    const r = await wordService.listUserWords(String(user.id));
    expect(r.items).toHaveLength(2);
    expect(r.items[0].word).toBe('beta');
    expect(r.items[1].word).toBe('alpha');
    expect(r.pagination.total).toBe(2);
  });

  it('filters by search term', async () => {
    const user = await createUser();
    const w1 = await insertWord('pomme');
    const w2 = await insertWord('poire');
    await insertDefinitions(w1.id, [{ definition: 'a' }]);
    await insertDefinitions(w2.id, [{ definition: 'b' }]);
    await insertUserWord(user.id, w1.id);
    await insertUserWord(user.id, w2.id);

    const r = await wordService.listUserWords(String(user.id), { search: 'pom' });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].word).toBe('pomme');
  });

  it('matches words regardless of accents in the search term', async () => {
    const user = await createUser();
    const w = await insertWord('élève');
    await insertDefinitions(w.id, [{ definition: 'a' }]);
    await insertUserWord(user.id, w.id);

    const r = await wordService.listUserWords(String(user.id), { search: 'eleve' });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].word).toBe('élève');
  });

  it('does not return words from another user', async () => {
    const u1 = await createUser({ email: 'u1@x.com' });
    const u2 = await createUser({ email: 'u2@x.com' });
    const w = await insertWord('priv');
    await insertDefinitions(w.id, [{ definition: 'x' }]);
    await insertUserWord(u2.id, w.id);

    const r = await wordService.listUserWords(String(u1.id));
    expect(r.items).toHaveLength(0);
  });

  it('filters by favorite', async () => {
    const user = await createUser();
    const w1 = await insertWord('pomme');
    const w2 = await insertWord('poire');
    await insertDefinitions(w1.id, [{ definition: 'a' }]);
    await insertDefinitions(w2.id, [{ definition: 'b' }]);
    await insertUserWord(user.id, w1.id, { favorite: true });
    await insertUserWord(user.id, w2.id, { favorite: false });

    const r = await wordService.listUserWords(String(user.id), { favorite: true });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].word).toBe('pomme');
    expect(r.items[0].favorite).toBe(true);
  });

  it('returns all words when favorite is not set', async () => {
    const user = await createUser();
    const w1 = await insertWord('pomme');
    const w2 = await insertWord('poire');
    await insertDefinitions(w1.id, [{ definition: 'a' }]);
    await insertDefinitions(w2.id, [{ definition: 'b' }]);
    await insertUserWord(user.id, w1.id, { favorite: true });
    await insertUserWord(user.id, w2.id, { favorite: false });

    const r = await wordService.listUserWords(String(user.id));
    expect(r.items).toHaveLength(2);
  });
});

describe('wordService.deleteUserWord', () => {
  it('removes user_word but keeps word in cache', async () => {
    const pool = getPool();
    const user = await createUser();
    const w = await insertWord('keep');
    const uw = await insertUserWord(user.id, w.id);

    await wordService.deleteUserWord(String(user.id), String(uw.id));

    const uwRes = await pool.query('SELECT id FROM user_words WHERE id = $1', [uw.id]);
    expect(uwRes.rows).toHaveLength(0);
    const wRes = await pool.query('SELECT id FROM words WHERE id = $1', [w.id]);
    expect(wRes.rows).toHaveLength(1);
  });

  it('throws 404 when user_word does not belong to caller', async () => {
    const u1 = await createUser({ email: 'u1@x.com' });
    const u2 = await createUser({ email: 'u2@x.com' });
    const w = await insertWord('x');
    const uw = await insertUserWord(u1.id, w.id);

    await expect(wordService.deleteUserWord(String(u2.id), String(uw.id))).rejects.toMatchObject({ status: 404 });
  });
});

describe('wordService.updateUserWord', () => {
  it('updates only allowed fields', async () => {
    const user = await createUser();
    const w = await insertWord('edit');
    await insertDefinitions(w.id, [{ definition: 'x' }]);
    const uw = await insertUserWord(user.id, w.id);

    const r = await wordService.updateUserWord(String(user.id), String(uw.id), {
      notes: 'my notes',
      tags: ['important'],
      favorite: true,
    });

    expect(r.notes).toBe('my notes');
    expect(r.tags).toEqual(['important']);
    expect(r.favorite).toBe(true);
    expect(r.searchCount).toBe(1);
  });
});
