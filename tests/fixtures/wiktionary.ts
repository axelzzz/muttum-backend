import type { Definition } from '../../src/types';

export const wiktionarySerendipiteWikitext = `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
'''sérendipité''' {{f}}
# ''Capacité'' de faire des découvertes par hasard.
#* {{exemple|lang=fr|La sérendipité a mené à plusieurs découvertes scientifiques.}}
# Une découverte heureuse et inattendue.
`;

// Simulates a successful API response from fr.wiktionary.org/w/api.php
export const wiktionarySerendipiteResponse = {
  parse: {
    wikitext: { '*': wiktionarySerendipiteWikitext },
  },
};

// French section exists but contains only non-definition sections
export const wiktionaryEmptyResponse = {
  parse: {
    wikitext: { '*': '== {{langue|fr}} ==\n=== {{S|étymologie}} ===\n: Du latin.\n' },
  },
};

// No French section at all
export const wiktionaryNoFrResponse = {
  parse: {
    wikitext: { '*': '== {{langue|en}} ==\n=== {{S|nom|en}} ===\n# An English noun.\n' },
  },
};

// API error for a missing page
export const wiktionaryMissingResponse = {
  error: { code: 'missingtitle', info: "The page you specified doesn't exist." },
};

export const expectedSerendipiteParsed: Definition[] = [
  {
    partOfSpeech: 'Nom commun',
    definition: 'Capacité de faire des découvertes par hasard.',
    example: 'La sérendipité a mené à plusieurs découvertes scientifiques.',
  },
  {
    partOfSpeech: 'Nom commun',
    definition: 'Une découverte heureuse et inattendue.',
    example: null,
  },
];
