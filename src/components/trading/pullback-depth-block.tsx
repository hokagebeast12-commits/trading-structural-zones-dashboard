"use client";

import * as React from "react";
import type { PullbackSnapshotCard } from "@/types/trading";
import { cn } from "@/lib/utils";

interface PullbackDepthBlockProps {
  pullback: PullbackSnapshotCard;
  macroTrendLabel: string;
  latestTrendDayLabel: string;
}

export function PullbackDepthBlock({
  pullback,
  macroTrendLabel,
  latestTrendDayLabel,
}: PullbackDepthBlockProps) {
  const depth =
    pullback.depthIntoPrevPct != null &&
    Number.isFinite(pullback.depthIntoPrevPct)
      ? pullback.depthIntoPrevPct
      : null;
  const depthPct = depth != null ? depth * 100 : null;

  const meanDepth =
    pullback.typicalMeanPct != null && Number.isFinite(pullback.typicalMeanPct)
      ? pullback.typicalMeanPct
      : null;
  const meanDepthPct = meanDepth != null ? meanDepth * 100 : null;

  const medianDepthPct =
    pullback.typicalMedianPct != null &&
    Number.isFinite(pullback.typicalMedianPct)
      ? pullback.typicalMedianPct * 100
      : null;

  const clampedCurrentPct = clampPct(depthPct);
  const clampedMeanPct = clampPct(meanDepthPct);

  const deviation =
    depth != null && meanDepth != null ? depth - meanDepth : null;

  const deviationLabel =
    deviation == null
      ? "No benchmark"
      : Math.abs(deviation) < 0.1
        ? "In typical range"
        : deviation > 0
          ? "Deeper than typical"
          : "Shallower than typical";

  const hasDepth = depth != null;
  const clampedDepth = hasDepth ? Math.max(0, Math.min(depth, 1)) : 0;
  const lookbackLabel = pullback.lookbackDays
    ? `Last ${pullback.lookbackDays}d`
    : "No lookback";
  const macroSuffix = macroTrendLabel === "Range" ? " (neutral bias)" : "";
  const scenarioLabel = pullback.scenario
    ? `Macro trend: ${macroTrendLabel}${macroSuffix} · Latest trend day: ${latestTrendDayLabel}`
    : "No scenario context";

  const noBenchmarkLabel =
    "No benchmark · Not enough historical pullbacks in similar conditions yet.";

  return (
    <div className="space-y-2">
      {/* Title row */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Pullback depth
          </p>
          <p className="text-sm font-medium text-slate-50">
            {depthPct != null ? depthPct.toFixed(1) : "-"}%
            <span className="ml-1 text-[11px] text-slate-400">
              ({pullback.bucket ?? "N/A"})
            </span>
          </p>
          <p className="text-xs text-slate-400">{scenarioLabel}</p>
        </div>

        <p
          className={cn(
            "text-[11px] font-medium",
            deviation == null && "text-slate-400",
            deviation != null && Math.abs(deviation) < 0.1 && "text-emerald-400",
            deviation != null && deviation > 0.1 && "text-amber-300",
            deviation != null && deviation < -0.1 && "text-sky-300",
          )}
        >
          {pullback.sampleCount === 0 ? noBenchmarkLabel : deviationLabel}
        </p>
      </div>

      {/* Visual bar: 0–100% with current + mean markers */}
      <div className="space-y-1">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
          {/* typical range band (±10% around mean) */}
          {meanDepthPct != null ? (
            <div
              className="absolute inset-y-0 bg-slate-700/80"
              style={{
                left: `${Math.max(clampedMeanPct - 10, 0)}%`,
                width: `${
                  Math.min(clampedMeanPct + 10, 100) -
                  Math.max(clampedMeanPct - 10, 0)
                }%`,
              }}
            />
          ) : null}
          {/* current depth marker */}
          {hasDepth ? (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]"
              style={{ left: `${clampedDepth * 100}%` }}
            />
          ) : null}
          {/* mean marker */}
          {Number.isFinite(meanDepthPct) ? (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-slate-200/90"
              style={{ left: `${clampedMeanPct}%` }}
            />
          ) : null}
        </div>

        <div className="flex justify-between text-[10px] text-slate-500">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Statistical context */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span>
          Typical mean:{" "}
          <span className="font-medium text-slate-100">
            {meanDepthPct != null ? meanDepthPct.toFixed(1) : "-"}%
          </span>
        </span>
        <span>
          Median:{" "}
          <span className="font-medium text-slate-100">
            {medianDepthPct != null ? medianDepthPct.toFixed(1) : "-"}%
          </span>
        </span>
        <span className="text-slate-500">
          {lookbackLabel} · {pullback.sampleCount} samples
        </span>
        <span className="text-slate-500">
          Depth shows how far the current price has pulled back into yesterday’s daily candle, as a percentage of yesterday’s full high–low range. 0% = no retrace, 100% = a full retrace to the opposite extreme, and values above 100% mean price has moved beyond yesterday’s range. Typical stats come from past days with the same macro trend and trend-day type.
        </span>
      </div>
    </div>
  );
}

function clampPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}
