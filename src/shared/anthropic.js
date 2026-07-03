// Personal API key, stored client-side only — deliberately kept out of the
// Supabase-bound storage adapter so a future sync pass never uploads it.
const KEY_STORAGE_KEY = "architect:anthropic_api_key";

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE_KEY) || "";
}

export function setApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE_KEY, key);
  else localStorage.removeItem(KEY_STORAGE_KEY);
}

export async function callClaude({ system, messages, maxTokens = 1000 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("No Anthropic API key set. Add one in Settings.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}
