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
  /** 访问顺序（最近使用的在末尾）。 */
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
      this._removeFromOrder(keyStr);
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
    this._removeFromOrder(keyStr);
  }

  /**
   * 按条件删除。
   *
   * 只移除命中的条目，并保留其余条目的 LRU 顺序
   * （早期实现会清空整个 accessOrder，导致后续淘汰顺序失真）。
   */
  deleteWhere(predicate: (key: unknown) => boolean): void {
    const removed: string[] = [];
    for (const [keyStr, entry] of this.store) {
      if (predicate(this._stringToKey(keyStr))) {
        removed.push(keyStr);
      }
    }
    for (const keyStr of removed) {
      this.store.delete(keyStr);
      this._removeFromOrder(keyStr);
    }
  }

  /** 清空所有缓存。 */
  clear(): void {
    this.store.clear();
    this.accessOrder = [];
  }

  /** 当前条目数。 */
  get size(): number {
    return this.store.size;
  }

  private _touch(keyStr: string): void {
    this._removeFromOrder(keyStr);
    this.accessOrder.push(keyStr);
  }

  /** 从访问顺序中移除某个 key（保持其余顺序不变）。 */
  private _removeFromOrder(keyStr: string): void {
    const idx = this.accessOrder.indexOf(keyStr);
    if (idx >= 0) {
      this.accessOrder.splice(idx, 1);
    }
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
