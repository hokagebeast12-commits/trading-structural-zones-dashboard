import type { LivePriceSnapshot, SymbolCode } from "./types";

interface ExtractedQuote {
  bid?: number | null;
  ask?: number | null;
  last?: number | null;
}

type ProviderJson = Record<string, unknown>;

/**
 * Map our internal symbol codes to whatever the live-price API expects.
 * Adjust these values to match your provider's tickers.
 */
const SYMBOL_TO_TICKER: Record<SymbolCode, string> = {
  XAUUSD: "XAUUSD",
  EURUSD: "EURUSD",
  GBPUSD: "GBPUSD",
  GBPJPY: "GBPJPY",
};

function parseNumber(candidate: unknown): number | null {
  if (typeof candidate === "number" && Number.isFinite(candidate)) {
    return candidate;
  }
  if (typeof candidate === "string" && candidate.trim()) {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractQuote(json: ProviderJson): ExtractedQuote | null {
  const nestedQuote =
    (json?.data as ProviderJson | undefined)?.quotes ||
    (json?.quotes as unknown) ||
    (json?.data as ProviderJson | undefined)?.price;

  const quote = Array.isArray(nestedQuote) ? nestedQuote[0] : nestedQuote;

  if (!quote || typeof quote !== "object") {
    const flatPrice = parseNumber((json as ProviderJson)?.price);
    if (flatPrice != null) {
      return { last: flatPrice };
    }
    return null;
  }

  const bid = parseNumber((quote as ProviderJson).bid);
  const ask = parseNumber((quote as ProviderJson).ask);
  const last =
    parseNumber((quote as ProviderJson).mid) ??
    parseNumber((quote as ProviderJson).last) ??
    parseNumber((quote as ProviderJson).price);

  if (bid == null && ask == null && last == null) {
    return null;
  }

  return { bid, ask, last };
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.ok || res.status < 500 || attempt === maxAttempts) {
        return res;
      }

      const backoffMs = 150 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) {
        throw err;
      }
      const backoffMs = 150 * attempt;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError ?? new Error("Live price fetch failed");
}

/**
 * Fetch the current mid/last price for a symbol.
 * This implementation parses a nested provider payload and computes
 * a mid price when bid/ask are present.
 */
export async function getCurrentPrice(
  symbol: SymbolCode,
): Promise<LivePriceSnapshot> {
  const ticker = SYMBOL_TO_TICKER[symbol];

  const apiUrl = process.env.FX_API_URL;
  const apiKey = process.env.FX_API_KEY;

  if (!apiUrl || !apiKey) {
    const error = {
      code: "ENV_MISSING" as const,
      message: "FX_API_URL or FX_API_KEY not set – live prices unavailable",
    };
    console.warn(error.message);
    return { spot: null, error };
  }

  const url = `${apiUrl}?symbol=${encodeURIComponent(
    ticker,
  )}&apikey=${encodeURIComponent(apiKey)}`;

  let res: Response;
  try {
    res = await fetchWithRetry(url, { cache: "no-store" });
  } catch (err) {
    return {
      spot: null,
      error: {
        code: "HTTP_ERROR",
        message: `Live price request failed for ${symbol}`,
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (!res.ok) {
    return {
      spot: null,
      error: {
        code: "HTTP_ERROR",
        message: `Live price request failed for ${symbol}: ${res.status}`,
      },
    };
  }

  let json: ProviderJson;
  try {
    json = (await res.json()) as ProviderJson;
  } catch (err) {
    return {
      spot: null,
      error: {
        code: "PARSE_ERROR",
        message: `Unable to parse live price JSON for ${symbol}`,
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const quote = extractQuote(json);
  if (!quote) {
    return {
      spot: null,
      error: {
        code: "NO_TICK",
        message: `No quote data returned for ${symbol}`,
        details: json,
      },
    };
  }

  const { bid, ask, last } = quote;
  const mid =
    bid != null && ask != null
      ? (bid + ask) / 2
      : ask != null
        ? ask
        : bid != null
          ? bid
          : last ?? null;

  if (mid == null || Number.isNaN(mid)) {
    return {
      spot: null,
      error: {
        code: "PARSE_ERROR",
        message: `Unable to derive price for ${symbol}`,
        details: quote,
      },
    };
  }

  return { spot: mid, source: "live" };
}
