/**
 * The band a price falls in, for analytics: `"5000-7500"` (cents, lower
 * bound included), never the price itself — a funnel needs the shape of
 * what was shown, not a number that, with a time and a place, singles a
 * visitor out.
 */
export const CENTS_BUCKETS: readonly number[] = [0, 2_500, 5_000, 7_500, 10_000, 15_000, 20_000, 30_000, 50_000, 100_000];

export function centsBucket(cents: number): string {
  let at = 0;
  for (let i = 0; i < CENTS_BUCKETS.length; i++) if (cents >= (CENTS_BUCKETS[i] ?? 0)) at = i;
  const low = CENTS_BUCKETS[at] ?? 0;
  const high = CENTS_BUCKETS[at + 1];
  return high === undefined ? `${low}+` : `${low}-${high}`;
}
