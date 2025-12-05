"use client";

import * as React from "react";
import type { PullbackSnapshotCard } from "@/types/trading";
import { cn } from "@/lib/utils";

interface PullbackDepthBlockProps {
  pullback: PullbackSnapshotCard;
}

export function PullbackDepthBlock({ pullback }: PullbackDepthBlockProps) {
  const depthPct =
    pullback.depthIntoPrevPct != null &&
    Number.isFinite(pullback.depthIntoPrevPct)
      ? pullback.depthIntoPrevPct * 100
      : null;
  const meanDepthPct =
    pullback.typicalMeanPct != null && Number.isFinite(pullback.typicalMeanPct)
      ? pullback.typicalMeanPct * 100
      : null;
  const medianDepthPct =
    pullback.typicalMedianPct != null &&
    Number.isFinite(pullback.typicalMedianPct)
      ? pullback.typicalMedianPct * 100
      : null;

  const clampedCurrent = clamp(depthPct);
  const clampedMean = clamp(meanDepthPct);

  const deviation =
    depthPct != null && meanDepthPct != null ? depthPct - meanDepthPct : null;

  const deviationLabel =
    deviation == null
      ? "No benchmark"
      : Math.abs(deviation) < 10
        ? "In typical range"
        : deviation > 0
          ? "Deeper than typical"
          : "Shallower than typical";

  const showDot = depthPct != null;
  const lookbackLabel = pullback.lookbackDays
    ? `Last ${pullback.lookbackDays}d`
    : "No lookback";
  const scenarioLabel = pullback.scenario
    ? `${pullback.scenario.macroTrendPrev} macro · ${pullback.scenario.trendDayPrev} trend day (${pullback.scenario.alignmentPrev})`
    : "No scenario context";

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
          <p className="text-[11px] text-slate-400">{scenarioLabel}</p>
        </div>

        <p
          className={cn(
            "text-[11px] font-medium",
            deviation == null && "text-slate-400",
            deviation != null && Math.abs(deviation) < 10 && "text-emerald-400",
            deviation != null && deviation > 10 && "text-amber-300",
            deviation != null && deviation < -10 && "text-sky-300",
          )}
        >
          {deviationLabel}
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
                left: `${Math.max(clampedMean - 10, 0)}%`,
                width: `${
                  Math.min(clampedMean + 10, 100) - Math.max(clampedMean - 10, 0)
                }%`,
              }}
            />
          ) : null}
          {/* current depth marker */}
          {showDot ? (
            <div
              className="absolute top-1/2 -mt-[5px] h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-md"
              style={{ left: `${clampedCurrent}%` }}
            />
          ) : null}
          {/* mean marker */}
          {Number.isFinite(meanDepthPct) ? (
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-slate-200/90"
              style={{ left: `${clampedMean}%` }}
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
          Depth measured as retrace into prior candle, filtered by matching trend day and macro trend.
        </span>
      </div>
    </div>
  );
}

function clamp(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}
