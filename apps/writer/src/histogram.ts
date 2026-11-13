/**
 * Every latency histogram is stored on one canonical set of bucket bounds, in
 * milliseconds, so data from different SDKs and from spanmetrics can be summed.
 * The last slot counts everything above the highest bound.
 */
export const BOUNDS_MS: readonly number[] = [5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000];
export const BUCKET_COUNT = BOUNDS_MS.length + 1;

export function emptyBuckets(): number[] {
  return new Array(BUCKET_COUNT).fill(0);
}

function canonicalIndex(valueMs: number): number {
  const index = BOUNDS_MS.findIndex(bound => valueMs <= bound);
  return index === -1 ? BOUNDS_MS.length : index;
}

/**
 * Maps a source histogram onto the canonical buckets. Each source bucket is
 * attributed to the canonical bucket holding its upper bound, which can shift a
 * value up by at most one canonical bucket.
 */
export function rebucket(
  counts: readonly number[],
  boundsMs: readonly number[],
  sumMs: number,
  total: number,
): number[] {
  const out = emptyBuckets();

  if (boundsMs.length === 0) {
    // No bounds means a single bucket; the mean is the best position we have.
    if (total > 0) out[canonicalIndex(sumMs / total)] += total;
    return out;
  }

  counts.forEach((count, i) => {
    if (!count) return;
    const upper = i < boundsMs.length ? (boundsMs.at(i) ?? Infinity) : Infinity;
    out[canonicalIndex(upper)] += count;
  });

  return out;
}

export function addBuckets(a: readonly number[], b: readonly number[]): number[] {
  return a.map((value, i) => value + (b.at(i) ?? 0));
}

/** Linear interpolation inside the bucket that holds the requested rank. */
export function percentile(counts: readonly number[], q: number): number | null {
  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return null;

  const rank = q * total;
  let cumulative = 0;

  for (let i = 0; i < counts.length; i++) {
    const count = counts.at(i) ?? 0;
    if (count > 0 && cumulative + count >= rank) {
      if (i >= BOUNDS_MS.length) return BOUNDS_MS.at(-1) ?? null;
      const lower = i === 0 ? 0 : (BOUNDS_MS.at(i - 1) ?? 0);
      const upper = BOUNDS_MS.at(i) ?? lower;
      return lower + (upper - lower) * ((rank - cumulative) / count);
    }
    cumulative += count;
  }

  return BOUNDS_MS.at(-1) ?? null;
}
