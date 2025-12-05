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
  buildCandlePairPullbacks,
  buildPullbackScenarioStats,
  classifyPullbackBucket,
  type CurrentPullbackSnapshot,
  type PullbackScenarioKey,
  computeLivePullbackIntoPrev,
  classifySweetspotState,
} from "./pullback-analysis";
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
  const pullbackLookbackDays = Math.max(
    2,
    options?.params?.pullbackWindow ?? CONFIG.pullback_lookback_days,
  );
  const minRr = options?.filters?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.filters?.spreadCap;

  // Get enough data for all calculations
  const neededBars = Math.max(
    lookbackDays,
    atrWindow + 1,
    pullbackLookbackDays + 1,
    trendLookback + 1,
  );
  const bars = await getDailyOhlc(symbol, neededBars);

  if (bars.length < neededBars) {
    throw new Error(
      `Insufficient data for ${symbol}: got ${bars.length}, need ${neededBars}`,
    );
  }

  // Analyze trend
  const {
    macroTrend,
    macroTrendDiagnostics,
    trendDay,
    alignment,
    location,
    atr20,
  } = classifyTrend(bars, {
    lookbackDays,
    atrWindow,
    trendLookback,
  });

  const trend = macroTrend;

  const pullbackRecords = buildCandlePairPullbacks(
    symbol,
    bars,
    trendLookback,
    pullbackLookbackDays,
  );
  const pullbackScenarioStats = buildPullbackScenarioStats(
    pullbackRecords,
    pullbackLookbackDays,
  );

  const prevIndex = bars.length - 2;
  const currIndex = bars.length - 1;
  const prevBar = bars[prevIndex];
  const lastBar = bars[currIndex];

  const { macroTrend: macroTrendPrev, trendDay: trendDayPrev, alignment: alignmentPrev } =
    classifyTrend(bars.slice(0, prevIndex + 1), {
      lookbackDays,
      atrWindow,
      trendLookback,
    });

  const currentScenario: PullbackScenarioKey = {
    macroTrendPrev: macroTrendPrev,
    trendDayPrev: trendDayPrev,
    alignmentPrev: alignmentPrev,
  };

  const manualClose = options?.manualCloses?.[symbol];
  const manualSpot =
    manualClose?.enabled && typeof manualClose.close === "number"
      ? manualClose.close
      : null;

  const effectivePrice = manualSpot ?? lastBar.close;
  const liveDepth = computeLivePullbackIntoPrev(prevBar, effectivePrice, macroTrend);
  const liveBucket = liveDepth != null ? classifyPullbackBucket(liveDepth) : null;

  const matchingStats = pullbackScenarioStats.find(
    (stats) =>
      stats.key.macroTrendPrev === currentScenario.macroTrendPrev &&
      stats.key.trendDayPrev === currentScenario.trendDayPrev &&
      stats.key.alignmentPrev === currentScenario.alignmentPrev,
  );

  const pullback: CurrentPullbackSnapshot = {
    depthIntoPrevPct: liveDepth,
    bucket: liveBucket,
    scenario: currentScenario,
    typicalMeanPct: matchingStats?.meanDepthPct ?? null,
    typicalMedianPct: matchingStats?.medianDepthPct ?? null,
    sampleCount: matchingStats?.sampleCount ?? 0,
    lookbackDays: matchingStats?.lookbackDays ?? pullbackLookbackDays,
  };

  const dominantBucket = matchingStats
    ? Object.entries(matchingStats.bucketCounts).reduce(
        (acc, [bucket, count]) => {
          if (count > acc.count) return { bucket, count };
          return acc;
        },
        { bucket: "", count: -Infinity },
      ).bucket || null
    : null;

  const typicalPullback = matchingStats
    ? {
        lookbackDays: matchingStats.lookbackDays,
        samples: matchingStats.sampleCount,
        meanPct: matchingStats.meanDepthPct,
        medianPct: matchingStats.medianDepthPct,
        dominantBucket,
      }
    : undefined;

  // Find structural zones
  const zones = findStructuralZones(bars, symbol, lookbackDays);

  // Create liquidity map
  const liquidity = createLiquidityMap(bars.slice(-lookbackDays));

  const baseSpot = manualSpot ?? lastBar.close;

  const nearestZoneEstimate = computeNearestZoneInfo(zones, baseSpot, atr20);

  const sweetspotLow = nearestZoneEstimate?.zone_low ?? NaN;
  const sweetspotHigh = nearestZoneEstimate?.zone_high ?? NaN;

  const highToday = Number.isFinite(lastBar.high) ? lastBar.high : effectivePrice;
  const lowToday = Number.isFinite(lastBar.low) ? lastBar.low : effectivePrice;

  const sweetspotState = classifySweetspotState(
    sweetspotLow,
    sweetspotHigh,
    highToday,
    lowToday,
    effectivePrice,
  );

  const sweetSpotSignal = evaluateSweetSpot({
    trend,
    macroTrend,
    trendDay,
    alignment,
    pullbackDepth: {
      pct: pullback.depthIntoPrevPct,
      bucket: pullback.bucket,
    },
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
    pullbackDepth:
      pullback.depthIntoPrevPct != null
        ? { pct: pullback.depthIntoPrevPct, bucket: pullback.bucket }
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
    macroTrend,
    macroTrendDiagnostics,
    trendDay,
    alignment,
    trend,
    atr20,
    location,
    zones,
    trades,
    // bars.length >= neededBars is guaranteed above, so this is safe
    lastClose: bars[bars.length - 1].close,
    pullback,
    pullbackScenarioStats,
    typicalPullback,
    nearestZone: nearestZoneEstimate,
    sweetspotState,
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
