// Swap `storage` for a Supabase-backed adapter later — same 4 methods, nothing else changes.
const PREFIX = "architect:";

export const localStorageAdapter = {
  async get(key) {
    return localStorage.getItem(PREFIX + key);
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
  },
  async remove(key) {
    localStorage.removeItem(PREFIX + key);
  },
  async list() {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .map((k) => k.slice(PREFIX.length));
  },
};

export const storage = localStorageAdapter;
