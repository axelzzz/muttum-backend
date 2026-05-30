const wordService = require('../services/wordService');

async function search(req, res, next) {
  try {
    const word = req.query.word;
    const result = await wordService.searchAndTrack(word, req.userId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function list(req, res, next) {
  try {
    const result = await wordService.listUserWords(req.userId, req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const result = await wordService.getUserWord(req.userId, req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const result = await wordService.updateUserWord(req.userId, req.params.id, req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await wordService.deleteUserWord(req.userId, req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { search, list, getOne, update, remove };
