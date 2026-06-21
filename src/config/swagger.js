const swaggerJsdoc = require('swagger-jsdoc');

const spec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Muttum API',
      version: '1.0.0',
      description: 'French dictionary app API',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '64a1b2c3d4e5f6a7b8c9d0e1' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            username: { type: 'string', example: 'alice' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          },
        },
        WordDefinition: {
          type: 'object',
          properties: {
            partOfSpeech: { type: 'string', example: 'nom' },
            definitions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  definition: { type: 'string' },
                  examples: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        Word: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            word: { type: 'string', example: 'bonjour' },
            definitions: { type: 'array', items: { $ref: '#/components/schemas/WordDefinition' } },
            fetchedAt: { type: 'string', format: 'date-time' },
          },
        },
        UserWord: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            wordId: { $ref: '#/components/schemas/Word' },
            notes: { type: 'string', example: 'Common greeting' },
            tags: { type: 'array', items: { type: 'string' }, example: ['greetings'] },
            favorite: { type: 'boolean', example: false },
            searchCount: { type: 'integer', example: 3 },
            firstSearchedAt: { type: 'string', format: 'date-time' },
            lastSearchedAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Not found' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
});

module.exports = spec;
