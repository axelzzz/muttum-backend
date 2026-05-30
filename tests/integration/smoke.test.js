const request = require('supertest');
const createApp = require('../../src/app');

const app = createApp();

describe('Smoke tests', () => {
  it('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /unknown returns 404', async () => {
    const res = await request(app).get('/whatever-not-mapped');
    expect(res.status).toBe(404);
  });
});
