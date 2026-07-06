/**
 * Config store seam — a small async key/value abstraction the pure request
 * handler depends on. Two implementations exist:
 *   - `MongoStore` (mongo-store.ts): the real backing collection, which
 *     AES-encrypts values at its own boundary so the DB holds only ciphertext.
 *   - `MemoryStore` (below): an in-memory twin for tests and stub/dev runs.
 *
 * The handler always works with plaintext strings; encryption-at-rest is a
 * MongoStore concern, which is why MemoryStore can store values verbatim.
 */
export interface HubStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
  /** Keys with a given prefix — used to bust `cache:*` on connect/disconnect. */
  keys(prefix: string): Promise<string[]>;
}

export async function getJSON<T>(
  store: HubStore,
  key: string,
): Promise<T | null> {
  const raw = await store.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJSON(
  store: HubStore,
  key: string,
  value: unknown,
): Promise<void> {
  await store.set(key, JSON.stringify(value));
}

/** Delete every key under a prefix (cache invalidation). */
export async function delPrefix(
  store: HubStore,
  prefix: string,
): Promise<void> {
  const keys = await store.keys(prefix);
  await Promise.all(keys.map((k) => store.del(k)));
}

/** In-memory store — tests and stub-data dev runs. */
export class MemoryStore implements HubStore {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(prefix: string): Promise<string[]> {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}
