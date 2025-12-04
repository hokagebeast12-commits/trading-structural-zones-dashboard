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
  trend: Trend,
  liquidity: LiquidityMap,
  bars: OhlcBar[],
  symbol: SymbolCode,
  options?: { minRr?: number; spreadCap?: number }
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  const currentBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = options?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.spreadCap;
  const currentSpread = currentBar?.spread;

  if (spreadCap != null && currentSpread != null && currentSpread > spreadCap) {
    return trades;
  }

  if (!prevBar || !currentBar) return trades;

  const brokeHigh = currentBar.high > prevBar.high;
  const brokeLow = currentBar.low < prevBar.low;

  if (trend === "Bull" && brokeHigh) {
    const entry = prevBar.high;
    const tp1 = nearestAbove(liquidity.highs, entry);

    if (tp1) {
      const swingLow = nearestBelow(liquidity.lows, entry);
      if (swingLow) {
        const stop = swingLow - slBuffer;
        const risk = entry - stop;
        if (risk > 0 && risk <= riskCap) {
          const reward = tp1 - entry;
          const rr = reward / risk;
          if (rr >= minRR) {
            trades.push({
              model: "C1",
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
        }
      }

      const pdStop = prevBar.low - slBuffer;
      const pdRisk = entry - pdStop;
      if (pdRisk > 0 && pdRisk <= riskCap) {
        const pdReward = tp1 - entry;
        const pdRr = pdReward / pdRisk;
        if (pdRr >= minRR) {
          trades.push({
            model: "C2",
            direction: "Long",
            entry,
            stop: pdStop,
            tp1,
            risk_price: pdRisk,
            reward_price: pdReward,
            rr: pdRr,
            status: "VALID",
            stopType: "PD"
          });
        }
      }
    }
  } else if (trend === "Bear" && brokeLow) {
    const entry = prevBar.low;
    const tp1 = nearestBelow(liquidity.lows, entry);

    if (tp1) {
      const swingHigh = nearestAbove(liquidity.highs, entry);
      if (swingHigh) {
        const stop = swingHigh + slBuffer;
        const risk = stop - entry;
        if (risk > 0 && risk <= riskCap) {
          const reward = entry - tp1;
          const rr = reward / risk;
          if (rr >= minRR) {
            trades.push({
              model: "C1",
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
      }

      const pdStop = prevBar.high + slBuffer;
      const pdRisk = pdStop - entry;
      if (pdRisk > 0 && pdRisk <= riskCap) {
        const pdReward = entry - tp1;
        const pdRr = pdReward / pdRisk;
        if (pdRr >= minRR) {
          trades.push({
            model: "C2",
            direction: "Short",
            entry,
            stop: pdStop,
            tp1,
            risk_price: pdRisk,
            reward_price: pdReward,
            rr: pdRr,
            status: "VALID",
            stopType: "PD"
          });
        }
      }
    }
  }

  return trades;
}