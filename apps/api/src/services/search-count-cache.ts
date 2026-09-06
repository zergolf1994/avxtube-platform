// Only counts are cached. Search rows and publication/visibility checks stay live.
// A short TTL bounds count staleness; the entry limit also bounds unique-query spam.
export class SearchCountCache {
  private readonly entries = new Map<
    string,
    { expiresAt: number; value: Promise<number> }
  >()

  constructor(
    private readonly ttlMs = 30_000,
    private readonly maxEntries = 128,
    private readonly now = Date.now
  ) {}

  getOrLoad(key: string, load: () => Promise<number>): Promise<number> {
    const cached = this.entries.get(key)
    if (cached && cached.expiresAt > this.now()) return cached.value
    this.entries.delete(key)
    const entry = {
      expiresAt: Infinity,
      value: Promise.resolve().then(load),
    }
    entry.value = entry.value.then(
      (count) => {
        entry.expiresAt = this.now() + this.ttlMs
        return count
      },
      (error: unknown) => {
        if (this.entries.get(key) === entry) this.entries.delete(key)
        throw error
      }
    )
    this.entries.set(key, entry)
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest === undefined) break
      this.entries.delete(oldest)
    }
    return entry.value
  }
}
