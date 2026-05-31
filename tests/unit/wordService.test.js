jest.mock('../../src/services/dictionaryService', () => {
  const actual = jest.requireActual('../../src/services/dictionaryService');
  return {
    ...actual,
    fetchDefinition: jest.fn(),
  };
});

const wordService = require('../../src/services/wordService');
const dictionaryService = require('../../src/services/dictionaryService');
const Word = require('../../src/models/Word');
const UserWord = require('../../src/models/UserWord');
const { createUser } = require('../fixtures/users');

const mockDefinitions = [
  { partOfSpeech: 'n.f.', definition: 'Capacité de découvrir par hasard.', examples: [] },
];

describe('wordService.searchAndTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches from API and caches when word is not in DB', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(mockDefinitions);
    const user = await createUser();

    const result = await wordService.searchAndTrack('Sérendipité', user._id);

    expect(result.fromCache).toBe(false);
    expect(result.alreadyInList).toBe(false);
    expect(result.word).toBe('sérendipité');
    expect(result.definitions).toEqual(mockDefinitions);
    expect(dictionaryService.fetchDefinition).toHaveBeenCalledTimes(1);

    const inDb = await Word.findOne({ word: 'sérendipité' });
    expect(inDb).not.toBeNull();

    const userWord = await UserWord.findOne({ userId: user._id });
    expect(userWord).not.toBeNull();
    expect(userWord.searchCount).toBe(1);
  });

  it('reads from cache when word is already in DB (does NOT call API)', async () => {
    await Word.create({ word: 'cache', definitions: mockDefinitions });
    const user = await createUser();

    const result = await wordService.searchAndTrack('cache', user._id);

    expect(result.fromCache).toBe(true);
    expect(dictionaryService.fetchDefinition).not.toHaveBeenCalled();
  });

  it('adds word to user list automatically on first search', async () => {
    await Word.create({ word: 'auto', definitions: mockDefinitions });
    const user = await createUser();

    expect(await UserWord.countDocuments({ userId: user._id })).toBe(0);
    await wordService.searchAndTrack('auto', user._id);
    expect(await UserWord.countDocuments({ userId: user._id })).toBe(1);
  });

  it('increments searchCount and updates lastSearchedAt on repeated search', async () => {
    await Word.create({ word: 'repeat', definitions: mockDefinitions });
    const user = await createUser();

    const r1 = await wordService.searchAndTrack('repeat', user._id);
    expect(r1.alreadyInList).toBe(false);

    await new Promise((r) => setTimeout(r, 10));
    const r2 = await wordService.searchAndTrack('repeat', user._id);
    expect(r2.alreadyInList).toBe(true);

    const uw = await UserWord.findOne({ userId: user._id });
    expect(uw.searchCount).toBe(2);
    expect(uw.lastSearchedAt.getTime()).toBeGreaterThan(uw.firstSearchedAt.getTime());
  });

  it('isolates words per user (two users searching same word get separate UserWord entries)', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(mockDefinitions);
    const u1 = await createUser({ email: 'u1@x.com' });
    const u2 = await createUser({ email: 'u2@x.com' });

    await wordService.searchAndTrack('partage', u1._id);
    await wordService.searchAndTrack('partage', u2._id);

    expect(await Word.countDocuments({ word: 'partage' })).toBe(1);
    expect(await UserWord.countDocuments({ userId: u1._id })).toBe(1);
    expect(await UserWord.countDocuments({ userId: u2._id })).toBe(1);
    expect(dictionaryService.fetchDefinition).toHaveBeenCalledTimes(1);
  });

  it('throws 404 when word not found in upstream API', async () => {
    dictionaryService.fetchDefinition.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'NOT_FOUND' })
    );
    const user = await createUser();
    await expect(wordService.searchAndTrack('xyzunknown', user._id)).rejects.toMatchObject({
      status: 404,
    });
    expect(await Word.countDocuments()).toBe(0);
    expect(await UserWord.countDocuments()).toBe(0);
  });

  it('throws 502 when upstream API errors', async () => {
    dictionaryService.fetchDefinition.mockRejectedValue(
      Object.assign(new Error('boom'), { code: 'UPSTREAM_ERROR' })
    );
    const user = await createUser();
    await expect(wordService.searchAndTrack('any', user._id)).rejects.toMatchObject({
      status: 502,
    });
  });

  it('throws 400 when word is empty', async () => {
    const user = await createUser();
    await expect(wordService.searchAndTrack('   ', user._id)).rejects.toMatchObject({
      status: 400,
    });
  });

  it('normalizes word before storing (case + accents)', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(mockDefinitions);
    const user = await createUser();

    await wordService.searchAndTrack('  CAFÉ  ', user._id);
    const r = await wordService.searchAndTrack('café', user._id);

    expect(r.fromCache).toBe(true);
    expect(await Word.countDocuments()).toBe(1);
  });
});

describe('wordService.listUserWords', () => {
  it('returns paginated list sorted by lastSearchedAt desc', async () => {
    const user = await createUser();
    const w1 = await Word.create({ word: 'alpha', definitions: [{ definition: 'a' }] });
    const w2 = await Word.create({ word: 'beta', definitions: [{ definition: 'b' }] });

    await UserWord.create({
      userId: user._id, wordId: w1._id, lastSearchedAt: new Date('2024-01-01'),
    });
    await UserWord.create({
      userId: user._id, wordId: w2._id, lastSearchedAt: new Date('2024-02-01'),
    });

    const r = await wordService.listUserWords(user._id);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].word).toBe('beta');
    expect(r.items[1].word).toBe('alpha');
    expect(r.pagination.total).toBe(2);
  });

  it('filters by search term', async () => {
    const user = await createUser();
    const w1 = await Word.create({ word: 'pomme', definitions: [{ definition: 'a' }] });
    const w2 = await Word.create({ word: 'poire', definitions: [{ definition: 'b' }] });
    await UserWord.create({ userId: user._id, wordId: w1._id });
    await UserWord.create({ userId: user._id, wordId: w2._id });

    const r = await wordService.listUserWords(user._id, { search: 'pom' });
    expect(r.items).toHaveLength(1);
    expect(r.items[0].word).toBe('pomme');
  });

  it('does not return words from another user', async () => {
    const u1 = await createUser({ email: 'u1@x.com' });
    const u2 = await createUser({ email: 'u2@x.com' });
    const w = await Word.create({ word: 'priv', definitions: [{ definition: 'x' }] });
    await UserWord.create({ userId: u2._id, wordId: w._id });

    const r = await wordService.listUserWords(u1._id);
    expect(r.items).toHaveLength(0);
  });
});

describe('wordService.deleteUserWord', () => {
  it('removes UserWord but keeps Word in cache', async () => {
    const user = await createUser();
    const w = await Word.create({ word: 'keep', definitions: [{ definition: 'x' }] });
    const uw = await UserWord.create({ userId: user._id, wordId: w._id });

    await wordService.deleteUserWord(user._id, uw._id);

    expect(await UserWord.findById(uw._id)).toBeNull();
    expect(await Word.findById(w._id)).not.toBeNull();
  });

  it('throws 404 when UserWord does not belong to caller', async () => {
    const u1 = await createUser({ email: 'u1@x.com' });
    const u2 = await createUser({ email: 'u2@x.com' });
    const w = await Word.create({ word: 'x', definitions: [{ definition: 'x' }] });
    const uw = await UserWord.create({ userId: u1._id, wordId: w._id });

    await expect(wordService.deleteUserWord(u2._id, uw._id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('wordService.updateUserWord', () => {
  it('updates only allowed fields', async () => {
    const user = await createUser();
    const w = await Word.create({ word: 'edit', definitions: [{ definition: 'x' }] });
    const uw = await UserWord.create({ userId: user._id, wordId: w._id });

    const r = await wordService.updateUserWord(user._id, uw._id, {
      notes: 'my notes',
      tags: ['important'],
      favorite: true,
      searchCount: 999, // disallowed
    });

    expect(r.notes).toBe('my notes');
    expect(r.tags).toEqual(['important']);
    expect(r.favorite).toBe(true);
    expect(r.searchCount).toBe(1); // unchanged
  });
});
