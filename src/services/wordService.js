const Word = require('../models/Word');
const UserWord = require('../models/UserWord');
const dictionaryService = require('./dictionaryService');

/**
 * Recherche d'un mot avec :
 * 1. Recherche en cache (collection Word)
 * 2. Fallback API tierce si absent
 * 3. Insertion en cache si récupéré
 * 4. Upsert dans UserWord (ajout ou MAJ lastSearchedAt + searchCount)
 *
 * @returns {{ word, definitions, fromCache, alreadyInList }}
 */
async function searchAndTrack(rawWord, userId) {
  const normalized = Word.normalize(rawWord);
  if (!normalized) {
    const e = new Error('Word is required');
    e.status = 400;
    throw e;
  }

  let word = await Word.findOne({ word: normalized });
  let fromCache = true;

  if (!word) {
    fromCache = false;
    let definitions;
    try {
      definitions = await dictionaryService.fetchDefinition(normalized);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        const e = new Error(`Word "${normalized}" not found in dictionary`);
        e.status = 404;
        throw e;
      }
      const e = new Error('Dictionary service unavailable');
      e.status = 502;
      throw e;
    }

    try {
      word = await Word.create({
        word: normalized,
        definitions,
        source: 'wiktionary',
        fetchedAt: new Date(),
      });
    } catch (err) {
      // Race condition: another request inserted the same word in parallel
      if (err.code === 11000) {
        word = await Word.findOne({ word: normalized });
      } else {
        throw err;
      }
    }
  }

  // Upsert user-word relation
  const existing = await UserWord.findOne({ userId, wordId: word._id });
  const alreadyInList = !!existing;

  await UserWord.findOneAndUpdate(
    { userId, wordId: word._id },
    {
      $set: { lastSearchedAt: new Date() },
      $inc: { searchCount: existing ? 1 : 0 },
      $setOnInsert: {
        userId,
        wordId: word._id,
        firstSearchedAt: new Date(),
        searchCount: 1,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    word: word.word,
    wordId: word._id,
    definitions: word.definitions,
    source: word.source,
    fromCache,
    alreadyInList,
  };
}

/**
 * Liste paginée des mots de l'utilisateur (jointure UserWord ↔ Word).
 */
async function listUserWords(userId, { page = 1, limit = 20, search = '' } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const userWords = await UserWord.find({ userId })
    .sort({ lastSearchedAt: -1 })
    .populate({
      path: 'wordId',
      match: search ? { word: { $regex: search.toLowerCase(), $options: 'i' } } : {},
    })
    .lean();

  // Filter out entries whose populated word didn't match the search filter
  const filtered = userWords.filter((uw) => uw.wordId);
  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + safeLimit);

  const items = paginated.map((uw) => ({
    id: uw._id,
    word: uw.wordId.word,
    definitions: uw.wordId.definitions,
    firstSearchedAt: uw.firstSearchedAt,
    lastSearchedAt: uw.lastSearchedAt,
    searchCount: uw.searchCount,
    notes: uw.notes,
    tags: uw.tags,
    favorite: uw.favorite,
  }));

  return {
    items,
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

async function getUserWord(userId, userWordId) {
  const uw = await UserWord.findOne({ _id: userWordId, userId }).populate('wordId').lean();
  if (!uw) {
    const e = new Error('Word not found in your list');
    e.status = 404;
    throw e;
  }
  return {
    id: uw._id,
    word: uw.wordId.word,
    definitions: uw.wordId.definitions,
    firstSearchedAt: uw.firstSearchedAt,
    lastSearchedAt: uw.lastSearchedAt,
    searchCount: uw.searchCount,
    notes: uw.notes,
    tags: uw.tags,
    favorite: uw.favorite,
  };
}

async function updateUserWord(userId, userWordId, payload) {
  const allowed = {};
  if (typeof payload.notes === 'string') allowed.notes = payload.notes;
  if (Array.isArray(payload.tags)) allowed.tags = payload.tags;
  if (typeof payload.favorite === 'boolean') allowed.favorite = payload.favorite;

  const uw = await UserWord.findOneAndUpdate(
    { _id: userWordId, userId },
    { $set: allowed },
    { new: true }
  ).populate('wordId');

  if (!uw) {
    const e = new Error('Word not found in your list');
    e.status = 404;
    throw e;
  }
  return {
    id: uw._id,
    word: uw.wordId.word,
    definitions: uw.wordId.definitions,
    notes: uw.notes,
    tags: uw.tags,
    favorite: uw.favorite,
    firstSearchedAt: uw.firstSearchedAt,
    lastSearchedAt: uw.lastSearchedAt,
    searchCount: uw.searchCount,
  };
}

async function deleteUserWord(userId, userWordId) {
  const uw = await UserWord.findOneAndDelete({ _id: userWordId, userId });
  if (!uw) {
    const e = new Error('Word not found in your list');
    e.status = 404;
    throw e;
  }
  return { id: uw._id };
}

module.exports = {
  searchAndTrack,
  listUserWords,
  getUserWord,
  updateUserWord,
  deleteUserWord,
};
