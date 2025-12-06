"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SectionHeaderProps {
  title: string;
  tooltip?: string;
}

export function SectionHeader({ title, tooltip }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{title}</p>
      {tooltip ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
              aria-label={`${title} details`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] leading-relaxed text-slate-200 shadow-lg">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}

