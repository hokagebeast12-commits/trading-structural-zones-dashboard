// src/app/api/scan/route.ts
import { NextResponse } from "next/server";
import { scanMarket } from "@/lib/trading/engine";
import type { ScanResponse, SymbolCode } from "@/lib/trading/types";
import { getCurrentPrice } from "@/lib/trading/live-prices";
import { computeNearestZoneInfo } from "@/lib/trading/nearest-zone";

/**
 * Core scan routine:
 *  - Runs the existing structural scan (scanMarket).
 *  - Fetches live prices for each symbol.
 *  - Computes nearest zone vs spot and attaches it to each SymbolScanResult.
 */
async function runScanWithLivePrices(): Promise<ScanResponse> {
  // 1) Run the existing engine scan (no changes to engine.ts)
  const scan = await scanMarket(); // expected to return ScanResponse shape

  const symbols = Object.keys(scan.symbols) as SymbolCode[];

  // 2) Fetch current prices in parallel
  const prices = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const p = await getCurrentPrice(symbol);
        return p;
      } catch (err) {
        console.error("Failed to fetch live price for", symbol, err);
        return null;
      }
    }),
  );

  // 3) Attach nearestZone info per symbol
  symbols.forEach((symbol, idx) => {
    const symbolResult = scan.symbols[symbol];
    const spot = prices[idx];

    if (!symbolResult || spot == null) {
      return;
    }

    const nearest = computeNearestZoneInfo(
      symbolResult.zones ?? [],
      spot,
      symbolResult.atr20 ?? null,
    );

    // Mutate in place or reassign – both are fine
    scan.symbols[symbol] = {
      ...symbolResult,
      nearestZone: nearest,
    };
  });

  return scan;
}

/**
 * GET handler used by the dashboard client:
 *  - Returns { signals: [ScanResponse] }
 */
export async function GET() {
  try {
    const scan = await runScanWithLivePrices();
    return NextResponse.json({ signals: [scan] });
  } catch (err) {
    console.error("Error in GET /api/scan:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 },
    );
  }
}

/**
 * Optional POST handler – forwards to the same logic.
 * This allows you to call POST /api/scan later with options in the body.
 */
export async function POST(req: Request) {
  try {
    const scan = await runScanWithLivePrices();
    return NextResponse.json({ signals: [scan] });
  } catch (err) {
    console.error("Error in POST /api/scan:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 },
    );
  }
}
