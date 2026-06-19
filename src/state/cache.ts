/**
 * 带 TTL 的 LRU 缓存（对齐 Python SDK TTLCache）。
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class TTLCache<V> {
  private maxEntries: number;
  private ttl: number; // 秒
  private store: Map<string, CacheEntry<V>>;
  private accessOrder: string[];

  constructor(maxEntries: number = 5000, ttl: number = 1800) {
    this.maxEntries = maxEntries;
    this.ttl = ttl;
    this.store = new Map();
    this.accessOrder = [];
  }

  /** 获取缓存值，过期返回 undefined。 */
  get(key: unknown): V | undefined {
    const keyStr = this._keyToString(key);
    const entry = this.store.get(keyStr);
    if (!entry) return undefined;
    if (Date.now() / 1000 > entry.expiresAt) {
      this.store.delete(keyStr);
      return undefined;
    }
    // 更新访问顺序
    this._touch(keyStr);
    return entry.value;
  }

  /** 设置缓存值。 */
  set(key: unknown, value: V): void {
    const keyStr = this._keyToString(key);
    this.store.set(keyStr, {
      value,
      expiresAt: Date.now() / 1000 + this.ttl,
    });
    this._touch(keyStr);
    this._evictIfNeeded();
  }

  /** 删除缓存条目。 */
  delete(key: unknown): void {
    const keyStr = this._keyToString(key);
    this.store.delete(keyStr);
    this.accessOrder = this.accessOrder.filter((k) => k !== keyStr);
  }

  /** 按条件删除。 */
  deleteWhere(predicate: (key: unknown) => boolean): void {
    for (const [keyStr] of this.store) {
      if (predicate(this._stringToKey(keyStr))) {
        this.store.delete(keyStr);
      }
    }
    this.accessOrder = [];
  }

  /** 清空所有缓存。 */
  clear(): void {
    this.store.clear();
    this.accessOrder = [];
  }

  private _touch(keyStr: string): void {
    this.accessOrder = this.accessOrder.filter((k) => k !== keyStr);
    this.accessOrder.push(keyStr);
  }

  private _evictIfNeeded(): void {
    while (this.store.size > this.maxEntries && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!;
      this.store.delete(oldest);
    }
  }

  private _keyToString(key: unknown): string {
    if (typeof key === "string") return key;
    return JSON.stringify(key);
  }

  private _stringToKey(keyStr: string): unknown {
    try {
      return JSON.parse(keyStr);
    } catch {
      return keyStr;
    }
  }
}
