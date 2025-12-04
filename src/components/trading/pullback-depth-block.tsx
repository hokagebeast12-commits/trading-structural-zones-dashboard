"use client";

import * as React from "react";
import type { PullbackStats } from "@/types/trading";
import { cn } from "@/lib/utils";

interface PullbackDepthBlockProps {
  pullback: PullbackStats;
}

export function PullbackDepthBlock({ pullback }: PullbackDepthBlockProps) {
  const {
    currentDepthPct,
    fibBucketLabel,
    meanDepthPct,
    medianDepthPct,
    sampleCount,
    lookbackLabel,
  } = pullback;

  const clampedCurrent = clamp(currentDepthPct);
  const clampedMean = clamp(meanDepthPct);

  const deviation = currentDepthPct - meanDepthPct;

  const deviationLabel =
    Math.abs(deviation) < 10
      ? "In typical range"
      : deviation > 0
        ? "Deeper than typical"
        : "Shallower than typical";

  return (
    <div className="space-y-2">
      {/* Title row */}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Pullback depth
          </p>
          <p className="text-sm font-medium text-slate-50">
            {Number.isFinite(currentDepthPct) ? currentDepthPct.toFixed(1) : "-"}%
            <span className="ml-1 text-[11px] text-slate-400">
              ({fibBucketLabel || "N/A"})
            </span>
          </p>
        </div>

        <p
          className={cn(
            "text-[11px] font-medium",
            Math.abs(deviation) < 10 && "text-emerald-400",
            deviation > 10 && "text-amber-300",
            deviation < -10 && "text-sky-300",
          )}
        >
          {deviationLabel}
        </p>
      </div>

      {/* Visual bar: 0–100% with current + mean markers */}
      <div className="space-y-1">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
          {/* typical range band (±10% around mean) */}
          <div
            className="absolute inset-y-0 bg-slate-700/80"
            style={{
              left: `${Math.max(clampedMean - 10, 0)}%`,
              width: `${
                Math.min(clampedMean + 10, 100) - Math.max(clampedMean - 10, 0)
              }%`,
            }}
          />
          {/* current depth marker */}
          <div
            className="absolute top-1/2 -mt-[5px] h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-md"
            style={{ left: `${clampedCurrent}%` }}
          />
          {/* mean marker */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-slate-200/90"
            style={{ left: `${clampedMean}%` }}
          />
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
            {Number.isFinite(meanDepthPct) ? meanDepthPct.toFixed(1) : "-"}%
          </span>
        </span>
        <span>
          Median:{" "}
          <span className="font-medium text-slate-100">
            {Number.isFinite(medianDepthPct) ? medianDepthPct.toFixed(1) : "-"}%
          </span>
        </span>
        <span className="text-slate-500">
          {lookbackLabel} · {sampleCount} samples
        </span>
      </div>
    </div>
  );
}

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}
