const Word = require('../models/Word');
const UserWord = require('../models/UserWord');
const dictionaryService = require('./dictionaryService');

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function formatUserWord(uw) {
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

async function fetchAndCacheWord(normalized) {
  let definitions;
  try {
    definitions = await dictionaryService.fetchDefinition(normalized);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      throw httpError(`Word "${normalized}" not found in dictionary`, 404);
    }
    throw httpError('Dictionary service unavailable', 502);
  }

  try {
    return await Word.create({ word: normalized, definitions, source: 'wiktionary', fetchedAt: new Date() });
  } catch (err) {
    // Race condition: another request inserted the same word concurrently
    if (err.code === 11000) return Word.findOne({ word: normalized });
    throw err;
  }
}

async function resolveWord(normalized) {
  const cached = await Word.findOne({ word: normalized });
  if (cached) return { word: cached, fromCache: true };

  const word = await fetchAndCacheWord(normalized);
  return { word, fromCache: false };
}

async function trackSearch(userId, wordId) {
  // new:false (default) returns null on upsert, pre-update doc on existing match
  const previous = await UserWord.findOneAndUpdate(
    { userId, wordId },
    {
      $set: { lastSearchedAt: new Date() },
      $inc: { searchCount: 1 },
      $setOnInsert: { userId, wordId, firstSearchedAt: new Date() },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return previous !== null;
}

async function searchAndTrack(rawWord, userId) {
  const normalized = Word.normalize(rawWord);
  if (!normalized) throw httpError('Word is required', 400);

  const { word, fromCache } = await resolveWord(normalized);
  const alreadyInList = await trackSearch(userId, word._id);

  const userWord = await UserWord.findOne({ userId, wordId: word._id }, '_id').lean();

  return {
    id: userWord?._id,
    word: word.word,
    wordId: word._id,
    definitions: word.toObject().definitions,
    source: word.source,
    fromCache,
    alreadyInList,
  };
}

async function listUserWords(userId, { page = 1, limit = 20, search = '' } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(limit, 10) || DEFAULT_PAGE_LIMIT));
  const skip = (safePage - 1) * safeLimit;

  const userWords = await UserWord.find({ userId })
    .sort({ lastSearchedAt: -1 })
    .populate({
      path: 'wordId',
      match: search ? { word: { $regex: search.toLowerCase(), $options: 'i' } } : {},
    })
    .lean();

  const filtered = userWords.filter((uw) => uw.wordId);
  const total = filtered.length;
  const paginated = filtered.slice(skip, skip + safeLimit);

  return {
    items: paginated.map(formatUserWord),
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

async function getUserWord(userId, userWordId) {
  const uw = await UserWord.findOne({ _id: userWordId, userId }).populate('wordId').lean();
  if (!uw) throw httpError('Word not found in your list', 404);
  return formatUserWord(uw);
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
  )
    .populate('wordId')
    .lean();

  if (!uw) throw httpError('Word not found in your list', 404);
  return formatUserWord(uw);
}

async function deleteUserWord(userId, userWordId) {
  const uw = await UserWord.findOneAndDelete({ _id: userWordId, userId });
  if (!uw) throw httpError('Word not found in your list', 404);
  return { id: uw._id };
}

module.exports = {
  searchAndTrack,
  listUserWords,
  getUserWord,
  updateUserWord,
  deleteUserWord,
};
