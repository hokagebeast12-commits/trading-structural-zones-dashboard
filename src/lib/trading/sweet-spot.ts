import type { NearestZoneInfo } from "./types";
import type { Trend } from "./trend-analysis";

export interface SweetSpotContext {
  trend: Trend;
  pullbackDepth?: { pct: number | null; bucket: string | null } | null;
  typicalPullback?: { meanPct: number | null; dominantBucket?: string | null } | null;
  nearestZone?: NearestZoneInfo | null;
}

export interface SweetSpotSignal {
  isSweetSpot: boolean;
  reason?: string;
}

const MEAN_TOLERANCE = 0.05; // 5% tolerance around mean pullback depth

function parseBucketRange(
  bucket: string | null | undefined,
): { min: number; max: number } | null {
  if (!bucket) return null;

  if (bucket.includes("+")) {
    const [start] = bucket.split("+");
    const min = Number.parseFloat(start);
    return Number.isFinite(min) ? { min, max: 1 } : null;
  }

  const parts = bucket.split(/[-–]/);
  if (parts.length !== 2) return null;

  const min = Number.parseFloat(parts[0]);
  const max = Number.parseFloat(parts[1]);

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

  return { min, max };
}

function bucketsAlign(
  currentBucket: string | null | undefined,
  dominantBucket: string | null | undefined,
): boolean {
  if (!currentBucket || !dominantBucket) return false;
  if (currentBucket === dominantBucket) return true;

  const currentRange = parseBucketRange(currentBucket);
  const dominantRange = parseBucketRange(dominantBucket);

  if (!currentRange || !dominantRange) return false;

  return (
    currentRange.min <= dominantRange.max &&
    dominantRange.min <= currentRange.max
  );
}

export function evaluateSweetSpot(ctx: SweetSpotContext): SweetSpotSignal {
  const { pullbackDepth, typicalPullback, nearestZone } = ctx;

  if (
    !nearestZone ||
    (nearestZone.status !== "AT_ZONE" && nearestZone.status !== "NEAR")
  ) {
    return {
      isSweetSpot: false,
      reason: "Price is not at or near a structural zone.",
    };
  }

  const pullbackPct = pullbackDepth?.pct ?? null;
  const pullbackBucket = pullbackDepth?.bucket ?? null;

  if (pullbackPct == null || !Number.isFinite(pullbackPct)) {
    return {
      isSweetSpot: false,
      reason: "Pullback depth unavailable for current session.",
    };
  }

  if (
    bucketsAlign(pullbackBucket, typicalPullback?.dominantBucket) ||
    (typicalPullback?.meanPct != null &&
      Number.isFinite(typicalPullback.meanPct) &&
      Math.abs(pullbackPct - typicalPullback.meanPct) <= MEAN_TOLERANCE)
  ) {
    return {
      isSweetSpot: true,
      reason: "Pullback aligns with historical behaviour and price is near zone.",
    };
  }

  return {
    isSweetSpot: false,
    reason: "Current pullback does not align with historical sweet spot.",
  };
}
