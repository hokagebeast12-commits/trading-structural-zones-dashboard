import { OhlcBar, SymbolCode, CONFIG } from './types';

export type Trend = "Bull" | "Bear" | "Neutral";
export type Location = "Discount" | "Mid" | "Premium";

export interface TrendAnalysis {
  trend: Trend;
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
    return { trend: "Neutral", location: "Mid", atr20: 0 };
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

  // Determine trend based on violation of the previous day's high/low
  const trendBars = bars.slice(-Math.max(2, trendLookback));
  const prevBar = trendBars[trendBars.length - 2];
  const currentBar = trendBars[trendBars.length - 1];

  let trend: Trend = "Neutral";
  const brokeHigh = currentBar.high > prevBar.high;
  const brokeLow = currentBar.low < prevBar.low;

  if (brokeHigh && !brokeLow) {
    trend = "Bull";
  } else if (brokeLow && !brokeHigh) {
    trend = "Bear";
  } else if (brokeHigh && brokeLow) {
    // If both extremes were violated, use the closing position to choose a bias
    trend = lastClose >= prevBar.close ? "Bull" : "Bear";
  }

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

  return { trend, location, atr20: atrValue };
}