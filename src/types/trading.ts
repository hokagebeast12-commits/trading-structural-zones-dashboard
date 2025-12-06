import type React from "react";
import type { CandidateDiagnostics } from "@/lib/trading/types";
import type { SweetspotState } from "@/lib/trading/pullback-analysis";

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

export type PullbackBucket =
  | "0-0.382"
  | "0.382-0.5"
  | "0.5-0.618"
  | "0.618-0.786"
  | "0.786-1.0"
  | "1.0+";

export interface PullbackScenarioKey {
  macroTrendPrev: "Bull" | "Bear" | "Neutral";
  trendDayPrev: "Bull" | "Bear" | "Neutral";
  alignmentPrev:
    | "AlignedLong"
    | "AlignedShort"
    | "CounterLong"
    | "CounterShort"
    | "Neutral";
}

export interface PullbackSnapshotCard {
  depthIntoPrevPct: number | null;
  bucket: PullbackBucket | null;
  scenario: PullbackScenarioKey | null;
  typicalMeanPct: number | null;
  typicalMedianPct: number | null;
  sampleCount: number;
  lookbackDays: number;
}

export interface FallbackCloseInfo {
  price: number;
  timeframeLabel: string;
}

export interface MacroTrendDiagnostics {
  bullDays: number;
  bearDays: number;
  totalTrendDays: number;
  dominanceThreshold: number;
  lookback: number;
}

export interface SymbolCardProps {
  symbol: string;
  atr20: number;
  macroTrend: TrendDirection;
  macroTrendDiagnostics?: MacroTrendDiagnostics;
  trendDay: TrendDirection;
  alignment:
    | "alignedLong"
    | "alignedShort"
    | "counterLong"
    | "counterShort"
    | "neutral";
  location: LocationBucket;
  candidateStatus: CandidateStatus;
  livePrice: number;
  livePriceSource: LivePriceSource;
  closeMode: CloseMode;
  nearestZone: NearestZoneInfo;
  pullback: PullbackSnapshotCard;
  sweetspotState?: SweetspotState | null;
  fallbackClose: FallbackCloseInfo;
  priceFormatter?: (price: number) => string;
  children?: React.ReactNode;
  candidateDiagnostics?: CandidateDiagnostics;
  defaultCollapsed?: boolean;
}
