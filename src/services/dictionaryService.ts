import axios, { AxiosResponse } from 'axios';
import config from '../config';
import type { Definition, DictionaryErrorCode } from '../types';

const WIKTIONARY_TIMEOUT_MS = 8000;

export class DictionaryError extends Error {
  readonly code: DictionaryErrorCode;

  constructor(message: string, code: DictionaryErrorCode) {
    super(message);
    this.name = 'DictionaryError';
    this.code = code;
  }
}

const POS_MAP: Record<string, string> = {
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

interface WiktionaryResponse {
  parse?: {
    wikitext?: { '*': string };
  };
  error?: {
    code: string;
    info?: string;
  };
}

function validateApiResponse(response: AxiosResponse<WiktionaryResponse>, word: string): void {
  if (response.data?.error) {
    if (response.data.error.code === 'missingtitle') {
      throw new DictionaryError(`Word "${word}" not found`, 'NOT_FOUND');
    }
    throw new DictionaryError(
      `Upstream dictionary error: ${response.data.error.info ?? response.data.error.code}`,
      'UPSTREAM_ERROR'
    );
  }
  if (response.status === 404) {
    throw new DictionaryError(`Word "${word}" not found`, 'NOT_FOUND');
  }
  if (response.status >= 400) {
    throw new DictionaryError(`Upstream dictionary error (HTTP ${response.status})`, 'UPSTREAM_ERROR');
  }
}

export async function fetchDefinition(word: unknown): Promise<Definition[]> {
  if (!word || typeof word !== 'string') {
    throw new DictionaryError('Invalid word', 'INVALID_INPUT');
  }

  const url = `${config.wiktionary.baseUrl}/w/api.php`;

  let response: AxiosResponse<WiktionaryResponse>;
  try {
    response = await axios.get<WiktionaryResponse>(url, {
      params: { action: 'parse', page: word, prop: 'wikitext', format: 'json', utf8: '1' },
      timeout: WIKTIONARY_TIMEOUT_MS,
      headers: { 'User-Agent': 'DictionaryApp/1.0' },
      validateStatus: (s) => s < 500,
    });
  } catch (err) {
    throw new DictionaryError(
      `Upstream dictionary unreachable: ${err instanceof Error ? err.message : String(err)}`,
      'UPSTREAM_ERROR'
    );
  }

  validateApiResponse(response, word);

  const wikitext = response.data?.parse?.wikitext?.['*'];
  if (!wikitext) {
    throw new DictionaryError(`No content for "${word}"`, 'UPSTREAM_ERROR');
  }

  const parsed = parseWiktionaryWikitext(wikitext);
  if (parsed.length === 0) {
    throw new DictionaryError(`No French definitions for "${word}"`, 'NOT_FOUND');
  }
  return parsed;
}

export function parseWiktionaryWikitext(wikitext: unknown): Definition[] {
  if (!wikitext || typeof wikitext !== 'string') return [];

  // Wiktionary sometimes splits template parameters across lines; collapse them before line-by-line processing
  const normalized = wikitext.replace(/\n[ \t]*\|/g, ' |');
  const lines = normalized.split('\n');

  const results: Definition[] = [];
  let inFrSection = false;
  let currentPos: string | null = null;
  let currentDef: Definition | null = null;

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
      currentPos = NON_DEF_SECTIONS.has(posKey) ? null : (POS_MAP[posKey] ?? capitalize(posKey));
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

function extractExampleText(line: string): string {
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

function parseTemplateParams(s: string): string[] {
  const params: string[] = [];
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

function removeTemplates(s: string): string {
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

export function cleanWikitext(s: unknown): string {
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
