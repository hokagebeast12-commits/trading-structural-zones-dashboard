import type { OhlcBar, PullbackHistoryStats, PullbackStats } from "./types";
import { classifyTrend } from "./trend-analysis";
import type { Trend } from "./trend-analysis";

function bucketFib(depth: number): string {
  if (depth <= 0) return "None";
  if (depth < 0.382) return "0-0.382";
  if (depth < 0.5) return "0.382-0.5";
  if (depth < 0.618) return "0.5-0.618";
  if (depth < 0.786) return "0.618-0.786";
  if (depth <= 1.0) return "0.786-1.0";
  return "1.0+"; // overshoot / sweep
}

export function computePullbackStats(
  bars: OhlcBar[],
  trend: Trend,
): PullbackStats | undefined {
  if (bars.length < 2) return undefined;

  const current = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const basisHigh = prev.high;
  const basisLow = prev.low;
  const range = basisHigh - basisLow;
  if (range <= 0) return undefined;

  if (trend === "Bull") {
    const retrace = current.low;
    const rawDepth = (basisHigh - retrace) / range;
    const depth = rawDepth < 0 ? 0 : rawDepth;
    return {
      basis: "priorDayRange",
      basisHigh,
      basisLow,
      retracePrice: retrace,
      depth,
      fibBucket: bucketFib(depth),
    };
  }

  if (trend === "Bear") {
    const retrace = current.high;
    const rawDepth = (retrace - basisLow) / range;
    const depth = rawDepth < 0 ? 0 : rawDepth;
    return {
      basis: "priorDayRange",
      basisHigh,
      basisLow,
      retracePrice: retrace,
      depth,
      fibBucket: bucketFib(depth),
    };
  }

  return undefined; // Neutral
}

export function computePullbackHistoryStats(
  bars: OhlcBar[],
  options: {
    window: number;
    trendLookback: number;
    mode?: "matchingTrend" | "all";
  },
): PullbackHistoryStats | undefined {
  const { window, trendLookback, mode = "matchingTrend" } = options;

  if (bars.length < 2) return undefined;

  const { trend: currentTrend } = classifyTrend(bars, { trendLookback });

  const depths: number[] = [];
  const bucketCounts: Record<string, number> = {};

  const startIndex = Math.max(1, bars.length - window);

  for (let i = startIndex; i < bars.length; i++) {
    const slice = bars.slice(0, i + 1);
    const { trend } = classifyTrend(slice, { trendLookback });

    if (trend === "Neutral") continue;
    if (mode === "matchingTrend" && trend !== currentTrend) continue;

    const stats = computePullbackStats(slice, trend);
    if (!stats) continue;

    const depth = stats.depth;
    if (!Number.isFinite(depth)) continue;

    depths.push(depth);

    const bucket = stats.fibBucket ?? bucketFib(depth);
    bucketCounts[bucket] = (bucketCounts[bucket] ?? 0) + 1;
  }

  const sampleSize = depths.length;
  if (sampleSize === 0) {
    return {
      window,
      sampleSize: 0,
      meanDepth: null,
      medianDepth: null,
      minDepth: null,
      maxDepth: null,
      bucketCounts,
    };
  }

  depths.sort((a, b) => a - b);
  const sum = depths.reduce((acc, v) => acc + v, 0);
  const meanDepth = sum / sampleSize;

  let medianDepth: number;
  if (sampleSize % 2 === 1) {
    medianDepth = depths[(sampleSize - 1) / 2];
  } else {
    const mid1 = depths[sampleSize / 2 - 1];
    const mid2 = depths[sampleSize / 2];
    medianDepth = (mid1 + mid2) / 2;
  }

  const minDepth = depths[0];
  const maxDepth = depths[sampleSize - 1];

  return {
    window,
    sampleSize,
    meanDepth,
    medianDepth,
    minDepth,
    maxDepth,
    bucketCounts,
  };
}
