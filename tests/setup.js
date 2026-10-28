import { beforeEach } from "vitest";

// A tiny in-memory localStorage, reset before every test. The app reads and
// writes it directly (storage.js, periodMode.js, currency.js ...), and Node
// doesn't have one. A Map keeps it dependency-free (no jsdom).
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
  // The "not configured" warning from supabaseClient.js is expected in tests.
});
