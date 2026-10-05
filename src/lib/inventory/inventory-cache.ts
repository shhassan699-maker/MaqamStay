import "server-only";
type Entry = { etag: string; body: unknown; checkedAt: number };
const entries = new Map<string, Entry>();
// Bodies are reused only after origin 304 validation. No stale-while-error fallback.
export function readCatalogCache(key: string) {
  const entry = entries.get(key);
  if (entry && Date.now() - entry.checkedAt < 60000) return entry;
  entries.delete(key);
}
export function writeCatalogCache(
  key: string,
  etag: string | null,
  body: unknown,
) {
  entries.delete(key);
  if (!etag || etag.length > 256) return;
  if (entries.size >= 100) entries.delete(entries.keys().next().value!);
  entries.set(key, { etag, body, checkedAt: Date.now() });
}
export function evictCatalogCache(key: string) {
  entries.delete(key);
}
