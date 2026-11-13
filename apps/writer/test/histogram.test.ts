import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addBuckets, BOUNDS_MS, BUCKET_COUNT, emptyBuckets, percentile, rebucket } from '../src/histogram.ts';

describe('rebucket', () => {
  it('maps OTel SDK second-based bounds onto millisecond buckets', () => {
    // Default http.server.request.duration bounds, converted from seconds to ms.
    const bounds = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10].map(s => s * 1000);
    const counts = [1, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 1];
    const out = rebucket(counts, bounds, 0, 7);
    assert.equal(out.length, BUCKET_COUNT);
    assert.equal(out[0], 1); // <= 5 ms
    assert.equal(out[1], 2); // <= 10 ms
    assert.equal(out[5], 3); // <= 100 ms
    assert.equal(out[BOUNDS_MS.length], 1); // > 10 s
  });

  it('uses the mean when the source has no bounds', () => {
    const out = rebucket([4], [], 4 * 60, 4);
    assert.equal(out[4], 4); // mean 60 ms lands in (50, 75]
  });

  it('keeps the total count', () => {
    const counts = [5, 0, 7, 9, 1];
    const out = rebucket(counts, [3, 30, 300, 3000], 0, 22);
    assert.equal(out.reduce((a, b) => a + b, 0), 22);
  });
});

describe('percentile', () => {
  it('returns null for an empty histogram', () => {
    assert.equal(percentile(emptyBuckets(), 0.5), null);
  });

  it('interpolates inside the bucket that holds the rank', () => {
    const counts = emptyBuckets();
    counts[5] = 100; // all requests in (75, 100] ms
    assert.equal(percentile(counts, 0.5), 87.5);
    assert.equal(percentile(counts, 0.95), 98.75);
  });

  it('reports the top bound for the overflow bucket', () => {
    const counts = emptyBuckets();
    counts[BOUNDS_MS.length] = 3;
    assert.equal(percentile(counts, 0.99), 10000);
  });

  it('sums bucket arrays element-wise', () => {
    assert.deepEqual(addBuckets([1, 2, 3], [4, 5, 6]), [5, 7, 9]);
  });
});
