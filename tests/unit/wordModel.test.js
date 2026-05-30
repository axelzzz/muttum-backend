const Word = require('../../src/models/Word');

describe('Word model', () => {
  describe('static normalize', () => {
    it('lowercases', () => {
      expect(Word.normalize('SÉRENDIPITÉ')).toBe('sérendipité');
    });

    it('trims', () => {
      expect(Word.normalize('  bonjour  ')).toBe('bonjour');
    });

    it('normalizes Unicode (NFC)', () => {
      const decomposed = 'e\u0301'; // é decomposed
      const composed = 'é';         // é composed
      expect(Word.normalize(decomposed)).toBe(composed);
    });

    it('returns empty string for non-string', () => {
      expect(Word.normalize(null)).toBe('');
      expect(Word.normalize(undefined)).toBe('');
      expect(Word.normalize(123)).toBe('');
    });
  });

  it('persists with definitions', async () => {
    const w = await Word.create({
      word: 'test',
      definitions: [{ partOfSpeech: 'n.m.', definition: 'A trial.', examples: [] }],
    });
    expect(w._id).toBeDefined();
    expect(w.word).toBe('test');
    expect(w.definitions).toHaveLength(1);
  });

  it('enforces unique word', async () => {
    await Word.create({ word: 'unique', definitions: [{ definition: 'd' }] });
    await expect(
      Word.create({ word: 'unique', definitions: [{ definition: 'd2' }] })
    ).rejects.toThrow();
  });

  it('lowercases the word at save time', async () => {
    const w = await Word.create({
      word: 'BONJOUR',
      definitions: [{ definition: 'hello' }],
    });
    expect(w.word).toBe('bonjour');
  });
});
