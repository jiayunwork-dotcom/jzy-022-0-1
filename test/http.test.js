import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';

let base;
let server;

before(async () => {
  server = http.createServer(createApp());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function post(path, body) {
  const res = await fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const get = async (path) => {
  const res = await fetch(new URL(path, base));
  return { status: res.status, json: await res.json() };
};

describe('HTTP API', () => {
  test('GET /health', async () => {
    const r = await get('/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.status, 'ok');
  });

  test('GET /presets lists the n=7 demo with its polynomials', async () => {
    const r = await get('/presets');
    assert.equal(r.status, 200);
    const names = r.json.presets.map((p) => p.name);
    assert.ok(names.includes('gold-n7-demo'));
    const demo = r.json.presets.find((p) => p.name === 'gold-n7-demo');
    assert.equal(demo.n, 7);
    assert.equal(demo.N, 127);
    assert.equal(demo.polynomialA.mask, '0x89');
    assert.equal(demo.polynomialB.mask, '0x8F');
  });

  test('POST /reconcile by preset: qualified with pinned three-value set', async () => {
    const r = await post('/reconcile', { preset: 'gold-n7-demo' });
    assert.equal(r.status, 200);
    assert.equal(r.json.N, 127);
    assert.deepEqual(r.json.threeValueSet.values, [-1, 15, -17]);
    assert.equal(r.json.qualified, true);
    assert.equal(r.json.audit.zeroShiftValue, 127);
    assert.equal(r.json.audit.outOfRangeShifts.length, 0);
  });

  test('POST /reconcile with explicit polynomials: qualified', async () => {
    const r = await post('/reconcile', {
      n: 7,
      polynomialA: 'x^7+x^3+1',
      polynomialB: '0x8f',
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.qualified, true);
    assert.equal(r.json.source, 'inline');
  });

  test('unknown preset -> 404 UNKNOWN_PRESET with typed body', async () => {
    const r = await post('/reconcile', { preset: 'nope' });
    assert.equal(r.status, 404);
    assert.equal(r.json.error, 'UNKNOWN_PRESET');
    assert.ok(Array.isArray(r.json.details.known));
  });

  test('non-primitive polynomial -> 422 NOT_PRIMITIVE', async () => {
    const r = await post('/reconcile', { n: 7, polynomialA: '0xc5', polynomialB: '0x8f' });
    assert.equal(r.status, 422);
    assert.equal(r.json.error, 'NOT_PRIMITIVE');
  });

  test('non-preferred pair -> 422 NOT_PREFERRED_PAIR and observed values reported', async () => {
    const r = await post('/reconcile', { n: 7, polynomialA: '0x83', polynomialB: '0x9d' });
    assert.equal(r.status, 422);
    assert.equal(r.json.error, 'NOT_PREFERRED_PAIR');
    assert.deepEqual(r.json.details.expectedThreeValueSet, [-1, 15, -17]);
    assert.ok(r.json.details.observedCrossCorrelation.length !== 3);
  });

  test('even n -> 422 EVEN_DEGREE', async () => {
    const r = await post('/reconcile', { n: 8, polynomialA: '0x11d', polynomialB: '0x171' });
    assert.equal(r.status, 422);
    assert.equal(r.json.error, 'EVEN_DEGREE');
  });

  test('out-of-range odd n -> 422 DEGREE_OUT_OF_RANGE', async () => {
    const r = await post('/reconcile', { n: 5, polynomialA: 'x', polynomialB: 'x' });
    assert.equal(r.status, 422);
    assert.equal(r.json.error, 'DEGREE_OUT_OF_RANGE');
  });

  test('empty polynomial -> 400 EMPTY_POLYNOMIAL', async () => {
    const r = await post('/reconcile', { n: 7, polynomialA: '   ', polynomialB: '0x8f' });
    assert.equal(r.status, 400);
    assert.equal(r.json.error, 'EMPTY_POLYNOMIAL');
  });

  test('bad body -> 400 INVALID_REQUEST', async () => {
    const r1 = await post('/reconcile', {});
    assert.equal(r1.status, 400);
    assert.equal(r1.json.error, 'INVALID_REQUEST');
    const r2 = await post('/reconcile', { preset: 'gold-n7-demo', n: 7 });
    assert.equal(r2.status, 400);
    assert.equal(r2.json.error, 'INVALID_REQUEST');
  });

  test('concurrency: many simultaneous reconciliations stay isolated', async () => {
    // One qualified preset and several deliberately bad requests in flight at
    // once; every answer must correspond to its own inputs (no residue from a
    // sibling request's family or correlation values).
    const jobs = [];
    for (let i = 0; i < 4; i += 1) jobs.push(post('/reconcile', { preset: 'gold-n7-demo' }));
    jobs.push(post('/reconcile', { preset: 'does-not-exist' }));
    jobs.push(post('/reconcile', { n: 7, polynomialA: '0x83', polynomialB: '0x9d' }));
    jobs.push(post('/reconcile', { n: 7, polynomialA: '0xc5', polynomialB: '0x8f' }));
    jobs.push(post('/reconcile', { n: 5, polynomialA: 'x', polynomialB: 'x' }));
    jobs.push(post('/reconcile', { n: 7, polynomialA: 'x^7+x^3+1', polynomialB: 'x^7+x^3+x^2+x+1' }));

    const results = await Promise.all(jobs);
    const good = results.filter((r) => r.status === 200);
    assert.equal(good.length, 5); // 4 presets + 1 inline preferred pair
    for (const r of good) {
      assert.equal(r.json.qualified, true);
      assert.equal(r.json.N, 127);
      assert.deepEqual(r.json.threeValueSet.values, [-1, 15, -17]);
      assert.equal(r.json.audit.outOfRangeShifts.length, 0);
    }
    const codes = results
      .filter((r) => r.status !== 200)
      .map((r) => r.json.error)
      .sort();
    assert.deepEqual(
      codes,
      ['DEGREE_OUT_OF_RANGE', 'NOT_PREFERRED_PAIR', 'NOT_PRIMITIVE', 'UNKNOWN_PRESET'].sort()
    );
  });

  test('repeated preset reconciliations are independent and identical', async () => {
    const [r1, r2, r3] = await Promise.all([
      post('/reconcile', { preset: 'gold-n7-demo' }),
      post('/reconcile', { preset: 'gold-n7-demo' }),
      post('/reconcile', { preset: 'gold-n7-demo' }),
    ]);
    for (const r of [r1, r2, r3]) {
      assert.equal(r.json.family.size, 129);
      assert.equal(r.json.audit.zeroShiftEqualsNForAllMembers, true);
    }
    assert.deepEqual(r1.json, r2.json);
    assert.deepEqual(r2.json, r3.json);
  });
});
