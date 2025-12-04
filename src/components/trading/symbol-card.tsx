"use client";

import * as React from "react";
import type { SymbolCardProps } from "@/types/trading";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PullbackDepthBlock } from "./pullback-depth-block";

const TREND_LABEL: Record<SymbolCardProps["trend"], string> = {
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

export function SymbolCard(props: SymbolCardProps) {
  const {
    symbol,
    atr20,
    trend,
    location,
    candidateStatus,
    livePrice,
    livePriceSource,
    closeMode,
    nearestZone,
    pullback,
    fallbackClose,
    priceFormatter,
    children,
  } = props;

  const formatPrice = React.useMemo(() => {
    return priceFormatter ?? ((value: number) => value.toFixed(2));
  }, [priceFormatter]);

  const isCandidate = candidateStatus === "long" || candidateStatus === "short";

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
              variant="outline"
              className={cn("text-xs", STATUS_STYLES[candidateStatus])}
            >
              {CANDIDATE_LABEL[candidateStatus]}
            </Badge>
          </div>

          <p className="text-xs text-slate-400">
            ATR(20):{" "}
            <span className="font-medium text-slate-100">{atr20.toFixed(2)}</span>{" "}
            · Trend: <span className="font-medium">{TREND_LABEL[trend]}</span> ·
            Location: <span className="font-medium">{LOCATION_LABEL[location]}</span>
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Live price</p>
          <p className="text-xl font-semibold tabular-nums">{formatPrice(livePrice)}</p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge
              variant={closeMode === "manual" ? "outline" : "default"}
              className="text-[10px] uppercase tracking-wide"
            >
              {closeMode === "manual" ? "Manual close" : "Auto close"}
            </Badge>
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
          </div>

          <p className="max-w-[180px] text-right text-[11px] text-slate-400">
            Used if no intraday candidate is available for this symbol.
          </p>
        </section>

        {children}
      </CardContent>
    </Card>
  );
}
