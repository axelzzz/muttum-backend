const axios = require('axios');
const config = require('../config');

class DictionaryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'DictionaryError';
    this.code = code;
  }
}

const POS_MAP = {
  'nom': 'Nom commun',
  'verbe': 'Verbe',
  'adj': 'Adjectif',
  'adv': 'Adverbe',
  'prép': 'Préposition',
  'prép.': 'Préposition',
  'conj': 'Conjonction',
  'art': 'Article',
  'pron': 'Pronom',
  'loc-nom': 'Locution nominale',
  'loc-verb': 'Locution verbale',
  'loc-adj': 'Locution adjectivale',
  'loc-adv': 'Locution adverbiale',
  'interj': 'Interjection',
  'onoma': 'Onomatopée',
  'lettre': 'Lettre',
  'préf': 'Préfixe',
  'suf': 'Suffixe',
  'symb': 'Symbole',
  'num': 'Numéral',
};

const NON_DEF_SECTIONS = new Set([
  'étymologie', 'prononciation', 'variantes', 'synonymes', 'antonymes',
  'dérivés', 'références', 'traductions', 'anagrammes', 'vocabulaire',
  'homophones', 'paronymes', 'quasi-synonymes', 'apparentés',
  'hyponymes', 'hyperonymes', 'holonymes', 'méronymes',
]);

async function fetchDefinition(word) {
  if (!word || typeof word !== 'string') {
    throw new DictionaryError('Invalid word', 'INVALID_INPUT');
  }

  const url = `${config.wiktionary.baseUrl}/w/api.php`;

  let response;
  try {
    response = await axios.get(url, {
      params: { action: 'parse', page: word, prop: 'wikitext', format: 'json', utf8: '1' },
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

  if (response.data && response.data.error) {
    if (response.data.error.code === 'missingtitle') {
      throw new DictionaryError(`Word "${word}" not found`, 'NOT_FOUND');
    }
    throw new DictionaryError(
      `Upstream dictionary error: ${response.data.error.info || response.data.error.code}`,
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

  const wikitext =
    response.data &&
    response.data.parse &&
    response.data.parse.wikitext &&
    response.data.parse.wikitext['*'];

  if (!wikitext) {
    throw new DictionaryError(`No content for "${word}"`, 'UPSTREAM_ERROR');
  }

  const parsed = parseWiktionaryWikitext(wikitext);
  if (parsed.length === 0) {
    throw new DictionaryError(`No French definitions for "${word}"`, 'NOT_FOUND');
  }
  return parsed;
}

function parseWiktionaryWikitext(wikitext) {
  if (!wikitext || typeof wikitext !== 'string') return [];

  // Collapse multi-line template parameters so each template fits on one line
  const normalized = wikitext.replace(/\n[ \t]*\|/g, ' |');
  const lines = normalized.split('\n');

  const results = [];
  let inFrSection = false;
  let currentPos = null;
  let currentDef = null;

  for (const line of lines) {
    if (/^==\s*\{\{langue\|fr\}\}\s*==/.test(line)) {
      inFrSection = true;
      continue;
    }
    if (/^==\s*\{\{langue\|(?!fr)/.test(line)) {
      inFrSection = false;
      if (currentDef) { results.push(currentDef); currentDef = null; }
      continue;
    }

    if (!inFrSection) continue;

    const posMatch = line.match(/^===\s*\{\{S\|([^|}\n]+)/);
    if (posMatch) {
      if (currentDef) { results.push(currentDef); currentDef = null; }
      const posKey = posMatch[1].trim().toLowerCase();
      currentPos = NON_DEF_SECTIONS.has(posKey) ? null : (POS_MAP[posKey] || capitalize(posKey));
      continue;
    }

    if (!currentPos) continue;

    if (/^# [^*#:]/.test(line)) {
      if (currentDef) results.push(currentDef);
      const defText = cleanWikitext(line.replace(/^# /, ''));
      currentDef = defText ? { partOfSpeech: currentPos, definition: defText, examples: [] } : null;
      continue;
    }

    if (currentDef && /^#\*/.test(line)) {
      const ex = extractExampleText(line);
      if (ex) currentDef.examples.push(ex);
    }
  }

  if (currentDef) results.push(currentDef);
  return results;
}

function extractExampleText(line) {
  const content = line.replace(/^#\*\s*/, '');

  const exIdx = content.indexOf('{{exemple');
  if (exIdx !== -1) {
    const after = content.slice(exIdx + 9);
    const params = parseTemplateParams(after);
    let foundLang = false;
    for (const param of params) {
      const trimmed = param.trim();
      if (trimmed.startsWith('lang=')) { foundLang = true; continue; }
      if (foundLang && !trimmed.includes('=')) return cleanWikitext(trimmed);
      if (foundLang) break;
    }
  }

  return cleanWikitext(content);
}

// Returns an array of raw parameter strings from inside a {{template|...}} call.
// Input starts right after the template name (e.g. "|lang=fr|TEXT|source=...}}").
function parseTemplateParams(s) {
  const params = [];
  let i = 0;

  while (i < s.length && s[i] !== '|' && s[i] !== '}') i++;
  if (!s[i] || s[i] !== '|') return params;
  i++;

  let depth = 0;
  let current = '';
  while (i < s.length) {
    if (s[i] === '{' && s[i + 1] === '{') {
      depth++;
      current += s[i++];
      current += s[i++];
    } else if (s[i] === '}' && s[i + 1] === '}') {
      if (depth === 0) {
        if (current.trim()) params.push(current);
        break;
      }
      depth--;
      current += s[i++];
      current += s[i++];
    } else if (s[i] === '|' && depth === 0) {
      params.push(current);
      current = '';
      i++;
    } else {
      current += s[i++];
    }
  }

  return params;
}

function removeTemplates(s) {
  let result = '';
  let depth = 0;
  let i = 0;
  while (i < s.length) {
    if (s[i] === '{' && s[i + 1] === '{') {
      depth++;
      i += 2;
    } else if (s[i] === '}' && s[i + 1] === '}') {
      if (depth > 0) depth--;
      i += 2;
    } else if (depth === 0) {
      result += s[i++];
    } else {
      i++;
    }
  }
  return result;
}

function cleanWikitext(s) {
  if (typeof s !== 'string') return '';
  let r = s;
  r = r.replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1');
  r = r.replace(/\[https?:\/\/\S+\]/g, '');
  r = removeTemplates(r);
  r = r.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1');
  r = r.replace(/'{2,3}/g, '');
  r = r.replace(/<[^>]*>/g, '');
  return r.replace(/\s+/g, ' ').trim();
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  parseWiktionaryWikitext,
  cleanWikitext,
  stripHtml,
  DictionaryError,
};
