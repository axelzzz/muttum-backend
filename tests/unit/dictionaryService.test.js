jest.mock('axios');
const axios = require('axios');

const dictionaryService = require('../../src/services/dictionaryService');
const {
  wiktionarySerendipiteResponse,
  wiktionaryEmptyResponse,
  wiktionaryNoFrResponse,
  expectedSerendipiteParsed,
} = require('../fixtures/wiktionary');

describe('dictionaryService', () => {
  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      expect(dictionaryService.stripHtml('<i>hello</i> <b>world</b>')).toBe('hello world');
    });

    it('decodes common HTML entities', () => {
      expect(dictionaryService.stripHtml('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"');
    });

    it('collapses whitespace', () => {
      expect(dictionaryService.stripHtml('  too   many    spaces  ')).toBe('too many spaces');
    });

    it('returns empty string for non-string input', () => {
      expect(dictionaryService.stripHtml(null)).toBe('');
      expect(dictionaryService.stripHtml(undefined)).toBe('');
      expect(dictionaryService.stripHtml(42)).toBe('');
    });
  });

  describe('parseWiktionaryResponse', () => {
    it('parses a valid French response', () => {
      const result = dictionaryService.parseWiktionaryResponse(wiktionarySerendipiteResponse);
      expect(result).toEqual(expectedSerendipiteParsed);
    });

    it('returns empty array when fr key is missing', () => {
      expect(dictionaryService.parseWiktionaryResponse({})).toEqual([]);
      expect(dictionaryService.parseWiktionaryResponse(null)).toEqual([]);
    });

    it('returns empty array when fr is empty', () => {
      expect(dictionaryService.parseWiktionaryResponse(wiktionaryEmptyResponse)).toEqual([]);
    });

    it('skips entries without French definitions', () => {
      expect(dictionaryService.parseWiktionaryResponse(wiktionaryNoFrResponse)).toEqual([]);
    });

    it('skips definitions without a definition field', () => {
      const data = {
        fr: [
          {
            partOfSpeech: 'Verbe',
            definitions: [{ definition: 'valid' }, { examples: ['no def'] }, null],
          },
        ],
      };
      const result = dictionaryService.parseWiktionaryResponse(data);
      expect(result).toHaveLength(1);
      expect(result[0].definition).toBe('valid');
    });
  });

  describe('fetchDefinition', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns parsed definitions on 200 response', async () => {
      axios.get.mockResolvedValue({ status: 200, data: wiktionarySerendipiteResponse });
      const result = await dictionaryService.fetchDefinition('sérendipité');
      expect(result).toEqual(expectedSerendipiteParsed);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get.mock.calls[0][0]).toContain('s%C3%A9rendipit%C3%A9');
    });

    it('throws NOT_FOUND on 404 response', async () => {
      axios.get.mockResolvedValue({ status: 404, data: {} });
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
