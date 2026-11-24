/**
 * In-memory LRU cache with two horizons: entries are "fresh" for freshMs and
 * kept as "stale" fallbacks until staleMs. Per server instance; Phase 5 adds a
 * Postgres snapshot table so published cards survive cold starts.
 */
export type CacheHit<T> = { value: T; fresh: boolean; storedAt: number };

export class TtlCache<T> {
  private map = new Map<string, { value: T; storedAt: number }>();

  constructor(
    private readonly freshMs: number,
    private readonly staleMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): CacheHit<T> | null {
    const e = this.map.get(key);
    if (!e) return null;
    const age = this.now() - e.storedAt;
    if (age > this.staleMs) {
      this.map.delete(key);
      return null;
    }
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, e);
    return { value: e.value, fresh: age <= this.freshMs, storedAt: e.storedAt };
  }

  set(key: string, value: T) {
    this.map.delete(key);
    this.map.set(key, { value, storedAt: this.now() });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}
