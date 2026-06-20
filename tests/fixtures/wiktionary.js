const wiktionarySerendipiteWikitext = `== {{langue|fr}} ==
=== {{S|nom|fr}} ===
'''sérendipité''' {{f}}
# ''Capacité'' de faire des découvertes par hasard.
#* {{exemple|lang=fr|La sérendipité a mené à plusieurs découvertes scientifiques.}}
# Une découverte heureuse et inattendue.
`;

// Simulates a successful API response from fr.wiktionary.org/w/api.php
const wiktionarySerendipiteResponse = {
  parse: {
    wikitext: { '*': wiktionarySerendipiteWikitext },
  },
};

// French section exists but contains only non-definition sections
const wiktionaryEmptyResponse = {
  parse: {
    wikitext: { '*': '== {{langue|fr}} ==\n=== {{S|étymologie}} ===\n: Du latin.\n' },
  },
};

// No French section at all
const wiktionaryNoFrResponse = {
  parse: {
    wikitext: { '*': '== {{langue|en}} ==\n=== {{S|nom|en}} ===\n# An English noun.\n' },
  },
};

// API error for a missing page
const wiktionaryMissingResponse = {
  error: { code: 'missingtitle', info: "The page you specified doesn't exist." },
};

const expectedSerendipiteParsed = [
  {
    partOfSpeech: 'Nom commun',
    definition: 'Capacité de faire des découvertes par hasard.',
    examples: ['La sérendipité a mené à plusieurs découvertes scientifiques.'],
  },
  {
    partOfSpeech: 'Nom commun',
    definition: 'Une découverte heureuse et inattendue.',
    examples: [],
  },
];

module.exports = {
  wiktionarySerendipiteWikitext,
  wiktionarySerendipiteResponse,
  wiktionaryEmptyResponse,
  wiktionaryNoFrResponse,
  wiktionaryMissingResponse,
  expectedSerendipiteParsed,
};
