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
    trendLookback?: number;
    lookbackDays?: number;
    atrWindow?: number;
  },
): TrendAnalysis {
  const trendLookback = options?.trendLookback ?? CONFIG.trend_lookback;
  const lookbackDays = options?.lookbackDays ?? CONFIG.lookback_days;
  const atrWindow = options?.atrWindow ?? 20;

  if (bars.length < trendLookback + 1) {
    return { trend: "Neutral", location: "Mid", atr20: 0 };
  }

  // Use last trend_lookback bars (excluding today for trend calculation)
  const trendBars = bars.slice(-trendLookback - 1, -1);
  const lookbackBars = bars.slice(-lookbackDays);
  
  // Calculate trend
  let upDays = 0;
  let downDays = 0;
  
  for (const bar of trendBars) {
    const body = bar.close - bar.open;
    if (body > 0) upDays++;
    else if (body < 0) downDays++;
  }
  
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
  
  // Determine trend
  let trend: Trend = "Neutral";
  const upThreshold = 0.6 * trendLookback;
  const downThreshold = 0.6 * trendLookback;
  
  if (upDays >= upThreshold && pos > 0.6) {
    trend = "Bull";
  } else if (downDays >= downThreshold && pos < 0.4) {
    trend = "Bear";
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