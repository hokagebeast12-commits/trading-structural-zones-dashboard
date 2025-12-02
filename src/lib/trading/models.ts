import { 
  TradeCandidate, 
  OcZone, 
  LiquidityMap, 
  OhlcBar, 
  SymbolCode, 
  CONFIG,
  Trend 
} from './types';
import { nearestAbove, nearestBelow } from './zones';

export function generateModelATrades(
  trend: Trend,
  zones: OcZone[],
  liquidity: LiquidityMap,
  bars: OhlcBar[],
  symbol: SymbolCode
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  const currentPrice = bars[bars.length - 1].close;
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = CONFIG.min_rr;
  
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
  symbol: SymbolCode
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  const currentPrice = bars[bars.length - 1].close;
  const prevBar = bars[bars.length - 2];
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = CONFIG.min_rr;
  
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