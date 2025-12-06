"use client";

import * as React from "react";
import type { SymbolCardProps } from "@/types/trading";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./section-header";

const SWEETSPOT_LABEL: Record<NonNullable<SymbolCardProps["sweetspotState"]>, string> = {
  not_touched: "Not touched",
  currently_in: "In sweetspot",
  touched_and_rejected: "Rejected from sweetspot",
};

const SWEETSPOT_STYLE: Record<NonNullable<SymbolCardProps["sweetspotState"]>, string> = {
  not_touched: "border-slate-600 text-slate-200 bg-slate-900/60",
  currently_in: "border-emerald-500/70 text-emerald-200 bg-emerald-500/10",
  touched_and_rejected: "border-amber-500/70 text-amber-200 bg-amber-500/10",
};

interface SweetspotBlockProps {
  sweetspotState?: SymbolCardProps["sweetspotState"];
}

export function SweetspotBlock({ sweetspotState }: SweetspotBlockProps) {
  const sweetspotLabel = sweetspotState ? SWEETSPOT_LABEL[sweetspotState] : "Not available";
  const badge = sweetspotState ? sweetspotLabel.toUpperCase() : "NOT AVAILABLE";

  const sweetspotDescription = (() => {
    if (!sweetspotState) return "No recent sweetspot information available.";
    if (sweetspotState === "not_touched") {
      return "Price has not traded inside today's sweetspot band yet.";
    }
    if (sweetspotState === "currently_in") {
      return "Today's D1 price action is trading inside the sweetspot band.";
    }
    return "Price touched the sweetspot band earlier today and is currently outside it.";
  })();

  const sweetspotTooltip = sweetspotDescription;

  return (
    <div className="space-y-2">
      <SectionHeader
        title="Sweetspot (today)"
        tooltip={sweetspotTooltip}
      />

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-300">{sweetspotLabel}</span>
        {badge ? (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-medium uppercase",
              sweetspotState ? SWEETSPOT_STYLE[sweetspotState] : "border border-slate-700 text-slate-400",
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </div>
  );
}
