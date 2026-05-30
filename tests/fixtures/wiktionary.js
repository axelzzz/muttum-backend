const wiktionarySerendipiteResponse = {
  fr: [
    {
      partOfSpeech: 'Nom commun',
      language: 'French',
      definitions: [
        {
          definition: '<i>Capacité</i> de faire des découvertes par hasard.',
          examples: ['<i>La sérendipité a mené à plusieurs découvertes scientifiques.</i>'],
        },
        {
          definition: 'Une découverte heureuse et inattendue.',
          examples: [],
        },
      ],
    },
  ],
};

const wiktionaryEmptyResponse = { fr: [] };

const wiktionaryNoFrResponse = { en: [{ partOfSpeech: 'Noun', definitions: [] }] };

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
  wiktionarySerendipiteResponse,
  wiktionaryEmptyResponse,
  wiktionaryNoFrResponse,
  expectedSerendipiteParsed,
};
