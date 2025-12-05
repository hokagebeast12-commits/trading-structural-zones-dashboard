import { classifyTrend, type MacroTrend, type TrendAlignment, type TrendDayDirection } from "./trend-analysis";
import type { OhlcBar, SymbolCode } from "./types";

export type PullbackBucket =
  | "0-0.382"
  | "0.382-0.5"
  | "0.5-0.618"
  | "0.618-0.786"
  | "0.786-1.0"
  | "1.0+";

export interface PullbackScenarioKey {
  macroTrendPrev: MacroTrend;
  trendDayPrev: TrendDayDirection;
  alignmentPrev: TrendAlignment;
}

export interface CandlePairPullbackRecord {
  symbol: SymbolCode;

  prevIndex: number;
  currIndex: number;

  datePrev: string;
  dateCurr: string;

  prevHigh: number;
  prevLow: number;
  currHigh: number;
  currLow: number;

  scenario: PullbackScenarioKey;

  depthIntoPrevPct: number;
  bucket: PullbackBucket;
}

export interface PullbackScenarioStats {
  key: PullbackScenarioKey;

  lookbackDays: number;
  sampleCount: number;

  meanDepthPct: number;
  medianDepthPct: number;
  minDepthPct: number;
  maxDepthPct: number;

  bucketCounts: Record<PullbackBucket, number>;
}

export interface CurrentPullbackSnapshot {
  depthIntoPrevPct: number | null;
  bucket: PullbackBucket | null;

  scenario: PullbackScenarioKey | null;

  typicalMeanPct: number | null;
  typicalMedianPct: number | null;
  sampleCount: number;
  lookbackDays: number;
}

export function classifyPullbackBucket(depth: number): PullbackBucket {
  if (!Number.isFinite(depth) || depth <= 0) return "0-0.382";
  if (depth < 0.382) return "0-0.382";
  if (depth < 0.5) return "0.382-0.5";
  if (depth < 0.618) return "0.5-0.618";
  if (depth < 0.786) return "0.618-0.786";
  if (depth < 1.0) return "0.786-1.0";
  return "1.0+";
}

function computeDepthIntoPrevious(prev: OhlcBar, curr: OhlcBar): number {
  const prevRange = prev.high - prev.low;
  if (prevRange <= 0) return NaN;

  const overlapHigh = Math.min(prev.high, curr.high);
  const overlapLow = Math.max(prev.low, curr.low);
  const overlap = Math.max(0, overlapHigh - overlapLow);

  // Add any extension beyond the previous range so overshoots show up as >1.0
  const overshoot = Math.max(prev.low - curr.low, curr.high - prev.high, 0);

  return (overlap + overshoot) / prevRange;
}

export function computeLivePullbackIntoPrev(
  prev: OhlcBar,
  currentPrice: number,
  macroTrend: MacroTrend,
): number | null {
  const range = prev.high - prev.low;
  if (!Number.isFinite(currentPrice) || !Number.isFinite(range) || range <= 0) {
    return null;
  }

  let depth = 0;

  if (macroTrend === "Bull") {
    depth = (prev.high - currentPrice) / range;
  } else if (macroTrend === "Bear") {
    depth = (currentPrice - prev.low) / range;
  } else {
    return null;
  }

  if (!Number.isFinite(depth)) return null;

  return Math.max(0, depth);
}

export function buildCandlePairPullbacks(
  symbol: SymbolCode,
  bars: OhlcBar[],
  trendLookback: number,
  lookbackDays: number,
): CandlePairPullbackRecord[] {
  if (bars.length < 2) return [];

  const currentWindowStart = Math.max(1, bars.length - lookbackDays + 1);
  const records: CandlePairPullbackRecord[] = [];

  for (let currIndex = currentWindowStart; currIndex < bars.length; currIndex++) {
    const prevIndex = currIndex - 1;
    const prev = bars[prevIndex];
    const curr = bars[currIndex];

    const prevRange = prev.high - prev.low;
    if (prevRange <= 0) continue;

    const { macroTrend, trendDay, alignment } = classifyTrend(
      bars.slice(0, prevIndex + 1),
      { trendLookback },
    );

    const depthIntoPrevPct = computeDepthIntoPrevious(prev, curr);
    if (!Number.isFinite(depthIntoPrevPct)) continue;
    const bucket = classifyPullbackBucket(depthIntoPrevPct);

    records.push({
      symbol,
      prevIndex,
      currIndex,
      datePrev: prev.date,
      dateCurr: curr.date,
      prevHigh: prev.high,
      prevLow: prev.low,
      currHigh: curr.high,
      currLow: curr.low,
      scenario: {
        macroTrendPrev: macroTrend,
        trendDayPrev: trendDay,
        alignmentPrev: alignment,
      },
      depthIntoPrevPct,
      bucket,
    });
  }

  return records;
}

function initializeBucketCounts(): Record<PullbackBucket, number> {
  return {
    "0-0.382": 0,
    "0.382-0.5": 0,
    "0.5-0.618": 0,
    "0.618-0.786": 0,
    "0.786-1.0": 0,
    "1.0+": 0,
  };
}

export function buildPullbackScenarioStats(
  records: CandlePairPullbackRecord[],
  lookbackDays: number,
): PullbackScenarioStats[] {
  const groups = new Map<string, CandlePairPullbackRecord[]>();

  for (const record of records) {
    const key = `${record.scenario.macroTrendPrev}|${record.scenario.trendDayPrev}|${record.scenario.alignmentPrev}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)?.push(record);
  }

  const stats: PullbackScenarioStats[] = [];

  for (const [, groupRecords] of groups) {
    if (groupRecords.length === 0) continue;
    const [first] = groupRecords;

    const depths = groupRecords.map((r) => r.depthIntoPrevPct).sort((a, b) => a - b);
    const sampleCount = depths.length;
    const sum = depths.reduce((acc, value) => acc + value, 0);
    const meanDepthPct = sum / sampleCount;

    let medianDepthPct: number;
    if (sampleCount % 2 === 1) {
      medianDepthPct = depths[(sampleCount - 1) / 2];
    } else {
      const mid1 = depths[sampleCount / 2 - 1];
      const mid2 = depths[sampleCount / 2];
      medianDepthPct = (mid1 + mid2) / 2;
    }

    const bucketCounts = initializeBucketCounts();
    for (const record of groupRecords) {
      bucketCounts[record.bucket] += 1;
    }

    stats.push({
      key: {
        macroTrendPrev: first.scenario.macroTrendPrev,
        trendDayPrev: first.scenario.trendDayPrev,
        alignmentPrev: first.scenario.alignmentPrev,
      },
      lookbackDays,
      sampleCount,
      meanDepthPct,
      medianDepthPct,
      minDepthPct: depths[0],
      maxDepthPct: depths[depths.length - 1],
      bucketCounts,
    });
  }

  return stats;
}
