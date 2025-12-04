"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CandidateDiagnostics, CandidateStatus } from "@/types/trading";

interface CandidateStatusBlockProps {
  status: CandidateStatus;
  diagnostics?: CandidateDiagnostics;
}

const STATUS_LABEL: Record<CandidateStatus, string> = {
  none: "No trade candidate",
  watch: "On watchlist",
  long: "Long candidate",
  short: "Short candidate",
};

export function CandidateStatusBlock({
  status,
  diagnostics,
}: CandidateStatusBlockProps) {
  const isNone = status === "none";

  return (
    <section className="rounded-xl bg-slate-900/70 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">
            Trade candidates
          </p>
          <p
            className={cn(
              "text-sm font-medium",
              isNone && "text-slate-300",
              status === "long" && "text-emerald-400",
              status === "short" && "text-rose-400",
              status === "watch" && "text-amber-200",
            )}
          >
            {STATUS_LABEL[status]}
            {diagnostics && isNone && diagnostics.summary && (
              <span className="ml-1 text-xs text-slate-400">
                · {diagnostics.summary}
              </span>
            )}
          </p>
        </div>

        {diagnostics && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600/60 bg-slate-950/70 text-slate-300 hover:border-slate-400 hover:text-slate-50"
                aria-label="Show candidate filters"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              className="max-w-xs space-y-2 bg-slate-900 text-slate-50"
            >
              <p className="text-xs font-medium">{STATUS_LABEL[status]}</p>
              {diagnostics.summary && (
                <p className="text-[11px] text-slate-300">{diagnostics.summary}</p>
              )}

              <ul className="space-y-1 text-[11px]">
                {diagnostics.conditions.map((condition) => (
                  <li key={condition.id} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-[1px] text-xs",
                        condition.passed ? "text-emerald-400" : "text-rose-400",
                      )}
                    >
                      {condition.passed ? "✓" : "✕"}
                    </span>
                    <span className="text-slate-100">{condition.label}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </section>
  );
}
