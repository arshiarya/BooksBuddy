const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

describe('Server Base & Health Check (Phase 1)', () => {
  test('GET /health returns 200 with status ok and service info', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'booksbuddy-server');
    assert.ok(res.body.timestamp);
    assert.ok(typeof res.body.uptime === 'number');
  });

  test('GET /api/v1 returns API root metadata', async () => {
    const res = await request(app).get('/api/v1');
    assert.equal(res.status, 200);
    assert.equal(res.body.name, 'BooksBuddy API');
  });

  test('GET /unknown-route returns 404 with structured error', async () => {
    const res = await request(app).get('/unknown-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.statusCode, 404);
    assert.ok(res.body.error.message.includes('not found'));
  });
});
