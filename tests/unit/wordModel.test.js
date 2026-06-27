const { normalizeWord } = require('../../src/utils/normalize');
const { getPool } = require('../../src/db/pool');

describe('normalizeWord', () => {
  it('lowercases', () => {
    expect(normalizeWord('SÉRENDIPITÉ')).toBe('sérendipité');
  });

  it('trims whitespace', () => {
    expect(normalizeWord('  bonjour  ')).toBe('bonjour');
  });

  it('normalizes Unicode to NFC', () => {
    const decomposed = 'é'; // é as two code points
    const composed = 'é';    // é as one code point
    expect(normalizeWord(decomposed)).toBe(composed);
  });

  it('returns empty string for non-string input', () => {
    expect(normalizeWord(null)).toBe('');
    expect(normalizeWord(undefined)).toBe('');
    expect(normalizeWord(123)).toBe('');
  });
});

describe('words table', () => {
  it('persists a word with its source', async () => {
    const pool = getPool();
    const res = await pool.query(
      "INSERT INTO words (word, source) VALUES ($1, 'wiktionary') RETURNING *",
      ['test']
    );
    expect(res.rows[0].id).toBeDefined();
    expect(res.rows[0].word).toBe('test');
    expect(res.rows[0].source).toBe('wiktionary');
  });

  it('enforces unique word', async () => {
    const pool = getPool();
    await pool.query("INSERT INTO words (word, source) VALUES ('unique', 'wiktionary')");
    await expect(
      pool.query("INSERT INTO words (word, source) VALUES ('unique', 'manual')")
    ).rejects.toThrow();
  });
});
