/**
 * Token-bucket rate limiter. Used twice:
 *  - outgoing: keeps our calls to osu! well under its limits (osu! asks API
 *    consumers to stay around 60 requests/minute);
 *  - incoming: per-IP limit on our public player search endpoint.
 * In-memory, so limits apply per server instance.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  private refill() {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.refillPerSecond);
    this.last = t;
  }

  /** Take one token. Returns 0 on success, or seconds until one is available. */
  take(): number {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return 0;
    }
    return Math.ceil((1 - this.tokens) / this.refillPerSecond);
  }
}

/** Keyed buckets (e.g. per client IP) with idle eviction. */
export class KeyedLimiter {
  private buckets = new Map<string, { bucket: TokenBucket; seen: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly maxKeys = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): number {
    let entry = this.buckets.get(key);
    if (!entry) {
      if (this.buckets.size >= this.maxKeys) {
        const oldest = [...this.buckets.entries()].sort((a, b) => a[1].seen - b[1].seen).slice(0, Math.ceil(this.maxKeys / 10));
        for (const [k] of oldest) this.buckets.delete(k);
      }
      entry = { bucket: new TokenBucket(this.capacity, this.refillPerSecond, this.now), seen: this.now() };
      this.buckets.set(key, entry);
    }
    entry.seen = this.now();
    return entry.bucket.take();
  }
}
