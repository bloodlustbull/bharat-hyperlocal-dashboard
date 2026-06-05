import { readFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const KEY_PATTERNS = {
  openai: /^sk-[A-Za-z0-9_-]{20,}$/,
  generic: /^[A-Za-z0-9._:/+=-]{12,}$/
};

function parseDotenv(text) {
  const values = {};
  text.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  });
  return values;
}

function splitKeyList(value) {
  return String(value || "")
    .split(/[\n,;]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function validateKeys(keys, pattern) {
  return keys.filter(key => pattern.test(key));
}

async function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const text = await readFile(file, "utf8");
  const parsed = parseDotenv(text);

  // Best effort local-only hardening. On Windows this may be a no-op for ACLs,
  // but on Unix-like systems it prevents other users from reading the file.
  try {
    await chmod(file, 0o600);
  } catch {
    // Keep startup resilient; permissions differ across OS/filesystems.
  }

  return parsed;
}

export async function loadSecureConfig({ root = process.cwd() } = {}) {
  const envFiles = [path.join(root, ".env.local"), path.join(root, ".env")];
  for (const file of envFiles) {
    const parsed = await loadEnvFile(file);
    Object.entries(parsed).forEach(([key, value]) => {
      if (!process.env[key]) process.env[key] = value;
    });
  }

  const openAiKeys = validateKeys(
    [...splitKeyList(process.env.OPENAI_API_KEYS), ...splitKeyList(process.env.OPENAI_API_KEY)],
    KEY_PATTERNS.openai
  );

  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const baseHost = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return "";
    }
  })();

  const customBaseUrlAllowed = process.env.ALLOW_CUSTOM_OPENAI_BASE_URL === "true";
  if (baseHost && baseHost !== "api.openai.com" && !customBaseUrlAllowed) {
    throw new Error("Custom OPENAI_BASE_URL is blocked. Set ALLOW_CUSTOM_OPENAI_BASE_URL=true only for a provider/proxy you own and trust.");
  }

  return {
    llmProvider: process.env.LLM_PROVIDER || (openAiKeys.length ? "openai" : "ollama"),
    openai: {
      keys: openAiKeys,
      model: process.env.OPENAI_MODEL || "gpt-5",
      baseUrl,
      baseHost,
      customBaseUrlAllowed
    },
    ollama: {
      enabled: process.env.OLLAMA_ENABLED !== "false",
      model: process.env.OLLAMA_MODEL || "llama3.1:8b",
      baseUrl: (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "")
    },
    providers: {
      openai: openAiKeys.length > 0,
      ollama: process.env.OLLAMA_ENABLED !== "false",
      tavily: Boolean(process.env.TAVILY_API_KEY),
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
      apify: Boolean(process.env.APIFY_TOKEN),
      brightData: Boolean(process.env.BRIGHT_DATA_API_KEY || process.env.BRIGHTDATA_API_KEY),
      googleAds: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN),
      meta: Boolean(process.env.META_ACCESS_TOKEN || process.env.SEARCHAPI_API_KEY),
      whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN || process.env.TWILIO_AUTH_TOKEN),
      reddit: true,
      googleNews: true,
      googleTrends: true,
      pageFetch: true
    },
    keyCounts: {
      openai: openAiKeys.length
    }
  };
}

export function getProviderStatus(config) {
  return config.providers;
}

export function getOpenAiConfig(config) {
  return config.openai;
}
