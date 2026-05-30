const axios = require('axios');
const config = require('../config');

class DictionaryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DictionaryError';
    this.code = code;
  }
}

/**
 * Récupère la définition d'un mot via l'API REST de Wiktionary FR.
 * Réponse Wiktionary: { fr: [ { partOfSpeech, language, definitions: [{ definition, examples }] } ] }
 *
 * @param {string} word - mot déjà normalisé
 * @returns {Promise<Array<{partOfSpeech, definition, examples}>>}
 * @throws {DictionaryError} code = NOT_FOUND | UPSTREAM_ERROR
 */
async function fetchDefinition(word) {
  if (!word || typeof word !== 'string') {
    throw new DictionaryError('Invalid word', 'INVALID_INPUT');
  }

  const url = `${config.wiktionary.baseUrl}/${encodeURIComponent(word)}`;

  let response;
  try {
    response = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'DictionaryApp/1.0' },
      validateStatus: (s) => s < 500,
    });
  } catch (err) {
    throw new DictionaryError(
      `Upstream dictionary unreachable: ${err.message}`,
      'UPSTREAM_ERROR'
    );
  }

  if (response.status === 404) {
    throw new DictionaryError(`Word "${word}" not found`, 'NOT_FOUND');
  }
  if (response.status >= 400) {
    throw new DictionaryError(
      `Upstream dictionary error (HTTP ${response.status})`,
      'UPSTREAM_ERROR'
    );
  }

  const parsed = parseWiktionaryResponse(response.data);
  if (parsed.length === 0) {
    throw new DictionaryError(`No French definitions for "${word}"`, 'NOT_FOUND');
  }
  return parsed;
}

/**
 * Parse la réponse Wiktionary et extrait uniquement les définitions FR.
 * Strip les balises HTML basiques.
 */
function parseWiktionaryResponse(data) {
  const frEntries = (data && data.fr) || [];
  const result = [];

  for (const entry of frEntries) {
    if (!entry || !Array.isArray(entry.definitions)) continue;
    for (const def of entry.definitions) {
      if (!def || !def.definition) continue;
      result.push({
        partOfSpeech: entry.partOfSpeech || '',
        definition: stripHtml(def.definition),
        examples: Array.isArray(def.examples)
          ? def.examples.map(stripHtml).filter(Boolean)
          : [],
      });
    }
  }
  return result;
}

function stripHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  fetchDefinition,
  parseWiktionaryResponse,
  stripHtml,
  DictionaryError,
};
