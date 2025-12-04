import type { OhlcBar, PullbackStats } from "./types";
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
