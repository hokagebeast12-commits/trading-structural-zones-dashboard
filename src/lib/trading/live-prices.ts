import type { SymbolCode } from "./types";

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

/**
 * Fetch the current mid/last price for a symbol.
 * You will need to adapt the URL and JSON parsing to your data provider.
 */
export async function getCurrentPrice(
  symbol: SymbolCode,
): Promise<number | null> {
  const ticker = SYMBOL_TO_TICKER[symbol];

  const apiUrl = process.env.FX_API_URL;
  const apiKey = process.env.FX_API_KEY;

  if (!apiUrl || !apiKey) {
    console.warn("FX_API_URL or FX_API_KEY not set – live prices disabled");
    return null;
  }

  const url = `${apiUrl}?symbol=${encodeURIComponent(
    ticker,
  )}&apikey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(`Live price request failed for ${symbol}:`, res.status);
    return null;
  }

  const json = await res.json();

  // TODO: adapt this to your provider's JSON structure.
  // For example, if the response is { price: "2350.24" }:
  const price = parseFloat(json.price);

  if (Number.isNaN(price)) {
    console.error("Live price parse failed for", symbol, json);
    return null;
  }

  return price;
}
