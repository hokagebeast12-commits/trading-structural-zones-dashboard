import { getDailyOhlc } from "./data-provider";
import { classifyTrend } from "./trend-analysis";
import { findStructuralZones, createLiquidityMap } from "./zones";
import {
  generateModelATrades,
  generateModelBTrades,
  generateModelCTrades,
} from "./models";
import {
  SYMBOLS,
  SymbolCode,
  SymbolScanEntry,
  SymbolScanResult,
  ScanResponse,
  CONFIG,
  ScanOptions,
} from "./types";

export async function scanSymbol(
  symbol: SymbolCode,
  options?: ScanOptions,
): Promise<SymbolScanResult> {
  const lookbackDays = Math.max(
    1,
    options?.params?.structureLookback ?? CONFIG.lookback_days,
  );
  const atrWindow = Math.max(2, options?.params?.atrWindow ?? 20);
  const minRr = options?.filters?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.filters?.spreadCap;

  // Get enough data for all calculations
  const neededBars = Math.max(lookbackDays, atrWindow + 1, 2);
  const bars = await getDailyOhlc(symbol, neededBars);

  if (bars.length < neededBars) {
    throw new Error(
      `Insufficient data for ${symbol}: got ${bars.length}, need ${neededBars}`,
    );
  }

  // Analyze trend
  const { trend, location, atr20 } = classifyTrend(bars, {
    lookbackDays,
    atrWindow,
  });

  // Find structural zones
  const zones = findStructuralZones(bars, symbol, lookbackDays);

  // Create liquidity map
  const liquidity = createLiquidityMap(bars.slice(-lookbackDays));

  // Generate trades
  const tradeOptions = { minRr, spreadCap };
  const modelATrades = generateModelATrades(
    trend,
    zones,
    liquidity,
    bars,
    symbol,
    tradeOptions,
  );
  const modelBTrades = generateModelBTrades(
    trend,
    zones,
    liquidity,
    bars,
    symbol,
    tradeOptions,
  );
  const modelCTrades = generateModelCTrades(
    trend,
    liquidity,
    bars,
    symbol,
    tradeOptions,
  );
  const trades = [...modelATrades, ...modelBTrades, ...modelCTrades];

  return {
    kind: "ok",
    symbol,
    trend,
    atr20,
    location,
    zones,
    trades,
    // bars.length >= neededBars is guaranteed above, so this is safe
    lastClose: bars[bars.length - 1].close,
  };
}

export async function scanMarket(
  options?: ScanOptions,
): Promise<ScanResponse> {
  const scanDate =
    options?.date || new Date().toISOString().split("T")[0];

  const symbols: SymbolCode[] =
    options?.symbols && options.symbols.length > 0
      ? options.symbols
      : [...SYMBOLS];

  const results: Partial<Record<SymbolCode, SymbolScanEntry>> = {};

  const scanEntries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const entry = await scanSymbol(symbol, options);
        return { symbol, entry } as const;
      } catch (error) {
        console.error(`Error scanning ${symbol}:`, error);
        const message =
          error instanceof Error
            ? error.message
            : "Unexpected error while scanning";
        return {
          symbol,
          entry: { kind: "error" as const, symbol, error: message },
        } as const;
      }
    }),
  );

  for (const { symbol, entry } of scanEntries) {
    results[symbol] = entry;
  }

  return {
    date: scanDate,
    symbols: results,
  };
}
