// src/lib/trading/nearest-zone.ts
import type { OcZone, NearestZoneInfo } from "./types";

/**
 * Compute nearest zone to a given spot price and classify proximity.
 *
 * Assumes OcZone fields:
 *  - zone_low
 *  - zone_high
 *  - zone_mid
 *  - score
 *  - zone_type? (optional)
 */
export function computeNearestZoneInfo(
  zones: OcZone[] | undefined,
  spot: number,
  atr20: number | null,
): NearestZoneInfo | null {
  if (!zones || zones.length === 0) return null;
  if (!Number.isFinite(spot)) return null;

  let bestZone: OcZone | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const z of zones) {
    if (
      z == null ||
      !Number.isFinite(z.zone_low) ||
      !Number.isFinite(z.zone_high)
    ) {
      continue;
    }

    const mid =
      Number.isFinite(z.zone_mid) && z.zone_mid !== 0
        ? z.zone_mid
        : (z.zone_low + z.zone_high) / 2;

    const d = Math.abs(spot - mid);
    if (d < bestDistance) {
      bestDistance = d;
      bestZone = z;
    }
  }

  if (!bestZone || !Number.isFinite(bestDistance)) {
    return null;
  }

  const mid =
    Number.isFinite(bestZone.zone_mid) && bestZone.zone_mid !== 0
      ? bestZone.zone_mid
      : (bestZone.zone_low + bestZone.zone_high) / 2;

  const distancePct = (bestDistance / spot) * 100;
  const distanceAtr =
    atr20 && atr20 > 0 ? bestDistance / atr20 : null;

  // Proximity classification
  let status: NearestZoneInfo["status"] = "FAR";

  if (atr20 && atr20 > 0) {
    // ATR-based thresholds
    if (bestDistance <= 0.1 * atr20) {
      status = "AT_ZONE";
    } else if (bestDistance <= 0.25 * atr20) {
      status = "NEAR";
    }
  } else {
    // Fallback on % distance only, if ATR is not available
    if (distancePct <= 0.1) {
      status = "AT_ZONE";
    } else if (distancePct <= 0.5) {
      status = "NEAR";
    }
  }

  const info: NearestZoneInfo = {
    spot,
    zone_low: bestZone.zone_low,
    zone_high: bestZone.zone_high,
    zone_mid: mid,
    score: bestZone.score,
    zone_type: bestZone.zone_type,

    distance: bestDistance,
    distancePct,
    distanceAtr,
    status,
  };

  return info;
}
