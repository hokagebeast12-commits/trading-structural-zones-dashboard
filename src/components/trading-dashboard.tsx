"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ScanResponse, SymbolCode } from "@/lib/trading/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

const DECIMALS: Record<string, number> = {
  XAUUSD: 2,
  EURUSD: 5,
  GBPUSD: 5,
  GBPJPY: 3,
};

function formatPrice(
  symbol: string | SymbolCode,
  price: number | null | undefined,
) {
  if (price == null || Number.isNaN(price)) return "-";
  const d = DECIMALS[String(symbol)] ?? 5;
  return price.toFixed(d);
}

type ViewKey = "dashboard" | "signals" | "settings";

function navItemClasses(isActive: boolean): string {
  return [
    "w-full text-left rounded-lg px-3 py-2 text-sm",
    isActive
      ? "bg-slate-900 text-slate-100 font-medium"
      : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-100",
  ].join(" ");
}

export default function TradingDashboard() {
  const [signals, setSignals] = useState<ScanResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");

  async function fetchScan() {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/scan");
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
    // Initial fetch on mount
    fetchScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestScan = signals && signals.length > 0 ? signals[0] : null;
  const lastScanDate = latestScan?.date ?? null;

  const symbolsList: SymbolCode[] = ["XAUUSD", "EURUSD", "GBPJPY", "GBPUSD"];

  const hasAnyTrades =
    !!latestScan &&
    Object.values(latestScan.symbols).some(
      (s) => s.trades && s.trades.length > 0,
    );

  // Flatten all trades across symbols for the Signals view
  const allTrades = useMemo(() => {
    if (!latestScan) return [];

    const rows: {
      symbol: SymbolCode;
      trend: string;
      location: string;
      trade: any;
    }[] = [];

    (Object.keys(latestScan.symbols) as SymbolCode[]).forEach(
      (symbol) => {
        const s = latestScan.symbols[symbol];
        if (!s || !s.trades) return;
        s.trades.forEach((trade) => {
          rows.push({
            symbol,
            trend: s.trend,
            location: s.location,
            trade,
          });
        });
      },
    );

    return rows;
  }, [latestScan]);

  return (
    <div className="min-h-screen flex bg-[#050816] text-slate-100">
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
            onClick={() => setActiveView("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={navItemClasses(activeView === "signals")}
            onClick={() => setActiveView("signals")}
          >
            Signals
          </button>
          <button
            type="button"
            className={navItemClasses(activeView === "settings")}
            onClick={() => setActiveView("settings")}
          >
            Settings
          </button>
        </nav>

        <div className="mt-auto pt-6 text-xs text-slate-500">
          Prototype • Not live trading
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
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
        <div className="md:hidden px-4 pt-3 flex gap-2 text-xs">
          {(["dashboard", "signals", "settings"] as ViewKey[]).map(
            (view) => (
              <button
                key={view}
                type="button"
                onClick={() => setActiveView(view)}
                className={[
                  "px-3 py-1 rounded-full border",
                  activeView === view
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-700 bg-slate-900/40 text-slate-300",
                ].join(" ")}
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

                    const trend = symbolResult.trend;
                    const location = symbolResult.location;
                    const trades = symbolResult.trades ?? [];

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
                            <CardTitle className="text-sm font-semibold">
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
                          {trades.length === 0 ? (
                            <div className="py-4 text-xs text-slate-400">
                              No trade candidates for this symbol.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
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
                                  {trades.map((t: any, idx: number) => (
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
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-slate-800 text-slate-50">
                        <th className="px-2 py-2 text-left font-semibold">
                          Symbol
                        </th>
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
                        <th className="px-2 py-2 text-left font-semibold">
                          Trend
                        </th>
                        <th className="px-2 py-2 text-left font-semibold">
                          Location
                        </th>
                        <th className="px-2 py-2 text-left font-semibold">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTrades.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-700 bg-slate-900 text-slate-50 hover:bg-slate-800"
                        >
                          <td className="px-2 py-1.5 font-semibold">
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
              )}
            </section>
          )}

          {/* SETTINGS VIEW (placeholder for now) */}
          {activeView === "settings" && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="text-xs md:text-sm text-slate-400">
                  Configure scan parameters and symbol preferences. (UI
                  stub – wiring to the engine can be added next.)
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-300">
                <p className="mb-3">
                  Coming next, this panel can include:
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs md:text-sm text-slate-400">
                  <li>Enable / disable symbols for scanning.</li>
                  <li>Minimum R:R threshold for valid trades.</li>
                  <li>Maximum allowed spread filter.</li>
                  <li>Lookback window for ATR and structure.</li>
                </ul>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
