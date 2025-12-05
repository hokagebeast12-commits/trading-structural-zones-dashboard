"use client";

import * as React from "react";
import type { SymbolCardProps } from "@/types/trading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PullbackDepthBlock } from "./pullback-depth-block";
import { CandidateStatusBlock } from "./candidate-status-block";

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
    fallbackClose,
    candidateDiagnostics,
    priceFormatter,
    children,
  } = props;

  const formatPrice = React.useMemo(() => {
    return priceFormatter ?? ((value: number) => value.toFixed(2));
  }, [priceFormatter]);

  const isCandidate = candidateStatus === "long" || candidateStatus === "short";
  const candidateBadgeVariant =
    candidateStatus === "long"
      ? "default"
      : candidateStatus === "short"
        ? "destructive"
        : "outline";

  return (
    <Card
      className={cn(
        "relative flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm transition-colors",
        "text-slate-100",
        isCandidate && "border-emerald-500/60",
      )}
    >
      {/* 1. Context row: symbol, ATR, trend, status */}
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
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    MACRO_TREND_BADGE[macroTrend],
                  )}
                >
                  {macroTrend === "bull" ? "Bull" : macroTrend === "bear" ? "Bear" : "Range"}
                </span>
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
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 p-0">
        {/* 2. Location row: nearest zone */}
        <section className="flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Nearest zone</p>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px] font-semibold", LOCATION_STYLE[nearestZone.label])}>
                {nearestZone.label}
              </Badge>
              <p className="text-xs text-slate-300">
                {formatPrice(nearestZone.distancePoints)} pts · {nearestZone.distancePercent.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="relative h-2 w-32 overflow-hidden rounded-full bg-slate-800">
            <div
              className="absolute inset-y-0 left-0 bg-slate-500/60"
              style={{ width: `${Math.min(Math.max(nearestZone.distancePercent, 0), 100)}%` }}
            />
          </div>
        </section>

        {/* 3. Pullback row: dedicated component */}
        <section className="rounded-xl bg-slate-900/70 px-3 py-2">
          <PullbackDepthBlock pullback={pullback} />
        </section>

        {/* 4. Exit / fallback row */}
        <section className="mt-auto flex items-center justify-between rounded-xl bg-slate-900/70 px-3 py-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Fallback closing price
            </p>
            <p className="text-sm font-medium tabular-nums">{formatPrice(fallbackClose.price)}</p>
            <p className="text-[11px] text-slate-400">{fallbackClose.timeframeLabel}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Close mode
              </span>
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
      </CardContent>
    </Card>
  );
}
