import type React from "react";
import type { CandidateDiagnostics } from "@/lib/trading/types";

export type TrendDirection = "bull" | "bear" | "range";

export type LocationBucket = "premium" | "discount" | "mid";

export type ZoneProximityLabel = "NEAR" | "MID" | "FAR";

export type CandidateStatus = "none" | "watch" | "long" | "short";

export type CandidateCondition = CandidateDiagnostics["conditions"][number];
export type { CandidateDiagnostics };

export type CloseMode = "manual" | "auto";

export type LivePriceSource = "live" | "fallback" | "manual";

export interface NearestZoneInfo {
  label: ZoneProximityLabel;
  distancePoints: number;
  distancePercent: number;
}

export interface PullbackStats {
  currentDepthPct: number;
  fibBucketLabel: string;
  meanDepthPct: number;
  medianDepthPct: number;
  sampleCount: number;
  lookbackLabel: string;
}

export interface FallbackCloseInfo {
  price: number;
  timeframeLabel: string;
}

export interface SymbolCardProps {
  symbol: string;
  atr20: number;
  trend: TrendDirection;
  location: LocationBucket;
  candidateStatus: CandidateStatus;
  livePrice: number;
  livePriceSource: LivePriceSource;
  closeMode: CloseMode;
  nearestZone: NearestZoneInfo;
  pullback: PullbackStats;
  fallbackClose: FallbackCloseInfo;
  priceFormatter?: (price: number) => string;
  children?: React.ReactNode;
  candidateDiagnostics?: CandidateDiagnostics;
}
