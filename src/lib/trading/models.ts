import {
  TradeCandidate,
  OcZone,
  LiquidityMap,
  OhlcBar,
  SymbolCode,
  CONFIG,
} from './types';
import type { Trend } from './trend-analysis';
import { nearestAbove, nearestBelow } from './zones';

export function generateModelATrades(
  trend: Trend,
  zones: OcZone[],
  liquidity: LiquidityMap,
  bars: OhlcBar[],
  symbol: SymbolCode,
  options?: { minRr?: number; spreadCap?: number }
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  const currentPrice = bars[bars.length - 1].close;
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = options?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.spreadCap;
  const currentSpread = bars[bars.length - 1]?.spread;

  if (spreadCap != null && currentSpread != null && currentSpread > spreadCap) {
    return trades;
  }
  
  if (trend === "Bull") {
    // Long trades only - zones below current price
    const candidateZones = zones.filter(z => z.zone_mid < currentPrice);
    
    for (const zone of candidateZones) {
      const entry = zone.zone_mid;
      const swingLow = nearestBelow(liquidity.lows, entry);
      
      if (!swingLow) continue;
      
      const stop = swingLow - slBuffer;
      const risk = entry - stop;
      
      if (risk <= 0 || risk > riskCap) continue;
      
      const tp1 = nearestAbove(liquidity.highs, entry);
      if (!tp1) continue;
      
      const reward = tp1 - entry;
      const rr = reward / risk;
      
      if (rr < minRR) continue;
      
      trades.push({
        model: "A",
        direction: "Long",
        entry,
        stop,
        tp1,
        risk_price: risk,
        reward_price: reward,
        rr,
        status: "VALID",
        stopType: "Swing"
      });
    }
  } else if (trend === "Bear") {
    // Short trades only - zones above current price
    const candidateZones = zones.filter(z => z.zone_mid > currentPrice);
    
    for (const zone of candidateZones) {
      const entry = zone.zone_mid;
      const swingHigh = nearestAbove(liquidity.highs, entry);
      
      if (!swingHigh) continue;
      
      const stop = swingHigh + slBuffer;
      const risk = stop - entry;
      
      if (risk <= 0 || risk > riskCap) continue;
      
      const tp1 = nearestBelow(liquidity.lows, entry);
      if (!tp1) continue;
      
      const reward = entry - tp1;
      const rr = reward / risk;
      
      if (rr < minRR) continue;
      
      trades.push({
        model: "A",
        direction: "Short",
        entry,
        stop,
        tp1,
        risk_price: risk,
        reward_price: reward,
        rr,
        status: "VALID",
        stopType: "Swing"
      });
    }
  }
  
  return trades;
}

export function generateModelBTrades(
  trend: Trend,
  zones: OcZone[],
  liquidity: LiquidityMap,
  bars: OhlcBar[],
  symbol: SymbolCode,
  options?: { minRr?: number; spreadCap?: number }
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  const currentPrice = bars[bars.length - 1].close;
  const prevBar = bars[bars.length - 2];
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = options?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.spreadCap;
  const currentSpread = bars[bars.length - 1]?.spread;

  if (spreadCap != null && currentSpread != null && currentSpread > spreadCap) {
    return trades;
  }
  
  if (!prevBar) return trades;
  
  const pdl = prevBar.low;
  const pdh = prevBar.high;
  
  if (trend === "Bull") {
    // Long trades only - zones below current price
    const candidateZones = zones.filter(z => z.zone_mid < currentPrice);
    
    for (const zone of candidateZones) {
      const entry = zone.zone_mid;
      const stop = pdl - slBuffer;
      const risk = entry - stop;
      
      if (risk <= 0 || risk > riskCap) continue;
      
      const tp1 = nearestAbove(liquidity.highs, entry);
      if (!tp1) continue;
      
      const reward = tp1 - entry;
      const rr = reward / risk;
      
      if (rr < minRR) continue;
      
      trades.push({
        model: "B",
        direction: "Long",
        entry,
        stop,
        tp1,
        risk_price: risk,
        reward_price: reward,
        rr,
        status: "VALID",
        stopType: "PD"
      });
    }
  } else if (trend === "Bear") {
    // Short trades only - zones above current price
    const candidateZones = zones.filter(z => z.zone_mid > currentPrice);
    
    for (const zone of candidateZones) {
      const entry = zone.zone_mid;
      const stop = pdh + slBuffer;
      const risk = stop - entry;
      
      if (risk <= 0 || risk > riskCap) continue;
      
      const tp1 = nearestBelow(liquidity.lows, entry);
      if (!tp1) continue;
      
      const reward = entry - tp1;
      const rr = reward / risk;
      
      if (rr < minRR) continue;
      
      trades.push({
        model: "B",
        direction: "Short",
        entry,
        stop,
        tp1,
        risk_price: risk,
        reward_price: reward,
        rr,
        status: "VALID",
        stopType: "PD"
      });
    }
  }

  return trades;
}


export function generateModelCTrades(
  _trend: Trend,
  liquidity: LiquidityMap,
  bars: OhlcBar[],
  symbol: SymbolCode,
  options?: { minRr?: number; spreadCap?: number }
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  if (bars.length < 3) return trades;

  const currentBar = bars[bars.length - 1];
  const trendBar = bars[bars.length - 2];
  const referenceBar = bars[bars.length - 3];
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = options?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.spreadCap;
  const currentSpread = currentBar?.spread;

  if (spreadCap != null && currentSpread != null && currentSpread > spreadCap) {
    return trades;
  }

  const brokeHigh = trendBar.high > referenceBar.high;
  const brokeLow = trendBar.low < referenceBar.low;

  let trendDay: Trend | null = null;
  if (brokeHigh && !brokeLow) {
    trendDay = "Bull";
  } else if (brokeLow && !brokeHigh) {
    trendDay = "Bear";
  } else if (brokeHigh && brokeLow) {
    trendDay = trendBar.close >= referenceBar.close ? "Bull" : "Bear";
  }

  if (!trendDay) return trades;

  const entryLevels =
    trendDay === "Bull"
      ? [trendBar.high, trendBar.close, trendBar.low]
      : [trendBar.low, trendBar.close, trendBar.high];

  const seen = new Set<string>();

  const maybePushTrade = (
    model: "C1" | "C2",
    direction: "Long" | "Short",
    entry: number,
    stop: number,
    tp1: number,
    stopType: "Swing" | "PD",
  ) => {
    const key = `${direction}-${entry}-${stopType}`;
    if (seen.has(key)) return;

    const risk = direction === "Long" ? entry - stop : stop - entry;
    const reward = direction === "Long" ? tp1 - entry : entry - tp1;
    const rr = reward / risk;

    if (risk <= 0 || risk > riskCap) return;
    if (rr < minRR) return;

    trades.push({
      model,
      direction,
      entry,
      stop,
      tp1,
      risk_price: risk,
      reward_price: reward,
      rr,
      status: "VALID",
      stopType,
    });

    seen.add(key);
  };

  for (const entry of entryLevels) {
    if (trendDay === "Bull") {
      // Require a pullback into the prior day's levels
      if (entry < currentBar.low || entry > currentBar.high) continue;

      const tp1 = nearestAbove(liquidity.highs, entry);
      if (!tp1) continue;

      const swingLow = nearestBelow(liquidity.lows, entry);
      if (swingLow) {
        const stop = swingLow - slBuffer;
        maybePushTrade("C1", "Long", entry, stop, tp1, "Swing");
      }

      const pdStop = trendBar.low - slBuffer;
      maybePushTrade("C2", "Long", entry, pdStop, tp1, "PD");
    } else {
      // Bearish continuation: expect rallies into prior-day levels
      if (entry > currentBar.high || entry < currentBar.low) continue;

      const tp1 = nearestBelow(liquidity.lows, entry);
      if (!tp1) continue;

      const swingHigh = nearestAbove(liquidity.highs, entry);
      if (swingHigh) {
        const stop = swingHigh + slBuffer;
        maybePushTrade("C1", "Short", entry, stop, tp1, "Swing");
      }

      const pdStop = trendBar.high + slBuffer;
      maybePushTrade("C2", "Short", entry, pdStop, tp1, "PD");
    }
  }

  return trades;
}