export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache {
  private map = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string) {
    this.map.delete(key);
  }

  deleteMany(keys: string[]) {
    for (const key of keys) this.map.delete(key);
  }
}

