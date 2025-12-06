"use client";

import * as React from "react";
import type { PullbackSnapshotCard } from "@/types/trading";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

interface PullbackDepthBlockProps {
  pullback: PullbackSnapshotCard;
  showDetails?: boolean;
}

export function PullbackDepthBlock({
  pullback,
  showDetails = true,
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
  const hasCurrentDepth = Number.isFinite(depthPct);
  const hasBenchmark = Number.isFinite(meanDepthPct) && pullback.sampleCount > 0;
  const clampedDepth = hasDepth ? Math.max(0, Math.min(depth, 1)) : 0;
  const lookbackLabel = pullback.lookbackDays
    ? `Last ${pullback.lookbackDays}d`
    : "No lookback";

  const noBenchmarkLabel =
    "No benchmark · Not enough historical pullbacks in similar conditions yet.";

  let statusText: string;

  if (!hasCurrentDepth && !hasBenchmark) {
    statusText = noBenchmarkLabel;
  } else if (!hasCurrentDepth && hasBenchmark) {
    statusText = `No current depth · Historical benchmark only (${pullback.sampleCount} samples).`;
  } else if (hasCurrentDepth && !hasBenchmark) {
    statusText =
      "No benchmark yet · This is the first pullback in similar conditions.";
  } else {
    statusText = deviationLabel;
  }

  const tooltipText =
    "Depth shows how far the current price has pulled back into yesterday’s daily candle, as a percentage of yesterday’s full high–low range. 0% = no retrace, 100% = a full retrace to the opposite extreme, and values above 100% mean price has moved beyond yesterday’s range. Typical stats come from past days with the same macro trend and trend-day type.";

  return (
    <div className="space-y-2">
      <SectionHeader title="Pullback depth" tooltip={tooltipText} />

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-slate-50">
          {depthPct != null ? depthPct.toFixed(1) : "-"}%
          <span className="ml-1 text-[11px] text-slate-400">({pullback.bucket ?? "N/A"})</span>
        </div>
        <div
          className={cn(
            "text-xs text-right text-slate-300",
            deviation != null && Math.abs(deviation) < 0.1 && "text-emerald-300",
            deviation != null && deviation > 0.1 && "text-amber-200",
            deviation != null && deviation < -0.1 && "text-sky-200",
          )}
        >
          {statusText}
        </div>
      </div>

      {showDetails && hasBenchmark ? (
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-800">
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

              {hasDepth ? (
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]"
                  style={{ left: `${clampedDepth * 100}%` }}
                />
              ) : null}

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

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Typical mean: <span className="font-medium text-slate-100">
                {meanDepthPct != null ? meanDepthPct.toFixed(1) : "-"}%
              </span>{" "}
              · Median: <span className="font-medium text-slate-100">
                {medianDepthPct != null ? medianDepthPct.toFixed(1) : "-"}%
              </span>
            </span>
            <span className="text-slate-500">{lookbackLabel} · {pullback.sampleCount} samples</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function clampPct(value: number | null) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}
