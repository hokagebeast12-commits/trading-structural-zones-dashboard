"use client";

import * as React from "react";
import type { SymbolCardProps } from "@/types/trading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PullbackDepthBlock } from "./pullback-depth-block";
import { CandidateStatusBlock } from "./candidate-status-block";
import { SectionHeader } from "./section-header";
import { SweetspotBlock } from "./sweetspot-block";
import { ChevronDown, ChevronUp } from "lucide-react";

const TREND_LABEL: Record<SymbolCardProps["macroTrend"], string> = {
  bull: "Bull",
  bear: "Bear",
  range: "Range",
};

const LOCATION_LABEL: Record<SymbolCardProps["location"], string> = {
  premium: "Premium",
  discount: "Discount",
  mid: "Mid",
};

const CANDIDATE_LABEL: Record<SymbolCardProps["candidateStatus"], string> = {
  none: "No trade candidate",
  watch: "Watchlist",
  long: "Long candidate",
  short: "Short candidate",
};

const STATUS_STYLES: Record<SymbolCardProps["candidateStatus"], string> = {
  none: "bg-slate-800 text-slate-200 border-slate-700",
  watch: "bg-amber-500/15 text-amber-200 border-amber-500/40",
  long: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  short: "bg-rose-500/15 text-rose-200 border-rose-500/40",
};

const LOCATION_STYLE: Record<SymbolCardProps["nearestZone"]["label"], string> = {
  NEAR: "bg-emerald-600 text-emerald-50",
  MID: "bg-sky-600 text-sky-50",
  FAR: "bg-slate-700 text-slate-50",
};

const MACRO_TREND_BADGE: Record<SymbolCardProps["macroTrend"], string> = {
  bull: "border-emerald-500/70 bg-emerald-500/15 text-emerald-300",
  bear: "border-rose-500/70 bg-rose-500/15 text-rose-300",
  range: "border-slate-600/70 bg-slate-800/50 text-slate-200",
};

export function SymbolCard(props: SymbolCardProps) {
  const {
    symbol,
    atr20,
    macroTrend,
    trendDay,
    alignment,
    location,
    candidateStatus,
    livePrice,
    livePriceSource,
    closeMode,
    nearestZone,
    pullback,
    sweetspotState,
    fallbackClose,
    candidateDiagnostics,
    priceFormatter,
    children,
    defaultCollapsed,
  } = props;

  const formatPrice = React.useMemo(() => {
    return priceFormatter ?? ((value: number) => value.toFixed(2));
  }, [priceFormatter]);

  const [collapsed, setCollapsed] = React.useState(defaultCollapsed ?? true);

  React.useEffect(() => {
    setCollapsed(defaultCollapsed ?? true);
  }, [defaultCollapsed]);

  const isCandidate = candidateStatus === "long" || candidateStatus === "short";
  const macroTrendLabel = macroTrend === "bull" ? "Bull" : macroTrend === "bear" ? "Bear" : "Range";
  const macroDiagnostics = props.macroTrendDiagnostics;
  const bullDays = macroDiagnostics?.bullDays ?? 0;
  const bearDays = macroDiagnostics?.bearDays ?? 0;
  const totalTrendDays = macroDiagnostics?.totalTrendDays ?? 0;
  const dominanceThreshold = macroDiagnostics?.dominanceThreshold ?? 0;
  const lookback = macroDiagnostics?.lookback ?? 0;
  const thresholdDescription =
    dominanceThreshold > 0 && totalTrendDays > 0
      ? `${dominanceThreshold}+ of ${totalTrendDays}`
      : "a 60% majority of the counted";
  const lookbackDescription = lookback > 0 ? `last ${lookback} sessions` : "recent sessions";
  const rangeReason =
    macroTrend === "range"
      ? "No side cleared the threshold, so the macro bias is Range."
      : "Dominant side cleared the threshold.";
  const candidateBadgeVariant =
    candidateStatus === "long"
      ? "default"
      : candidateStatus === "short"
        ? "destructive"
        : "outline";

  const nearestZoneSection = (
    <section className="rounded-xl bg-slate-900/70 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">Nearest zone</span>
          <Badge className={cn("text-[10px] font-semibold", LOCATION_STYLE[nearestZone.label])}>
            {nearestZone.label}
          </Badge>
        </div>
        <span className="text-xs text-slate-300">
          {formatPrice(nearestZone.distancePoints)} pts · {nearestZone.distancePercent.toFixed(2)}%
        </span>
      </div>
    </section>
  );

  const pullbackSection = (showDetails: boolean) => (
    <section className="rounded-xl bg-slate-900/70 px-3 py-2">
      <PullbackDepthBlock
        pullback={pullback}
        showDetails={showDetails}
      />
    </section>
  );

  const sweetspotSection = () => (
    <section className="rounded-xl bg-slate-900/70 px-3 py-2">
      <SweetspotBlock sweetspotState={sweetspotState} />
    </section>
  );

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm transition-colors",
        "text-slate-100",
        isCandidate && "border-emerald-500/60",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 p-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">{symbol}</h2>
            <Badge
              variant={candidateBadgeVariant}
              className={cn("text-xs", STATUS_STYLES[candidateStatus])}
            >
              {CANDIDATE_LABEL[candidateStatus]}
            </Badge>
          </div>

          <p className="text-xs text-slate-400">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Macro trend
                </span>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        MACRO_TREND_BADGE[macroTrend],
                      )}
                    >
                      {macroTrendLabel}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs space-y-1 text-left text-[11px]">
                    <p className="font-semibold text-slate-100">Macro trend: {macroTrendLabel}</p>
                    <p className="text-slate-200">
                      Bullish trend days: {bullDays} · Bearish trend days: {bearDays}
                    </p>
                    <p className="text-slate-400">
                      Uses the {lookbackDescription}. Needs {thresholdDescription} breakout days to call Bull/Bear.
                      {" "}
                      {rangeReason}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <span className="text-[11px] text-slate-400">
                · Latest trend day:{" "}
                <span
                  className={cn(
                    "font-medium",
                    trendDay === "bull" && "text-emerald-400",
                    trendDay === "bear" && "text-rose-400",
                    trendDay === "range" && "text-slate-300",
                  )}
                >
                  {TREND_LABEL[trendDay]}
                </span>
                {alignment === "counterLong" || alignment === "counterShort" ? (
                  <span className="ml-1 text-amber-300">(counter-trend)</span>
                ) : alignment === "alignedLong" || alignment === "alignedShort" ? (
                  <span className="ml-1 text-emerald-300">(aligned)</span>
                ) : null}
              </span>

              <span className="text-[11px] text-slate-400">
                · Location:{" "}
                <span
                  className={cn(
                    "font-medium",
                    location === "premium" && "text-rose-400",
                    location === "discount" && "text-emerald-400",
                    location === "mid" && "text-slate-200",
                  )}
                >
                  {LOCATION_LABEL[location]}
                </span>
              </span>

              <span className="text-[11px] text-slate-400">
                · ATR(20):{" "}
                <span className="font-medium text-slate-100">{atr20.toFixed(2)}</span>
              </span>
            </div>
          </p>
        </div>

        <div className="flex flex-col items-end gap-2 text-right">
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700/60 text-slate-400 hover:border-slate-400 hover:text-slate-100"
          >
            {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            <span className="sr-only">{collapsed ? "Expand details" : "Collapse details"}</span>
          </button>
          <div className="flex flex-col items-end gap-1 text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Live price</p>
            <p className="text-xl font-semibold tabular-nums">{formatPrice(livePrice)}</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  livePriceSource === "manual" && "border-sky-500/60 text-sky-200",
                  livePriceSource === "fallback" && "border-amber-500/60 text-amber-200",
                  livePriceSource === "live" && "border-emerald-500/60 text-emerald-200",
                )}
              >
                {livePriceSource} price
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-0">
        {collapsed ? (
          <>
            {nearestZoneSection}
            {pullbackSection(false)}
            {sweetspotSection()}
            {candidateStatus === "none" ? (
              <p className="text-xs text-slate-400">No trade candidate for this symbol.</p>
            ) : null}
          </>
        ) : (
          <>
            {nearestZoneSection}
            {sweetspotSection()}
            {pullbackSection(true)}

            <section className="mt-auto flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
              <div>
                <SectionHeader title="Fallback closing price" />
                <p className="text-sm font-medium tabular-nums">{formatPrice(fallbackClose.price)}</p>
                <p className="text-[11px] text-slate-400">{fallbackClose.timeframeLabel}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Close mode</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase tracking-wide",
                      closeMode === "manual"
                        ? "border-sky-500/60 text-sky-200"
                        : "border-emerald-500/60 text-emerald-200",
                    )}
                  >
                    {closeMode === "manual" ? "Manual close" : "Auto close"}
                  </Badge>
                </div>
              </div>

              <p className="max-w-[180px] text-right text-[11px] text-slate-400">
                Used if no intraday candidate is available for this symbol.
              </p>
            </section>

            <CandidateStatusBlock status={candidateStatus} diagnostics={candidateDiagnostics} />

            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}
