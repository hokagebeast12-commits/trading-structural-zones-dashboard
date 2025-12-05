import { OhlcBar, CONFIG } from './types';

export type MacroTrend = "Bull" | "Bear" | "Neutral";
export type TrendDayDirection = "Bull" | "Bear" | "Neutral";
export type Trend = MacroTrend;

export type TrendAlignment =
  | "AlignedLong"   // Macro Bull + Trend day Bull
  | "AlignedShort"  // Macro Bear + Trend day Bear
  | "CounterLong"   // Macro Bear + Trend day Bull
  | "CounterShort"  // Macro Bull + Trend day Bear
  | "Neutral";      // any case involving Neutral

export type Location = "Discount" | "Mid" | "Premium";

export interface TrendAnalysis {
  macroTrend: MacroTrend;
  trendDay: TrendDayDirection;
  alignment: TrendAlignment;
  location: Location;
  atr20: number;
}

export function classifyTrend(
  bars: OhlcBar[],
  options?: {
    lookbackDays?: number;
    atrWindow?: number;
    trendLookback?: number;
  },
): TrendAnalysis {
  const lookbackDays = options?.lookbackDays ?? CONFIG.lookback_days;
  const atrWindow = options?.atrWindow ?? 20;
  const trendLookback = options?.trendLookback ?? CONFIG.trend_lookback;

  // Need at least two sessions to detect a break of the prior day's extremes
  if (bars.length < 2) {
    return {
      macroTrend: "Neutral",
      trendDay: "Neutral",
      alignment: "Neutral",
      location: "Mid",
      atr20: 0,
    };
  }

  // Use recent bars for range/location calculations
  const lookbackBars = bars.slice(-lookbackDays);

  // Calculate position in range
  const highs = lookbackBars.map(b => b.high);
  const lows = lookbackBars.map(b => b.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const lastClose = bars[bars.length - 1].close;

  let pos = 0.5; // Default middle position
  if (maxHigh !== minLow) {
    pos = (lastClose - minLow) / (maxHigh - minLow);
  }

  const trendDay = computeLatestTrendDay(bars, trendLookback);
  const macroTrend = computeMacroTrend(bars, trendLookback);
  const alignment = computeTrendAlignment(macroTrend, trendDay);

  // Determine location
  let location: Location = "Mid";
  if (pos < 1/3) {
    location = "Discount";
  } else if (pos > 2/3) {
    location = "Premium";
  }
  
  // Calculate ATR (windowed average true range)
  const atrBars = bars.slice(-atrWindow);
  let atrSum = 0;
  for (let i = 1; i < atrBars.length; i++) {
    const high = atrBars[i].high;
    const low = atrBars[i].low;
    const prevClose = atrBars[i-1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    atrSum += tr;
  }
  const atrValue = atrBars.length > 1 ? atrSum / (atrBars.length - 1) : 0;

  return {
    macroTrend,
    trendDay,
    alignment,
    location,
    atr20: atrValue,
  };
}

function classifyTrendDayForPair(prev: OhlcBar, cur: OhlcBar): TrendDayDirection {
  const brokeHigh = cur.high > prev.high;
  const brokeLow  = cur.low  < prev.low;

  const closedAbovePrevHigh = cur.close > prev.high;
  const closedBelowPrevLow  = cur.close < prev.low;

  // No violation of yesterday's high or low → not a trend day
  if (!brokeHigh && !brokeLow) {
    return "Neutral";
  }

  // Legit bullish trend day:
  // broke yesterday's high and CLOSED above it (not just a wick),
  // and did not close below the previous low.
  if (closedAbovePrevHigh && !closedBelowPrevLow) {
    return "Bull";
  }

  // Legit bearish trend day:
  // broke yesterday's low and CLOSED below it,
  // and did not close above the previous high.
  if (closedBelowPrevLow && !closedAbovePrevHigh) {
    return "Bear";
  }

  // Price violated the level but closed back inside yesterday's range
  // → treat as stop hunt / fakeout, not a trend day.
  return "Neutral";
}

function computeLatestTrendDay(
  bars: OhlcBar[],
  trendLookback: number,
): TrendDayDirection {
  const trendBars = bars.slice(-Math.max(trendLookback + 1, 2));
  let latest: TrendDayDirection = "Neutral";

  for (let i = 1; i < trendBars.length; i++) {
    const prev = trendBars[i - 1];
    const cur  = trendBars[i];
    const td = classifyTrendDayForPair(prev, cur);
    if (td !== "Neutral") {
      latest = td; // last non-neutral wins
    }
  }

  return latest;
}

function computeMacroTrend(
  bars: OhlcBar[],
  trendLookback: number,
): MacroTrend {
  const trendBars = bars.slice(-Math.max(trendLookback + 1, 2));

  let bullCount = 0;
  let bearCount = 0;

  for (let i = 1; i < trendBars.length; i++) {
    const prev = trendBars[i - 1];
    const cur  = trendBars[i];
    const td = classifyTrendDayForPair(prev, cur);

    if (td === "Bull") bullCount++;
    else if (td === "Bear") bearCount++;
  }

  const total = bullCount + bearCount;
  if (total === 0) return "Neutral";

  // 60% threshold to avoid flipping on noise
  const threshold = Math.ceil(total * 0.6);

  if (bullCount >= threshold && bullCount > bearCount) return "Bull";
  if (bearCount >= threshold && bearCount > bullCount) return "Bear";

  return "Neutral";
}

function computeTrendAlignment(
  macro: MacroTrend,
  trendDay: TrendDayDirection,
): TrendAlignment {
  if (macro === "Bull" && trendDay === "Bull") return "AlignedLong";
  if (macro === "Bear" && trendDay === "Bear") return "AlignedShort";

  if (macro === "Bull" && trendDay === "Bear") return "CounterShort";
  if (macro === "Bear" && trendDay === "Bull") return "CounterLong";

  return "Neutral";
}