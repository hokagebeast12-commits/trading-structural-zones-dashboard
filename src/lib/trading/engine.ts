import { getDailyOhlc } from "./data-provider";
import { classifyTrend } from "./trend-analysis";
import { findStructuralZones, createLiquidityMap } from "./zones";
import {
  generateModelATrades,
  generateModelBTrades,
  generateModelCTrades,
  generateModelDTrades,
} from "./models";
import {
  computePullbackHistoryStats,
  computePullbackStats,
} from "./pullback";
import { evaluateSweetSpot } from "./sweet-spot";
import {
  SYMBOLS,
  SymbolCode,
  SymbolScanEntry,
  SymbolScanResult,
  ScanResponse,
  CONFIG,
  ScanOptions,
} from "./types";
import { computeNearestZoneInfo } from "./nearest-zone";

export async function scanSymbol(
  symbol: SymbolCode,
  options?: ScanOptions,
): Promise<SymbolScanResult> {
  const lookbackDays = Math.max(
    1,
    options?.params?.structureLookback ?? CONFIG.lookback_days,
  );
  const trendLookback = Math.max(
    1,
    options?.params?.trendLookback ?? CONFIG.trend_lookback,
  );
  const atrWindow = Math.max(2, options?.params?.atrWindow ?? 20);
  const pullbackWindow = Math.max(
    2,
    options?.params?.pullbackWindow ?? CONFIG.pullback_history_window,
  );
  const minRr = options?.filters?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.filters?.spreadCap;

  // Get enough data for all calculations
  const neededBars = Math.max(
    lookbackDays,
    atrWindow + 1,
    pullbackWindow + 1,
    trendLookback + 1,
  );
  const bars = await getDailyOhlc(symbol, neededBars);

  if (bars.length < neededBars) {
    throw new Error(
      `Insufficient data for ${symbol}: got ${bars.length}, need ${neededBars}`,
    );
  }

  // Analyze trend
  const { macroTrend, trendDay, alignment, location, atr20 } = classifyTrend(bars, {
    lookbackDays,
    atrWindow,
    trendLookback,
  });

  const trend = macroTrend;

  const pullback = computePullbackStats(bars, trend);
  const pullbackHistory = computePullbackHistoryStats(bars, {
    window: pullbackWindow,
    trendLookback,
    mode: "matchingTrend",
  });

  const bucketEntries = pullbackHistory?.bucketCounts
    ? Object.entries(pullbackHistory.bucketCounts)
    : [];

  const dominantBucket =
    bucketEntries.length > 0
      ? bucketEntries.reduce(
          (acc, [bucket, count]) => {
            if (count > acc.count) return { bucket, count };
            return acc;
          },
          { bucket: "", count: -Infinity },
        ).bucket || null
      : null;

  const typicalPullback = pullbackHistory
    ? {
        lookbackDays: pullbackHistory.window,
        samples: pullbackHistory.sampleSize,
        meanPct: pullbackHistory.meanDepth,
        medianPct: pullbackHistory.medianDepth,
        dominantBucket,
      }
    : undefined;

  // Find structural zones
  const zones = findStructuralZones(bars, symbol, lookbackDays);

  // Create liquidity map
  const liquidity = createLiquidityMap(bars.slice(-lookbackDays));

  const manualClose = options?.manualCloses?.[symbol];
  const manualSpot =
    manualClose?.enabled && typeof manualClose.close === "number"
      ? manualClose.close
      : null;

  const baseSpot = manualSpot ?? bars[bars.length - 1].close;

  const nearestZoneEstimate = computeNearestZoneInfo(zones, baseSpot, atr20);

  const sweetSpotSignal = evaluateSweetSpot({
    trend,
    macroTrend,
    trendDay,
    alignment,
    pullbackDepth: pullback
      ? { pct: pullback.depth ?? null, bucket: pullback.fibBucket ?? null }
      : undefined,
    typicalPullback,
    nearestZone: nearestZoneEstimate,
  });

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
  const modelDTrades = generateModelDTrades(trend, zones, liquidity, bars, symbol, {
    ...tradeOptions,
    pullbackDepth: pullback
      ? { pct: pullback.depth ?? null, bucket: pullback.fibBucket ?? null }
      : null,
    typicalPullback,
    nearestZone: nearestZoneEstimate,
    isSweetSpot: sweetSpotSignal.isSweetSpot,
  });

  const trades = [
    ...modelATrades,
    ...modelBTrades,
    ...modelCTrades,
    ...modelDTrades,
  ];

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
    pullback,
    pullbackHistory,
    typicalPullback,
    nearestZone: nearestZoneEstimate,
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
