import {
  TradeCandidate,
  OcZone,
  LiquidityMap,
  OhlcBar,
  SymbolCode,
  CONFIG,
} from "./types";
import type { Trend } from "./trend-analysis";
import { nearestAbove, nearestBelow } from "./zones";
import type { NearestZoneInfo } from "./types";

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

  // Spread filter
  if (spreadCap != null && currentSpread != null && currentSpread > spreadCap) {
    return trades;
  }

  if (trend === "Bull") {
    // Longs from zones below current price
    const candidateZones = zones.filter((z) => z.zone_mid < currentPrice);

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
        stopType: "Swing",
      });
    }
  } else if (trend === "Bear") {
    // Shorts from zones above current price
    const candidateZones = zones.filter((z) => z.zone_mid > currentPrice);

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
        stopType: "Swing",
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
    const candidateZones = zones.filter((z) => z.zone_mid < currentPrice);

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
        stopType: "PD",
      });
    }
  } else if (trend === "Bear") {
    const candidateZones = zones.filter((z) => z.zone_mid > currentPrice);

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
        stopType: "PD",
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

  if (trend === "Bull") {
    const keyLevels = [prevBar.high, prevBar.close, prevBar.low];
    const touchedLevels = keyLevels.filter((level) => currentBar.low <= level);
    if (touchedLevels.length === 0) return trades;

    const entry = touchedLevels.sort((a, b) => b - a)[0];
    const tp1 = nearestAbove(liquidity.highs, entry);
    if (!tp1) return trades;

    // C1: swing-based stop
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
            stopType: "Swing",
          });
        }
      }
    }

    // C2: PD low stop
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
          stopType: "PD",
        });
      }
    }
  } else if (trend === "Bear") {
    const keyLevels = [prevBar.low, prevBar.close, prevBar.high];
    const touchedLevels = keyLevels.filter((level) => currentBar.high >= level);
    if (touchedLevels.length === 0) return trades;

    const entry = touchedLevels.sort((a, b) => b - a)[0];
    const tp1 = nearestBelow(liquidity.lows, entry);
    if (!tp1) return trades;

    // C1: swing-based stop
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
            stopType: "Swing",
          });
        }
      }
    }

    // C2: PD high stop
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
          stopType: "PD",
        });
      }
    }
  }

  return trades;
}

function resolveBucketRange(
  preferredBucket?: string | null,
): { min: number; max: number } {
  if (!preferredBucket) return { min: 0, max: 1 };

  if (preferredBucket.includes("+")) {
    const start = Number.parseFloat(preferredBucket);
    if (Number.isFinite(start)) {
      return { min: start, max: 1 };
    }
  }

  const [minStr, maxStr] = preferredBucket.split(/[-–]/);
  const min = Number.parseFloat(minStr);
  const max = Number.parseFloat(maxStr);

  if (Number.isFinite(min) && Number.isFinite(max)) {
    return { min, max };
  }

  return { min: 0, max: 1 };
}

function computeBandPrice(
  trend: Trend,
  prevBar: OhlcBar,
  bucketRange: { min: number; max: number },
): { lower: number; upper: number } | null {
  const range = prevBar.high - prevBar.low;
  if (range <= 0) return null;

  if (trend === "Bull") {
    const upper = prevBar.high - bucketRange.min * range;
    const lower = prevBar.high - bucketRange.max * range;
    return {
      lower: Math.min(lower, upper),
      upper: Math.max(lower, upper),
    };
  }

  if (trend === "Bear") {
    const lower = prevBar.low + bucketRange.min * range;
    const upper = prevBar.low + bucketRange.max * range;
    return { lower, upper };
  }

  return null;
}

export function generateModelDTrades(
  trend: Trend,
  zones: OcZone[],
  liquidity: LiquidityMap,
  bars: OhlcBar[],
  symbol: SymbolCode,
  options: {
    minRr?: number;
    spreadCap?: number;
    pullbackDepth?: { pct: number | null; bucket: string | null } | null;
    typicalPullback?: { meanPct: number | null; dominantBucket?: string | null } | null;
    nearestZone?: NearestZoneInfo | null;
    isSweetSpot?: boolean;
  } = {},
): TradeCandidate[] {
  const trades: TradeCandidate[] = [];
  const currentBar = bars[bars.length - 1];
  const prevBar = bars[bars.length - 2];
  const currentPrice = options.nearestZone?.spot ?? currentBar?.close;
  const riskCap = CONFIG.risk_cap[symbol];
  const slBuffer = CONFIG.sl_buffer[symbol];
  const minRR = options.minRr ?? CONFIG.min_rr;
  const spreadCap = options.spreadCap;
  const currentSpread = currentBar?.spread;

  if (!options.isSweetSpot) return trades;

  if (spreadCap != null && currentSpread != null && currentSpread > spreadCap) {
    return trades;
  }

  if (!prevBar || !currentBar || !Number.isFinite(currentPrice)) return trades;

  const bucketRange = resolveBucketRange(
    options.typicalPullback?.dominantBucket ?? options.pullbackDepth?.bucket,
  );
  const band = computeBandPrice(trend, prevBar, bucketRange);
  if (!band) return trades;

  const zonesInBand = zones.filter((z) => {
    if (!Number.isFinite(z.zone_mid)) return false;
    return z.zone_mid >= band.lower && z.zone_mid <= band.upper;
  });

  if (zonesInBand.length === 0) return trades;

  const sortedZones = [...zonesInBand].sort((a, b) => b.score - a.score);

  const candidateZone = sortedZones[0];
  const entry = candidateZone.zone_mid;

  if (trend === "Bull") {
    if (entry >= currentPrice) return trades;

    const tp1 = nearestAbove(liquidity.highs, entry);
    if (!tp1) return trades;

    const swingLow = nearestBelow(liquidity.lows, entry);
    if (swingLow) {
      const stop = swingLow - slBuffer;
      const risk = entry - stop;
      if (risk > 0 && risk <= riskCap) {
        const reward = tp1 - entry;
        const rr = reward / risk;
        if (rr >= minRR) {
          trades.push({
            model: "D",
            direction: "Long",
            entry,
            stop,
            tp1,
            risk_price: risk,
            reward_price: reward,
            rr,
            status: "VALID",
            stopType: "Swing",
            placement: "PENDING_LIMIT",
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
          model: "D",
          direction: "Long",
          entry,
          stop: pdStop,
          tp1,
          risk_price: pdRisk,
          reward_price: pdReward,
          rr: pdRr,
          status: "VALID",
          stopType: "PD",
          placement: "PENDING_LIMIT",
        });
      }
    }
  } else if (trend === "Bear") {
    if (entry <= currentPrice) return trades;

    const tp1 = nearestBelow(liquidity.lows, entry);
    if (!tp1) return trades;

    const swingHigh = nearestAbove(liquidity.highs, entry);
    if (swingHigh) {
      const stop = swingHigh + slBuffer;
      const risk = stop - entry;
      if (risk > 0 && risk <= riskCap) {
        const reward = entry - tp1;
        const rr = reward / risk;
        if (rr >= minRR) {
          trades.push({
            model: "D",
            direction: "Short",
            entry,
            stop,
            tp1,
            risk_price: risk,
            reward_price: reward,
            rr,
            status: "VALID",
            stopType: "Swing",
            placement: "PENDING_LIMIT",
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
          model: "D",
          direction: "Short",
          entry,
          stop: pdStop,
          tp1,
          risk_price: pdRisk,
          reward_price: pdReward,
          rr: pdRr,
          status: "VALID",
          stopType: "PD",
          placement: "PENDING_LIMIT",
        });
      }
    }
  }

  return trades;
}
