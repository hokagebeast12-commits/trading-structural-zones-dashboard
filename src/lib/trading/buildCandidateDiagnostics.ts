import type { CurrentPullbackSnapshot, NearestZoneInfo } from "./types";

export interface CandidateCondition {
  id: string;
  label: string;
  passed: boolean;
}

export interface CandidateDiagnostics {
  summary: string;
  conditions: CandidateCondition[];
}

export interface CandidateRuleInputs {
  trend: "Bull" | "Bear" | "Neutral";
  location: "Discount" | "Premium" | "Mid";
  nearestZone?: NearestZoneInfo | null;
  pullback?: CurrentPullbackSnapshot;
  hasModelSignal?: boolean;
  newsBlocked?: boolean;
}

function getLocationLabel(trend: CandidateRuleInputs["trend"]): string {
  if (trend === "Bull") return "Discount";
  if (trend === "Bear") return "Premium";
  return "value";
}

export function buildCandidateDiagnostics(
  inputs: CandidateRuleInputs,
): CandidateDiagnostics {
  const { trend, location, nearestZone, pullback, hasModelSignal, newsBlocked } =
    inputs;

  const hasDirectionalTrend = trend === "Bull" || trend === "Bear";
  const locationAligned =
    !hasDirectionalTrend ||
    ((trend === "Bull" && location === "Discount") ||
      (trend === "Bear" && location === "Premium"));
  const atOrNearZone =
    !!nearestZone &&
    (nearestZone.status === "AT_ZONE" || nearestZone.status === "NEAR");
  const hasPullbackDepth =
    pullback?.depthIntoPrevPct != null &&
    Number.isFinite(Number(pullback.depthIntoPrevPct));
  const modelSignalOk = hasModelSignal !== undefined ? !!hasModelSignal : true;
  const newsClear = newsBlocked !== undefined ? !newsBlocked : true;

  const conditions: CandidateCondition[] = [
    {
      id: "trend",
      label: "Directional trend identified (Bull/Bear)",
      passed: hasDirectionalTrend,
    },
    {
      id: "location",
      label: `Location aligns with bias (Bull → Discount, Bear → Premium)`,
      passed: locationAligned,
    },
    {
      id: "zone",
      label: "Price is at or near a structural zone",
      passed: atOrNearZone,
    },
    {
      id: "pullback",
      label: "Pullback depth available for the session",
      passed: hasPullbackDepth,
    },
  ];

  if (hasModelSignal !== undefined) {
    conditions.push({
      id: "model-signal",
      label: "At least one model produced a trade setup",
      passed: modelSignalOk,
    });
  }

  if (newsBlocked !== undefined) {
    conditions.push({
      id: "news-block",
      label: "No blocking high-impact news",
      passed: newsClear,
    });
  }

  const failing = conditions.filter((condition) => !condition.passed);

  let summary: string;
  if (!newsClear) {
    summary = "Trading is paused because of news risk.";
  } else if (failing.length === 0) {
    summary = "All candidate filters are satisfied.";
  } else {
    const failureLabels = failing.map((c) => c.label.toLowerCase());
    const expectedLocation = getLocationLabel(trend);

    summary = `Blocked by ${failing.length} filter${
      failing.length === 1 ? "" : "s"
    }: ${failureLabels.join("; ")}.`;

    if (!locationAligned && hasDirectionalTrend) {
      summary += ` (${location} vs expected ${expectedLocation} for ${trend} bias.)`;
    }
  }

  return {
    summary,
    conditions,
  };
}
