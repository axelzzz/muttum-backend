jest.mock('axios');
const axios = require('axios');

const dictionaryService = require('../../src/services/dictionaryService');
const {
  wiktionarySerendipiteWikitext,
  wiktionarySerendipiteResponse,
  wiktionaryEmptyResponse,
  wiktionaryNoFrResponse,
  wiktionaryMissingResponse,
  expectedSerendipiteParsed,
} = require('../fixtures/wiktionary');

describe('dictionaryService', () => {
  describe('cleanWikitext', () => {
    it('strips bold and italic markers', () => {
      expect(dictionaryService.cleanWikitext("''italic'' and '''bold'''")).toBe('italic and bold');
    });

    it('resolves wiki links with display text', () => {
      expect(dictionaryService.cleanWikitext('[[bâtiment|Bâtiment]] solide')).toBe('Bâtiment solide');
    });

    it('resolves plain wiki links', () => {
      expect(dictionaryService.cleanWikitext('voir [[maison]]')).toBe('voir maison');
    });

    it('removes templates', () => {
      expect(dictionaryService.cleanWikitext('{{édifices|fr}} Un bâtiment.')).toBe('Un bâtiment.');
    });

    it('removes nested templates', () => {
      expect(dictionaryService.cleanWikitext('{{outer|{{inner|val}}}} texte')).toBe('texte');
    });

    it('collapses whitespace', () => {
      expect(dictionaryService.cleanWikitext('  trop   d\'espaces  ')).toBe("trop d'espaces");
    });

    it('returns empty string for non-string input', () => {
      expect(dictionaryService.cleanWikitext(null)).toBe('');
      expect(dictionaryService.cleanWikitext(undefined)).toBe('');
    });
  });

  describe('parseWiktionaryWikitext', () => {
    it('parses a valid French wikitext', () => {
      const result = dictionaryService.parseWiktionaryWikitext(wiktionarySerendipiteWikitext);
      expect(result).toEqual(expectedSerendipiteParsed);
    });

    it('returns empty array for null or empty input', () => {
      expect(dictionaryService.parseWiktionaryWikitext(null)).toEqual([]);
      expect(dictionaryService.parseWiktionaryWikitext('')).toEqual([]);
    });

    it('returns empty array when no French section exists', () => {
      const wt = '== {{langue|en}} ==\n=== {{S|nom|en}} ===\n# An English noun.\n';
      expect(dictionaryService.parseWiktionaryWikitext(wt)).toEqual([]);
    });

    it('ignores non-definition sections', () => {
      const wt = '== {{langue|fr}} ==\n=== {{S|étymologie}} ===\n: Du latin.\n';
      expect(dictionaryService.parseWiktionaryWikitext(wt)).toEqual([]);
    });

    it('handles multiple parts of speech', () => {
      const wt = `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
# Un nom.
=== {{S|verbe|fr}} ===
# Un verbe.
`;
      const result = dictionaryService.parseWiktionaryWikitext(wt);
      expect(result).toHaveLength(2);
      expect(result[0].partOfSpeech).toBe('Nom commun');
      expect(result[1].partOfSpeech).toBe('Verbe');
    });

    it('skips empty examples after cleaning', () => {
      const wt = `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
# Une définition.
#* {{exemple|lang=fr|}}
`;
      const result = dictionaryService.parseWiktionaryWikitext(wt);
      expect(result).toHaveLength(1);
      expect(result[0].examples).toHaveLength(0);
    });
  });

  describe('fetchDefinition', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns parsed definitions on success', async () => {
      axios.get.mockResolvedValue({ status: 200, data: wiktionarySerendipiteResponse });
      const result = await dictionaryService.fetchDefinition('sérendipité');
      expect(result).toEqual(expectedSerendipiteParsed);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get.mock.calls[0][1].params).toMatchObject({ page: 'sérendipité' });
    });

    it('throws NOT_FOUND on 404 response', async () => {
      axios.get.mockResolvedValue({ status: 404, data: {} });
      await expect(dictionaryService.fetchDefinition('motinconnu')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND on missingtitle API error', async () => {
      axios.get.mockResolvedValue({ status: 200, data: wiktionaryMissingResponse });
      await expect(dictionaryService.fetchDefinition('motinconnu')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND when no French definitions are available', async () => {
      axios.get.mockResolvedValue({ status: 200, data: wiktionaryNoFrResponse });
      await expect(dictionaryService.fetchDefinition('hello')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws NOT_FOUND when French section has no definitions', async () => {
      axios.get.mockResolvedValue({ status: 200, data: wiktionaryEmptyResponse });
      await expect(dictionaryService.fetchDefinition('test')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws UPSTREAM_ERROR on network failure', async () => {
      axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(dictionaryService.fetchDefinition('test')).rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
      });
    });

    it('throws UPSTREAM_ERROR on 4xx (not 404)', async () => {
      axios.get.mockResolvedValue({ status: 429, data: {} });
      await expect(dictionaryService.fetchDefinition('test')).rejects.toMatchObject({
        code: 'UPSTREAM_ERROR',
      });
    });

    it('throws INVALID_INPUT on empty word', async () => {
      await expect(dictionaryService.fetchDefinition('')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(dictionaryService.fetchDefinition(null)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });
});
