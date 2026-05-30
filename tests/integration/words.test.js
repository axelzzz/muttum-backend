// Mock the dictionary service BEFORE the app is loaded
jest.mock('../../src/services/dictionaryService', () => {
  const actual = jest.requireActual('../../src/services/dictionaryService');
  return {
    ...actual,
    fetchDefinition: jest.fn(),
  };
});

const request = require('supertest');
const createApp = require('../../src/app');
const dictionaryService = require('../../src/services/dictionaryService');
const Word = require('../../src/models/Word');
const UserWord = require('../../src/models/UserWord');
const { createUserAndToken } = require('../fixtures/users');

const app = createApp();

const sampleDefs = [
  {
    partOfSpeech: 'n.f.',
    definition: 'Capacité de découvrir par hasard.',
    examples: ['exemple'],
  },
];

describe('GET /api/words/search', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/words/search?word=hello');
    expect(res.status).toBe(401);
  });

  it('returns 400 when word param is missing', async () => {
    const { token } = await createUserAndToken();
    const res = await request(app)
      .get('/api/words/search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('CORE SCENARIO — first user fetches from API, caches in DB, adds to their list', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token, user } = await createUserAndToken({ email: 'first@x.com' });

    const res = await request(app)
      .get('/api/words/search?word=Sérendipité')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.fromCache).toBe(false);
    expect(res.body.alreadyInList).toBe(false);
    expect(res.body.word).toBe('sérendipité');
    expect(res.body.definitions).toEqual(sampleDefs);
    expect(dictionaryService.fetchDefinition).toHaveBeenCalledTimes(1);

    expect(await Word.countDocuments({ word: 'sérendipité' })).toBe(1);
    expect(await UserWord.countDocuments({ userId: user._id })).toBe(1);
  });

  it('CORE SCENARIO — second user searching same word reads from cache (no API call), and gets it added to their list', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token: t1 } = await createUserAndToken({ email: 'a@x.com' });
    const { token: t2, user: u2 } = await createUserAndToken({ email: 'b@x.com' });

    // First user triggers the cache
    await request(app)
      .get('/api/words/search?word=mutuel')
      .set('Authorization', `Bearer ${t1}`);
    expect(dictionaryService.fetchDefinition).toHaveBeenCalledTimes(1);

    // Second user searches same word
    const res = await request(app)
      .get('/api/words/search?word=mutuel')
      .set('Authorization', `Bearer ${t2}`);

    expect(res.status).toBe(200);
    expect(res.body.fromCache).toBe(true);
    expect(res.body.alreadyInList).toBe(false); // it's in user2's list for the first time
    // API NOT called a second time
    expect(dictionaryService.fetchDefinition).toHaveBeenCalledTimes(1);

    // Word still unique in DB, both users have a UserWord entry
    expect(await Word.countDocuments({ word: 'mutuel' })).toBe(1);
    expect(await UserWord.countDocuments({ userId: u2._id })).toBe(1);
    expect(await UserWord.countDocuments()).toBe(2);
  });

  it('repeated search by same user does not duplicate UserWord, increments searchCount', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token, user } = await createUserAndToken();

    await request(app).get('/api/words/search?word=double').set('Authorization', `Bearer ${token}`);
    const r2 = await request(app)
      .get('/api/words/search?word=double')
      .set('Authorization', `Bearer ${token}`);

    expect(r2.body.alreadyInList).toBe(true);
    expect(await UserWord.countDocuments({ userId: user._id })).toBe(1);
    const uw = await UserWord.findOne({ userId: user._id });
    expect(uw.searchCount).toBe(2);
  });

  it('returns 404 when word does not exist in upstream API', async () => {
    dictionaryService.fetchDefinition.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'NOT_FOUND' })
    );
    const { token } = await createUserAndToken();

    const res = await request(app)
      .get('/api/words/search?word=motbidonqsdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(await Word.countDocuments()).toBe(0);
    expect(await UserWord.countDocuments()).toBe(0);
  });

  it('returns 502 when upstream API is unreachable', async () => {
    dictionaryService.fetchDefinition.mockRejectedValue(
      Object.assign(new Error('timeout'), { code: 'UPSTREAM_ERROR' })
    );
    const { token } = await createUserAndToken();
    const res = await request(app)
      .get('/api/words/search?word=anything')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(502);
  });

  it('normalizes accents/case so duplicates collapse', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token } = await createUserAndToken();

    await request(app).get('/api/words/search?word=CAFÉ').set('Authorization', `Bearer ${token}`);
    const r2 = await request(app)
      .get('/api/words/search?word=café')
      .set('Authorization', `Bearer ${token}`);

    expect(r2.body.fromCache).toBe(true);
    expect(await Word.countDocuments()).toBe(1);
    expect(dictionaryService.fetchDefinition).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/words', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists only the user own words', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token: t1 } = await createUserAndToken({ email: 'u1@x.com' });
    const { token: t2 } = await createUserAndToken({ email: 'u2@x.com' });

    await request(app).get('/api/words/search?word=alpha').set('Authorization', `Bearer ${t1}`);
    await request(app).get('/api/words/search?word=beta').set('Authorization', `Bearer ${t2}`);

    const res1 = await request(app).get('/api/words').set('Authorization', `Bearer ${t1}`);
    expect(res1.status).toBe(200);
    expect(res1.body.items).toHaveLength(1);
    expect(res1.body.items[0].word).toBe('alpha');

    const res2 = await request(app).get('/api/words').set('Authorization', `Bearer ${t2}`);
    expect(res2.body.items).toHaveLength(1);
    expect(res2.body.items[0].word).toBe('beta');
  });

  it('supports pagination', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token } = await createUserAndToken();

    for (const w of ['un', 'deux', 'trois', 'quatre', 'cinq']) {
      await request(app)
        .get(`/api/words/search?word=${w}`)
        .set('Authorization', `Bearer ${token}`);
    }

    const res = await request(app)
      .get('/api/words?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.pagination.total).toBe(5);
    expect(res.body.pagination.pages).toBe(3);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/words');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/words/:id', () => {
  it('returns the word if it belongs to the user', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token } = await createUserAndToken();

    await request(app).get('/api/words/search?word=detail').set('Authorization', `Bearer ${token}`);
    const list = await request(app).get('/api/words').set('Authorization', `Bearer ${token}`);
    const id = list.body.items[0].id;

    const res = await request(app)
      .get(`/api/words/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.word).toBe('detail');
  });

  it('returns 404 if word belongs to another user', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token: t1 } = await createUserAndToken({ email: 'a@x.com' });
    const { token: t2 } = await createUserAndToken({ email: 'b@x.com' });

    await request(app).get('/api/words/search?word=secret').set('Authorization', `Bearer ${t1}`);
    const list = await request(app).get('/api/words').set('Authorization', `Bearer ${t1}`);
    const id = list.body.items[0].id;

    const res = await request(app)
      .get(`/api/words/${id}`)
      .set('Authorization', `Bearer ${t2}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 with invalid id format', async () => {
    const { token } = await createUserAndToken();
    const res = await request(app)
      .get('/api/words/not-a-mongo-id')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/words/:id', () => {
  it('updates notes, tags, favorite', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token } = await createUserAndToken();
    await request(app).get('/api/words/search?word=edit').set('Authorization', `Bearer ${token}`);
    const list = await request(app).get('/api/words').set('Authorization', `Bearer ${token}`);
    const id = list.body.items[0].id;

    const res = await request(app)
      .patch(`/api/words/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'mes notes', tags: ['important'], favorite: true });

    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('mes notes');
    expect(res.body.tags).toEqual(['important']);
    expect(res.body.favorite).toBe(true);
  });
});

describe('DELETE /api/words/:id', () => {
  it('removes from user list but keeps Word in shared cache', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token } = await createUserAndToken();
    await request(app).get('/api/words/search?word=remove').set('Authorization', `Bearer ${token}`);
    const list = await request(app).get('/api/words').set('Authorization', `Bearer ${token}`);
    const id = list.body.items[0].id;

    const res = await request(app)
      .delete(`/api/words/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    expect(await UserWord.countDocuments()).toBe(0);
    expect(await Word.countDocuments({ word: 'remove' })).toBe(1);
  });

  it('returns 404 when trying to delete word of another user', async () => {
    dictionaryService.fetchDefinition.mockResolvedValue(sampleDefs);
    const { token: t1 } = await createUserAndToken({ email: 'a@x.com' });
    const { token: t2 } = await createUserAndToken({ email: 'b@x.com' });

    await request(app).get('/api/words/search?word=mine').set('Authorization', `Bearer ${t1}`);
    const list = await request(app).get('/api/words').set('Authorization', `Bearer ${t1}`);
    const id = list.body.items[0].id;

    const res = await request(app)
      .delete(`/api/words/${id}`)
      .set('Authorization', `Bearer ${t2}`);
    expect(res.status).toBe(404);
  });
});
