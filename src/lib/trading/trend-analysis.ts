import { CONFIG, type MacroTrendDiagnostics, type OhlcBar } from "./types";

export type MacroTrend = "Bull" | "Bear" | "Neutral";
export type TrendDayDirection = "Bull" | "Bear" | "Neutral";
export type Trend = MacroTrend;

export type TrendAlignment =
  | "AlignedLong" // Macro Bull + Trend day Bull
  | "AlignedShort" // Macro Bear + Trend day Bear
  | "CounterLong" // Macro Bear + Trend day Bull
  | "CounterShort" // Macro Bull + Trend day Bear
  | "Neutral"; // any case involving Neutral

export type Location = "Discount" | "Mid" | "Premium";

export interface TrendAnalysis {
  trend: Trend; // macro regime for backwards compatibility
  location: Location;
  atr20: number;
  macroTrend: Trend;
  latestTrendDay: Trend;
  /** Alias for latestTrendDay to keep existing consumers working */
  trendDay?: Trend;
  macroTrendScore: number;
  alignment: TrendAlignment;
  macroTrendDiagnostics?: MacroTrendDiagnostics;
}

function classifyTrendDay(prevBar: OhlcBar, currentBar: OhlcBar): Trend {
  const brokeHigh = currentBar.high > prevBar.high;
  const brokeLow = currentBar.low < prevBar.low;

  const closedAbovePrevHigh = currentBar.close > prevBar.high;
  const closedBelowPrevLow = currentBar.close < prevBar.low;

  if (!brokeHigh && !brokeLow) {
    return "Neutral";
  } else if (closedAbovePrevHigh && !closedBelowPrevLow) {
    return "Bull";
  } else if (closedBelowPrevLow && !closedAbovePrevHigh) {
    return "Bear";
  } else {
    // stop hunt / fakeout – treat as range for regime purposes
    return "Neutral";
  }
}

export interface MacroTrendResult {
  macroTrend: Trend; // Bull / Bear / Neutral
  latestTrendDay: Trend; // latest daily breakout classification
  rollingScore: number; // average score over the window
}

export function computeMacroTrend(
  bars: OhlcBar[],
  options?: {
    window?: number;
    bullThreshold?: number;
    bearThreshold?: number;
  },
): MacroTrendResult {
  const windowSize = options?.window ?? CONFIG.macro_trend_window;
  const bullThreshold = options?.bullThreshold ?? CONFIG.macro_trend_bull_threshold;
  const bearThreshold = options?.bearThreshold ?? CONFIG.macro_trend_bear_threshold;

  if (bars.length < 2) {
    return {
      macroTrend: "Neutral",
      latestTrendDay: "Neutral",
      rollingScore: 0,
    };
  }

  const trendDays: Trend[] = [];
  const scores: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];

    const dayTrend = classifyTrendDay(prev, curr);
    trendDays.push(dayTrend);

    const score = dayTrend === "Bull" ? 1 : dayTrend === "Bear" ? -1 : 0;
    scores.push(score);
  }

  const latestTrendDay = trendDays[trendDays.length - 1] ?? "Neutral";

  const windowScores = scores.slice(-windowSize);
  const total = windowScores.reduce((sum, v) => sum + v, 0);
  const rollingScore = windowScores.length > 0 ? total / windowScores.length : 0;

  let macroTrend: Trend = "Neutral";
  if (rollingScore >= bullThreshold) {
    macroTrend = "Bull";
  } else if (rollingScore <= bearThreshold) {
    macroTrend = "Bear";
  }

  return { macroTrend, latestTrendDay, rollingScore };
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
  const macroWindow = CONFIG.macro_trend_window;

  if (bars.length < 2) {
    return {
      trend: "Neutral",
      location: "Mid",
      atr20: 0,
      macroTrend: "Neutral",
      latestTrendDay: "Neutral",
      trendDay: "Neutral",
      macroTrendScore: 0,
      alignment: "Neutral",
      macroTrendDiagnostics: {
        bullDays: 0,
        bearDays: 0,
        totalTrendDays: 0,
        dominanceThreshold: 0,
        lookback: macroWindow,
      },
    };
  }

  // Use recent bars for range/location calculations
  const lookbackBars = bars.slice(-lookbackDays);

  // Calculate position in range (unchanged)
  const highs = lookbackBars.map((b) => b.high);
  const lows = lookbackBars.map((b) => b.low);
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const lastClose = bars[bars.length - 1].close;

  let pos = 0.5; // Default middle position
  if (maxHigh !== minLow) {
    pos = (lastClose - minLow) / (maxHigh - minLow);
  }

  const { macroTrend, latestTrendDay, rollingScore } = computeMacroTrend(bars);

  const alignment = computeTrendAlignment(macroTrend, latestTrendDay);

  // Determine location (unchanged)
  let location: Location = "Mid";
  if (pos < 1 / 3) {
    location = "Discount";
  } else if (pos > 2 / 3) {
    location = "Premium";
  }

  // Calculate ATR (windowed average true range)
  const atrBars = bars.slice(-atrWindow);
  let atrSum = 0;
  for (let i = 1; i < atrBars.length; i++) {
    const high = atrBars[i].high;
    const low = atrBars[i].low;
    const prevClose = atrBars[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atrSum += tr;
  }
  const atrValue = atrBars.length > 1 ? atrSum / (atrBars.length - 1) : 0;

  const trend = macroTrend; // macro regime retained for backwards compatibility

  const macroTrendDiagnostics = computeMacroTrendDiagnostics(bars, macroWindow);

  return {
    trend,
    location,
    atr20: atrValue,
    macroTrend,
    latestTrendDay,
    trendDay: latestTrendDay,
    macroTrendScore: rollingScore,
    alignment,
    macroTrendDiagnostics,
  };
}

function computeMacroTrendDiagnostics(
  bars: OhlcBar[],
  windowSize: number,
): MacroTrendDiagnostics {
  if (bars.length < 2) {
    return {
      bullDays: 0,
      bearDays: 0,
      totalTrendDays: 0,
      dominanceThreshold: 0,
      lookback: windowSize,
    };
  }

  let bullDays = 0;
  let bearDays = 0;

  const startIndex = Math.max(1, bars.length - windowSize);
  for (let i = startIndex; i < bars.length; i++) {
    const prev = bars[i - 1];
    const curr = bars[i];
    const dayTrend = classifyTrendDay(prev, curr);
    if (dayTrend === "Bull") bullDays++;
    else if (dayTrend === "Bear") bearDays++;
  }

  const totalTrendDays = bullDays + bearDays;
  const dominanceThreshold = Math.ceil(
    windowSize * Math.max(CONFIG.macro_trend_bull_threshold, Math.abs(CONFIG.macro_trend_bear_threshold)),
  );

  return {
    bullDays,
    bearDays,
    totalTrendDays,
    dominanceThreshold,
    lookback: windowSize,
  };
}

function computeTrendAlignment(macro: MacroTrend, trendDay: TrendDayDirection): TrendAlignment {
  if (macro === "Bull" && trendDay === "Bull") return "AlignedLong";
  if (macro === "Bear" && trendDay === "Bear") return "AlignedShort";

  if (macro === "Bull" && trendDay === "Bear") return "CounterShort";
  if (macro === "Bear" && trendDay === "Bull") return "CounterLong";

  return "Neutral";
}
