'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

let server;
let base;

test.before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

const post = (path, body) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));

test('lists registered preferred-pair profiles', async () => {
  const res = await fetch(`${base}/api/gold/profiles`);
  assert.equal(res.status, 200);
  const { profiles } = await res.json();
  const names = profiles.map((p) => p.name);
  assert.ok(names.includes('gold-n7-demo'));
  const demo = profiles.find((p) => p.name === 'gold-n7-demo');
  assert.equal(demo.n, 7);
  assert.equal(demo.N, 127);
});

test('reconcile by profile name: demo pair is qualified', async () => {
  const { status, body } = await post('/api/gold/reconcile', { profile: 'gold-n7-demo' });
  assert.equal(status, 200);
  assert.equal(body.qualified, true);
  assert.equal(body.N, 127);
  assert.deepEqual(body.threeValueSet, [-17, -1, 15]);
  assert.equal(body.zeroShift, 127);
  assert.equal(body.totalViolations, 0);
  assert.equal(body.source.profile, 'gold-n7-demo');
});

test('reconcile with explicit polynomials', async () => {
  const { status, body } = await post('/api/gold/reconcile', {
    n: 7,
    polynomials: { first: { octal: '211' }, second: { octal: '217' } },
  });
  assert.equal(status, 200);
  assert.equal(body.qualified, true);
  assert.equal(body.N, 127);
});

test('unknown profile name is rejected with a typed error', async () => {
  const { status, body } = await post('/api/gold/reconcile', { profile: 'no-such-profile' });
  assert.equal(status, 404);
  assert.equal(body.error.type, 'UNKNOWN_PROFILE');
});

test('empty polynomial is rejected with a typed error', async () => {
  const { status, body } = await post('/api/gold/reconcile', {
    n: 7,
    polynomials: { first: {}, second: { octal: '217' } },
  });
  assert.equal(status, 400);
  assert.equal(body.error.type, 'EMPTY_POLYNOMIAL');
});

test('out-of-range and even degrees are rejected with typed errors', async () => {
  const small = await post('/api/gold/reconcile', {
    n: 3,
    polynomials: { first: { octal: '13' }, second: { octal: '15' } },
  });
  assert.equal(small.status, 400);
  assert.equal(small.body.error.type, 'N_OUT_OF_RANGE');

  const even = await post('/api/gold/reconcile', {
    n: 10,
    polynomials: { first: { octal: '2011' }, second: { octal: '2415' } },
  });
  assert.equal(even.status, 400);
  assert.equal(even.body.error.type, 'EVEN_DEGREE');
});

test('non-primitive polynomial is rejected with a typed error', async () => {
  const { status, body } = await post('/api/gold/reconcile', {
    n: 7,
    polynomials: { first: { octal: '377' }, second: { octal: '217' } },
  });
  assert.equal(status, 422);
  assert.equal(body.error.type, 'NOT_PRIMITIVE');
});

test('non-preferred pair is rejected with a typed error, never marked qualified', async () => {
  const { status, body } = await post('/api/gold/reconcile', {
    n: 7,
    polynomials: { first: { octal: '203' }, second: { octal: '235' } },
  });
  assert.equal(status, 422);
  assert.equal(body.error.type, 'NOT_PREFERRED_PAIR');
});

test('concurrent reconciliations stay isolated', async () => {
  const requests = [
    post('/api/gold/reconcile', { profile: 'gold-n7-demo' }),
    post('/api/gold/reconcile', { profile: 'gold-n5' }),
    post('/api/gold/reconcile', {
      n: 7,
      polynomials: { first: { octal: '211' }, second: { octal: '217' } },
    }),
    post('/api/gold/reconcile', {
      n: 5,
      polynomials: { first: { octal: '45' }, second: { octal: '75' } },
    }),
    post('/api/gold/reconcile', { profile: 'no-such-profile' }),
    post('/api/gold/reconcile', {
      n: 7,
      polynomials: { first: { octal: '203' }, second: { octal: '235' } },
    }),
  ];
  const results = await Promise.all(requests);

  assert.equal(results[0].body.N, 127);
  assert.equal(results[0].body.qualified, true);
  assert.deepEqual(results[0].body.threeValueSet, [-17, -1, 15]);

  assert.equal(results[1].body.N, 31);
  assert.equal(results[1].body.qualified, true);
  assert.deepEqual(results[1].body.threeValueSet, [-9, -1, 7]);

  assert.equal(results[2].body.N, 127);
  assert.equal(results[2].body.qualified, true);

  assert.equal(results[3].body.N, 31);
  assert.equal(results[3].body.qualified, true);

  assert.equal(results[4].status, 404);
  assert.equal(results[4].body.error.type, 'UNKNOWN_PROFILE');

  assert.equal(results[5].status, 422);
  assert.equal(results[5].body.error.type, 'NOT_PREFERRED_PAIR');
});
