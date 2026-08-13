import swaggerJsdoc from 'swagger-jsdoc';

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
        Definition: {
          type: 'object',
          properties: {
            partOfSpeech: { type: 'string', example: 'nom' },
            definition: { type: 'string', example: 'Meuble à quatre pieds.' },
            example: { type: 'string', nullable: true },
          },
        },
        UserWord: {
          type: 'object',
          description: 'Flat projection returned by list / getOne / update endpoints',
          properties: {
            id: { type: 'string' },
            word: { type: 'string', example: 'bonjour' },
            definitions: { type: 'array', items: { $ref: '#/components/schemas/Definition' } },
            firstSearchedAt: { type: 'string', format: 'date-time' },
            lastSearchedAt: { type: 'string', format: 'date-time' },
            searchCount: { type: 'integer', example: 3 },
            notes: { type: 'string', example: 'Salutation courante' },
            tags: { type: 'array', items: { type: 'string' }, example: ['greetings'] },
            favorite: { type: 'boolean', example: false },
          },
        },
        SearchResult: {
          type: 'object',
          description: 'Response from the search endpoint — includes word metadata and user-list context',
          properties: {
            id: { type: 'string', description: 'UserWord document id, usable for the /words/:id routes' },
            word: { type: 'string', example: 'chaise' },
            wordId: { type: 'string', description: 'Word document id' },
            definitions: { type: 'array', items: { $ref: '#/components/schemas/Definition' } },
            source: { type: 'string', enum: ['wiktionary', 'larousse', 'lerobert', 'manual'] },
            fromCache: { type: 'boolean' },
            alreadyInList: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Not found' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 42 },
            pages: { type: 'integer', example: 3 },
          },
        },
        UserWordList: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { $ref: '#/components/schemas/UserWord' } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
        DeleteResult: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '12' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
});

export default spec;
