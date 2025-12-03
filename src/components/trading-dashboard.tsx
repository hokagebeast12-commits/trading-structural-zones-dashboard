"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type {
  ScanResponse,
  SymbolCode,
  TradeCandidate,
  SymbolScanResult,
} from "@/lib/trading/types";
import { SYMBOLS, isSymbolScanError } from "@/lib/trading/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const DECIMALS: Record<string, number> = {
  XAUUSD: 2,
  EURUSD: 5,
  GBPUSD: 5,
  GBPJPY: 3,
};

const SYMBOLS_LIST = SYMBOLS;

function formatPrice(
  symbol: string | SymbolCode,
  price: number | null | undefined,
) {
  if (price == null || Number.isNaN(price)) return "-";
  const d = DECIMALS[String(symbol)] ?? 5;
  return price.toFixed(d);
}

type ViewKey = "dashboard" | "signals" | "settings";
const VIEW_KEYS: ViewKey[] = ["dashboard", "signals", "settings"];

function parseViewParam(value: string | null): ViewKey | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  return VIEW_KEYS.includes(lower as ViewKey) ? (lower as ViewKey) : null;
}

type ScanSettings = {
  symbols: Record<SymbolCode, boolean>;
  minRr: number;
  spreadCap: number;
  atrWindow: number;
  structureLookback: number;
};

type ManualCloseState = Record<SymbolCode, { enabled: boolean; value: string }>;

interface FlattenedTradeRow {
  symbol: SymbolCode;
  trend: SymbolScanResult["trend"];
  location: SymbolScanResult["location"];
  trade: TradeCandidate;
}

function navItemClasses(isActive: boolean): string {
  return [
    "w-full text-left rounded-lg px-3 py-2 text-sm",
    isActive
      ? "bg-slate-900 text-slate-100 font-medium"
      : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-100",
  ].join(" ");
}

export default function TradingDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [signals, setSignals] = useState<ScanResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [sortKey, setSortKey] = useState<
    "symbol" | "direction" | "rr" | "trend" | "status"
  >("symbol");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [symbolFilter, setSymbolFilter] = useState<SymbolCode | "all">("all");
  const [directionFilter, setDirectionFilter] = useState<string | "all">(
    "all",
  );
  const [trendFilter, setTrendFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [scanSettings, setScanSettings] = useState<ScanSettings>(() => ({
    symbols: SYMBOLS_LIST.reduce(
      (acc, symbol) => ({ ...acc, [symbol]: true }),
      {} as Record<SymbolCode, boolean>,
    ),
    minRr: 2.0,
    spreadCap: 1.0,
    atrWindow: 20,
    structureLookback: 60,
  }));
  const [manualCloses, setManualCloses] = useState<ManualCloseState>(() =>
    SYMBOLS_LIST.reduce(
      (acc, symbol) => ({ ...acc, [symbol]: { enabled: false, value: "" } }),
      {} as ManualCloseState,
    ),
  );

  const symbolsList = useMemo(() => SYMBOLS_LIST, []);
  const manualClosePayload = useMemo(() => {
    const payload: Partial<
      Record<SymbolCode, { enabled: boolean; close?: number }>
    > = {};

    symbolsList.forEach((symbol) => {
      const state = manualCloses[symbol];
      if (!state || !scanSettings.symbols[symbol]) return;

      const parsed = Number(state.value);
      if (state.enabled && Number.isFinite(parsed)) {
        payload[symbol] = { enabled: true, close: parsed };
      }
    });

    return payload;
  }, [manualCloses, scanSettings.symbols, symbolsList]);

  const scanPayload = useMemo(() => {
    const payload: {
      symbols: SymbolCode[];
      filters: { minRr: number; spreadCap: number };
      params: {
        atrWindow: number;
        structureLookback: number;
      };
      manualCloses?: Partial<
        Record<SymbolCode, { enabled: boolean; close?: number }>
      >;
    } = {
      symbols: symbolsList.filter((symbol) => scanSettings.symbols[symbol]),
      filters: {
        minRr: scanSettings.minRr,
        spreadCap: scanSettings.spreadCap,
      },
      params: {
        atrWindow: scanSettings.atrWindow,
        structureLookback: scanSettings.structureLookback,
      },
    };

    if (Object.keys(manualClosePayload).length > 0) {
      payload.manualCloses = manualClosePayload;
    }

    return payload;
  }, [manualClosePayload, scanSettings, symbolsList]);

  async function fetchScan() {
    if (!scanPayload.symbols.length) {
      setErrorMessage("Select at least one symbol before scanning.");
      setSignals(null);
      return;
    }

    for (const symbol of symbolsList) {
      const manual = manualCloses[symbol];
      if (manual?.enabled && scanSettings.symbols[symbol]) {
        const parsed = Number(manual.value);
        if (!Number.isFinite(parsed)) {
          setErrorMessage(
            `Manual 1h close for ${symbol} must be a valid number when enabled.`,
          );
          setSignals(null);
          return;
        }
      }
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(scanPayload),
      });
      if (!res.ok) {
        setErrorMessage("Scan failed – please try again.");
        setSignals(null);
        return;
      }

      const data = await res.json();
      if (!data || !Array.isArray(data.signals)) {
        setErrorMessage("Unexpected scan response format.");
        setSignals(null);
        return;
      }

      setSignals(data.signals);
    } catch (err) {
      console.error("Error fetching scan:", err);
      setErrorMessage("Scan failed – please try again.");
      setSignals(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const viewFromUrl = parseViewParam(searchParams?.get("view"));

    if (viewFromUrl) {
      if (viewFromUrl !== activeView) {
        setActiveView(viewFromUrl);
      }
      return;
    }

    if (searchParams) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "dashboard");
      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;
      router.replace(nextUrl);
    } else if (activeView !== "dashboard") {
      setActiveView("dashboard");
    }
  }, [activeView, pathname, router, searchParams]);

  const handleViewChange = (view: ViewKey) => {
    setActiveView(view);

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("view", view);
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    router.replace(nextUrl);
  };

  useEffect(() => {
    // Initial fetch on mount
    fetchScan();
  }, []);

  const latestScan = signals && signals.length > 0 ? signals[0] : null;
  const lastScanDate = latestScan?.date ?? null;

  const hasAnyTrades =
    !!latestScan &&
    Object.values(latestScan.symbols).some(
      (entry) => entry && !isSymbolScanError(entry) && entry.trades?.length,
    );

  // Flatten all trades across symbols for the Signals view
  const allTrades = useMemo<FlattenedTradeRow[]>(() => {
    if (!latestScan) return [];

    const rows: FlattenedTradeRow[] = [];

    (Object.keys(latestScan.symbols) as SymbolCode[]).forEach((symbol) => {
      const s = latestScan.symbols[symbol];
      if (!s || isSymbolScanError(s) || !s.trades) return;
      s.trades.forEach((trade) => {
        rows.push({
          symbol,
          trend: s.trend,
          location: s.location,
          trade,
        });
      });
    });

    return rows;
  }, [latestScan]);

  const symbolOptions = useMemo(() => {
    const options = new Set<SymbolCode>();
    allTrades.forEach((row) => options.add(row.symbol));
    return Array.from(options);
  }, [allTrades]);

  const directionOptions = useMemo(() => {
    const options = new Set<string>();
    allTrades.forEach((row) => {
      if (row.trade.direction) options.add(row.trade.direction);
    });
    return Array.from(options);
  }, [allTrades]);

  const trendOptions = useMemo(() => {
    const options = new Set<string>();
    allTrades.forEach((row) => {
      if (row.trend) options.add(row.trend);
    });
    return Array.from(options);
  }, [allTrades]);

  const statusOptions = useMemo(() => {
    const options = new Set<string>();
    allTrades.forEach((row) => {
      if (row.trade.status) options.add(row.trade.status);
    });
    return Array.from(options);
  }, [allTrades]);

  const filteredTrades = useMemo<FlattenedTradeRow[]>(() => {
    return allTrades.filter((row) => {
      if (symbolFilter !== "all" && row.symbol !== symbolFilter) return false;
      if (
        directionFilter !== "all" &&
        row.trade.direction?.toLowerCase() !== directionFilter.toLowerCase()
      )
        return false;
      if (trendFilter !== "all" && row.trend !== trendFilter) return false;
      if (statusFilter !== "all" && row.trade.status !== statusFilter)
        return false;
      return true;
    });
  }, [allTrades, directionFilter, statusFilter, symbolFilter, trendFilter]);

  const sortedTrades = useMemo<FlattenedTradeRow[]>(() => {
    const rows = [...filteredTrades];

    rows.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;

      const getValue = (row: FlattenedTradeRow) => {
        switch (sortKey) {
          case "rr":
            return row.trade.rr ?? Number.NEGATIVE_INFINITY;
          case "direction":
            return row.trade.direction?.toString().toLowerCase() ?? "";
          case "trend":
            return row.trend?.toLowerCase() ?? "";
          case "status":
            return row.trade.status?.toLowerCase() ?? "";
          case "symbol":
          default:
            return row.symbol.toLowerCase();
        }
      };

      const aValue = getValue(a);
      const bValue = getValue(b);

      if (typeof aValue === "number" && typeof bValue === "number") {
        return (aValue - bValue) * dir;
      }

      return aValue.toString().localeCompare(bValue.toString()) * dir;
    });

    return rows;
  }, [filteredTrades, sortDirection, sortKey]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  return (
    <div
      className="min-h-screen flex bg-[#050816] text-slate-100"
      aria-busy={loading}
    >
      {/* Sidebar (md+) */}
      <aside className="hidden md:flex md:flex-col w-[260px] border-r border-slate-800 bg-[#050816] p-4">
        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
            TRADING DESK
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-100">
            Structural Scanner
          </div>
        </div>

        <nav className="space-y-1 text-sm">
          <button
            type="button"
            className={navItemClasses(activeView === "dashboard")}
            onClick={() => handleViewChange("dashboard")}
            disabled={loading}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={navItemClasses(activeView === "signals")}
            onClick={() => handleViewChange("signals")}
            disabled={loading}
          >
            Signals
          </button>
          <button
            type="button"
            className={navItemClasses(activeView === "settings")}
            onClick={() => handleViewChange("settings")}
            disabled={loading}
          >
            Settings
          </button>
        </nav>

        <div className="mt-auto pt-6 text-xs text-slate-500">
          Prototype • Not live trading
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between bg-[#050816]">
          <div>
            <h1 className="text-base md:text-lg font-semibold">
              Trading Dashboard
            </h1>
            <p className="text-xs text-slate-400">
              Structural zone scan across configured symbols
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastScanDate && (
              <span className="hidden sm:inline text-xs text-slate-400">
                Last scan: {lastScanDate}
              </span>
            )}
            <Button
              size="sm"
              disabled={loading}
              onClick={fetchScan}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950"
            >
              {loading ? "Scanning…" : "Run Scan"}
            </Button>
          </div>
        </header>

        {/* Mobile nav (simple pills) */}
        <div className="md:hidden sticky top-0 z-10 bg-[#050816] px-4 pt-3 pb-3">
          <div className="flex gap-2 text-xs">
            {(["dashboard", "signals", "settings"] as ViewKey[]).map(
              (view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => handleViewChange(view)}
                  className={[
                    "px-3 py-1 rounded-full border",
                    activeView === view
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 bg-slate-900/40 text-slate-300",
                    loading && "opacity-50 cursor-not-allowed",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={loading}
                >
                  {view === "dashboard"
                    ? "Dashboard"
                    : view === "signals"
                    ? "Signals"
                    : "Settings"}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto px-4 md:px-6 py-4 md:py-6 space-y-6">
          {/* Error state */}
          {errorMessage && (
            <div className="rounded-lg border border-red-700 bg-red-900/40 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {activeView === "dashboard" && (
            <>
              {/* Market Scan intro */}
              <section className="space-y-1">
                <h2 className="text-lg font-semibold">Market Scan</h2>
                <p className="text-xs md:text-sm text-slate-400">
                  Run a structural scan across all configured symbols.
                  Results include trend, location, and model-based trade
                  candidates.
                </p>
              </section>

              {/* Empty state */}
              {!errorMessage &&
                !loading &&
                (!latestScan || !hasAnyTrades) && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
                    No trade candidates yet. Run a scan to generate fresh
                    signals.
                  </div>
                )}

              {/* Symbol cards */}
              {latestScan && (
                <section className="grid gap-4 md:gap-6 md:grid-cols-2">
                  {symbolsList.map((symbol) => {
                    const symbolResult = latestScan.symbols[symbol];
                    if (!symbolResult) return null;

                    if (isSymbolScanError(symbolResult)) {
                      return (
                        <Card
                          key={symbol}
                          className="border border-rose-700 bg-rose-950/40 shadow-[0_0_0_1px_rgba(127,29,29,0.5)]"
                        >
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <div>
                          <CardTitle className="text-sm font-semibold text-sky-100">
                            {symbol}
                          </CardTitle>
                              <p className="text-xs text-rose-200/80">
                                Scan failed for this symbol.
                              </p>
                            </div>
                            <span className="inline-flex items-center rounded-full border border-rose-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-rose-100">
                              Error
                            </span>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="rounded-lg border border-rose-800 bg-rose-900/50 px-3 py-3 text-xs text-rose-100">
                              {symbolResult.error || "Unknown error"}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }

                    const trend = symbolResult.trend;
                    const location = symbolResult.location;
                    const trades = symbolResult.trades ?? [];
                    const livePrice = symbolResult.livePrice;
                    const nearestZone = symbolResult.nearestZone;

                    const spotDisplay =
                      livePrice?.spot != null && Number.isFinite(livePrice.spot)
                        ? formatPrice(symbol, livePrice.spot)
                        : "-";
                    const source = livePrice?.source;
                    const isManualSource = source === "manual";
                    const status = nearestZone?.status;

                    const statusChip = status
                      ? {
                          AT_ZONE:
                            "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
                          NEAR: "bg-amber-500/15 text-amber-200 border-amber-500/40",
                          FAR: "bg-slate-700/50 text-slate-200 border-slate-600/60",
                        }[status]
                      : "bg-slate-800/60 text-slate-300 border-slate-700/80";

                    const sourceChip =
                      source === "manual"
                        ? "bg-sky-500/20 text-sky-100 border-sky-500/40"
                        : source === "fallback"
                          ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                          : source === "live"
                            ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
                            : "bg-slate-800/60 text-slate-300 border-slate-700/80";

                    const trendColor =
                      trend === "Bull"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : trend === "Bear"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : "bg-slate-700/40 text-slate-200 border-slate-600/60";

                    const locColor =
                      location === "Discount"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : location === "Premium"
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-slate-700/40 text-slate-200";

                    return (
                      <Card
                        key={symbol}
                        className="border border-slate-800 bg-slate-900/40 shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                      >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                          <div>
                            <CardTitle className="text-sm font-semibold text-sky-100">
                              {symbol}
                            </CardTitle>
                            <p className="text-xs text-slate-400">
                              ATR(20):{" "}
                              {symbolResult.atr20?.toFixed(2) ?? "-"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${trendColor}`}
                            >
                              {trend || "Neutral"}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${locColor}`}
                            >
                              {location || "Mid"}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="mb-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                            <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                Live Price
                              </p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-sm font-semibold text-slate-50">
                                  {spotDisplay}
                                </span>
                                <span
                                  className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${sourceChip}`}
                                >
                                  {source ?? "unknown"}
                                </span>
                              </div>
                              {isManualSource && (
                                <div className="mt-2 flex justify-end">
                                  <span className="inline-flex items-center rounded-full border border-sky-500/50 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-100">
                                    Manual Close
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                Nearest Zone
                              </p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-sm font-semibold text-slate-50">
                                  {status ?? "-"}
                                </span>
                                <span
                                  className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusChip}`}
                                >
                                  {status ?? "N/A"}
                                </span>
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                                Fallback Close
                              </p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-sm font-semibold text-slate-50">
                                  {formatPrice(symbol, symbolResult.lastClose)}
                                </span>
                                <span className="ml-2 inline-flex items-center rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
                                  Daily
                                </span>
                              </div>
                            </div>
                          </div>
                          {trades.length === 0 ? (
                            <div className="py-4 text-xs text-slate-400">
                              No trade candidates for this symbol.
                            </div>
                          ) : (
                            <div
                              className={`overflow-x-auto ${
                                loading ? "pointer-events-none opacity-50" : ""
                              }`}
                            >
                              <table className="w-full text-[13px]">
                                <thead>
                                  <tr className="bg-slate-800 text-slate-50">
                                    <th className="px-2 py-2 text-left font-semibold">
                                      Model
                                    </th>
                                    <th className="px-2 py-2 text-left font-semibold">
                                      Dir
                                    </th>
                                    <th className="px-2 py-2 text-right font-semibold">
                                      Entry
                                    </th>
                                    <th className="px-2 py-2 text-right font-semibold">
                                      Stop
                                    </th>
                                    <th className="px-2 py-2 text-right font-semibold">
                                      TP1
                                    </th>
                                    <th className="px-2 py-2 text-right font-semibold">
                                      R:R
                                    </th>
                                    <th className="px-2 py-2 text-left font-semibold">
                                      Stop Type
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {trades.map((t: TradeCandidate, idx: number) => (
                                    <tr
                                      key={idx}
                                      className="border-b border-slate-700 bg-slate-900 text-slate-50 hover:bg-slate-800"
                                    >
                                      <td className="px-2 py-1.5 font-semibold">
                                        {t.model}
                                      </td>
                                      <td className="px-2 py-1.5 font-semibold">
                                        {t.direction}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-semibold">
                                        {formatPrice(symbol, t.entry)}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-semibold">
                                        {formatPrice(symbol, t.stop)}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-semibold">
                                        {formatPrice(symbol, t.tp1)}
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-semibold">
                                        {t.rr?.toFixed(2) ?? "-"}
                                      </td>
                                      <td className="px-2 py-1.5 font-semibold">
                                        {t.stopType ?? "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </section>
              )}
            </>
          )}

          {/* SIGNALS VIEW */}
          {activeView === "signals" && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Signals</h2>
                <p className="text-xs md:text-sm text-slate-400">
                  Flattened list of all current trade candidates from the
                  latest scan.
                </p>
              </div>

              {!latestScan || allTrades.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
                  No trade candidates available yet. Run a scan on the
                  Dashboard to generate signals.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Symbol</span>
                      <select
                        value={symbolFilter}
                        onChange={(e) =>
                          setSymbolFilter(
                            (e.target.value as SymbolCode | "all") ?? "all",
                          )
                        }
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="all">All</option>
                        {symbolOptions.map((symbol) => (
                          <option key={symbol} value={symbol}>
                            {symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Direction</span>
                      <select
                        value={directionFilter}
                        onChange={(e) =>
                          setDirectionFilter((e.target.value as string) || "all")
                        }
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="all">All</option>
                        {directionOptions.map((dir) => (
                          <option key={dir} value={dir}>
                            {dir}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Trend</span>
                      <select
                        value={trendFilter}
                        onChange={(e) => setTrendFilter(e.target.value || "all")}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="all">All</option>
                        {trendOptions.map((trend) => (
                          <option key={trend} value={trend}>
                            {trend}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <span>Status</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value || "all")}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      >
                        <option value="all">All</option>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSymbolFilter("all");
                        setDirectionFilter("all");
                        setTrendFilter("all");
                        setStatusFilter("all");
                      }}
                      className="text-xs text-slate-200 hover:text-slate-50"
                    >
                      Clear filters
                    </Button>
                  </div>

                  <div
                    className={`rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 overflow-x-auto ${
                      loading ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="bg-slate-800 text-slate-50">
                          <th
                            scope="col"
                            className="px-2 py-2 text-left font-semibold"
                            aria-sort={sortKey === "symbol" ? sortDirection : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("symbol")}
                              className="flex items-center gap-1"
                            >
                              Symbol
                              {sortKey === "symbol" && (
                                <span aria-hidden>
                                  {sortDirection === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </button>
                          </th>
                          <th className="px-2 py-2 text-left font-semibold">
                            Model
                          </th>
                          <th
                            scope="col"
                            className="px-2 py-2 text-left font-semibold"
                            aria-sort={sortKey === "direction" ? sortDirection : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("direction")}
                              className="flex items-center gap-1"
                            >
                              Dir
                              {sortKey === "direction" && (
                                <span aria-hidden>
                                  {sortDirection === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </button>
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Entry
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            Stop
                          </th>
                          <th className="px-2 py-2 text-right font-semibold">
                            TP1
                          </th>
                          <th
                            scope="col"
                            className="px-2 py-2 text-right font-semibold"
                            aria-sort={sortKey === "rr" ? sortDirection : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("rr")}
                              className="flex items-center gap-1"
                            >
                              R:R
                              {sortKey === "rr" && (
                                <span aria-hidden>
                                  {sortDirection === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </button>
                          </th>
                          <th className="px-2 py-2 text-left font-semibold">
                            Stop Type
                          </th>
                          <th
                            scope="col"
                            className="px-2 py-2 text-left font-semibold"
                            aria-sort={sortKey === "trend" ? sortDirection : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("trend")}
                              className="flex items-center gap-1"
                            >
                              Trend
                              {sortKey === "trend" && (
                                <span aria-hidden>
                                  {sortDirection === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </button>
                          </th>
                          <th className="px-2 py-2 text-left font-semibold">
                            Location
                          </th>
                          <th
                            scope="col"
                            className="px-2 py-2 text-left font-semibold"
                            aria-sort={sortKey === "status" ? sortDirection : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSort("status")}
                              className="flex items-center gap-1"
                            >
                              Status
                              {sortKey === "status" && (
                                <span aria-hidden>
                                  {sortDirection === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTrades.map((row, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-700 bg-slate-900 text-slate-50 hover:bg-slate-800"
                          >
                            <td className="px-2 py-1.5 font-semibold text-sky-100">
                              {row.symbol}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {row.trade.model}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {row.trade.direction}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">
                              {formatPrice(row.symbol, row.trade.entry)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">
                              {formatPrice(row.symbol, row.trade.stop)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">
                              {formatPrice(row.symbol, row.trade.tp1)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">
                              {row.trade.rr?.toFixed(2) ?? "-"}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {row.trade.stopType ?? "-"}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {row.trend ?? "-"}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {row.location ?? "-"}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {row.trade.status ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SETTINGS VIEW */}
          {activeView === "settings" && (
            <section className="space-y-4 md:space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="text-xs md:text-sm text-muted-foreground">
                  Configure scan inputs before sending them to the engine.
                  Adjust symbols, trade-quality filters, and data windows.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Symbols</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Toggle which pairs are included in the next scan.
                      Disabled symbols will be skipped in the request
                      payload.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {symbolsList.map((symbol) => (
                        <label
                          key={`symbol-toggle-${symbol}`}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold">{symbol}</div>
                            <p className="text-[11px] text-muted-foreground">
                              Include {symbol} in the scan payload.
                            </p>
                          </div>
                          <Switch
                            checked={scanSettings.symbols[symbol]}
                            onCheckedChange={(checked) =>
                              setScanSettings((prev) => ({
                                ...prev,
                                symbols: {
                                  ...prev.symbols,
                                  [symbol]: checked,
                                },
                              }))
                            }
                            aria-label={`Toggle ${symbol}`}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      The scan request will only include enabled symbols,
                      matching the engine&apos;s expected symbol list.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Trade Filters</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Control minimum reward-to-risk and cap spreads
                      before trades are surfaced.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Minimum R:R</span>
                        <span className="text-emerald-300">
                          {scanSettings.minRr.toFixed(1)}x
                        </span>
                      </div>
                      <Slider
                        value={[scanSettings.minRr]}
                        min={1}
                        max={5}
                        step={0.1}
                        onValueChange={(value) =>
                          setScanSettings((prev) => ({
                            ...prev,
                            minRr: value[0] ?? prev.minRr,
                          }))
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Ignore candidates that don&apos;t meet the minimum
                        reward-to-risk.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>Spread cap (pips)</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          className="w-24 h-9 border-border bg-background text-right"
                          value={scanSettings.spreadCap}
                          onChange={(e) =>
                            setScanSettings((prev) => ({
                              ...prev,
                              spreadCap: Number(e.target.value) || 0,
                            }))
                          }
                          aria-label="Spread cap in pips"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Maximum spread allowed for entries. Candidates with
                        wider spreads will be filtered out.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">ATR & Lookback</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Control volatility windows for ATR and structure
                      detection.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <Label htmlFor="atr-window">ATR window</Label>
                        <div className="flex items-center gap-2 text-xs">
                          <Input
                            id="atr-window"
                            type="number"
                            inputMode="numeric"
                            className="w-20 h-9 border-border bg-background text-right"
                            value={scanSettings.atrWindow}
                            onChange={(e) =>
                              setScanSettings((prev) => ({
                                ...prev,
                                atrWindow:
                                  Number(e.target.value) || prev.atrWindow,
                              }))
                            }
                            aria-label="ATR window"
                          />
                          <span className="text-muted-foreground">days</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Number of bars used to compute ATR for sizing and
                        proximity calculations.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <Label htmlFor="structure-lookback">
                          Structure lookback
                        </Label>
                        <div className="flex items-center gap-2 text-xs">
                          <Input
                            id="structure-lookback"
                            type="number"
                            inputMode="numeric"
                            className="w-20 h-9 border-border bg-background text-right"
                            value={scanSettings.structureLookback}
                            onChange={(e) =>
                              setScanSettings((prev) => ({
                                ...prev,
                                structureLookback:
                                  Number(e.target.value) ||
                                  prev.structureLookback,
                              }))
                            }
                            aria-label="Structure lookback"
                          />
                          <span className="text-muted-foreground">days</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Days of history to search for orderblocks, liquidity
                        sweeps, and structural reference points.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card shadow-sm md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Manual 1h close</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Optionally override the live quote per symbol with a
                      manual 1h close. When enabled, the scan payload will
                      include the manual value and surface a manual indicator
                      in results.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {symbolsList.map((symbol) => {
                        const state = manualCloses[symbol];

                        return (
                          <div
                            key={`manual-close-${symbol}`}
                            className="rounded-lg border border-border bg-muted/40 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-0.5">
                                <div className="text-sm font-semibold">{symbol}</div>
                                <p className="text-[11px] text-muted-foreground">
                                  Use a manual 1h close for {symbol}.
                                </p>
                              </div>
                              <Switch
                                checked={state?.enabled}
                                onCheckedChange={(checked) =>
                                  setManualCloses((prev) => ({
                                    ...prev,
                                    [symbol]: {
                                      ...prev[symbol],
                                      enabled: checked,
                                    },
                                  }))
                                }
                                aria-label={`Toggle manual close for ${symbol}`}
                              />
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-sm">
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                placeholder="e.g. 1.2345"
                                className="h-9 border-border bg-background text-right"
                                disabled={!state?.enabled}
                                value={state?.value ?? ""}
                                onChange={(e) =>
                                  setManualCloses((prev) => ({
                                    ...prev,
                                    [symbol]: {
                                      ...prev[symbol],
                                      value: e.target.value,
                                    },
                                  }))
                                }
                                aria-label={`Manual close for ${symbol}`}
                              />
                              <span className="text-[11px] text-muted-foreground">
                                Overrides live price when enabled.
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Manual values must be numeric and finite. Invalid entries
                      are blocked before sending the scan request.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-border bg-card shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Payload preview</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      These values are sent to the POST /api/scan endpoint,
                      ready to be wired to the scan engine.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <pre className="rounded-lg border border-border bg-slate-900/70 p-3 text-[11px] leading-relaxed text-emerald-200 font-mono">
                      {JSON.stringify(scanPayload, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
        </main>

        {loading && (
          <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center px-4 py-8">
            <div className="w-full max-w-5xl space-y-4" role="status">
              <div className="flex flex-col items-start gap-2">
                <div className="h-4 w-36 rounded-full bg-slate-700/60 animate-pulse" />
                <div className="h-3 w-64 rounded-full bg-slate-700/50 animate-pulse" />
              </div>
              <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                {symbolsList.map((symbol) => (
                  <div
                    key={`skeleton-${symbol}`}
                    className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.7)] animate-pulse"
                  >
                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/70">
                      <div className="space-y-2 w-full">
                        <div className="h-4 w-20 rounded bg-slate-700" />
                        <div className="h-3 w-28 rounded bg-slate-800" />
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="h-5 w-20 rounded-full bg-slate-700" />
                        <span className="h-5 w-16 rounded-full bg-slate-800" />
                      </div>
                    </div>
                    <div className="pt-4 space-y-2">
                      {[0, 1, 2].map((row) => (
                        <div key={row} className="flex items-center gap-2">
                          <span className="h-3 w-16 rounded bg-slate-800" />
                          <span className="h-3 flex-1 rounded bg-slate-900" />
                          <span className="h-3 w-12 rounded bg-slate-800" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-200">
                <div className="h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                Fetching the latest scan…
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
