let lastOpenAiIndex = -1;

export function getRotatingOpenAiKey(config) {
  const keys = config?.openai?.keys || [];
  if (!keys.length) return "";
  if (keys.length === 1) return keys[0];

  // Pick a different key than the last request where possible. This is local
  // rate-limit smoothing for keys owned by the developer, not public-key abuse.
  let next = Math.floor(Math.random() * keys.length);
  if (next === lastOpenAiIndex) next = (next + 1) % keys.length;
  lastOpenAiIndex = next;
  return keys[next];
}

export function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return "***";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
