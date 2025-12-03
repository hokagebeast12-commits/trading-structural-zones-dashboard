// src/app/api/scan/route.ts
import { NextResponse } from "next/server";
import { scanMarket } from "@/lib/trading/engine";
import type {
  LivePriceSnapshot,
  ScanOptions,
  ScanResponse,
  SymbolCode,
} from "@/lib/trading/types";
import { getCurrentPrice } from "@/lib/trading/live-prices";
import { computeNearestZoneInfo } from "@/lib/trading/nearest-zone";

const SUPPORTED_SYMBOLS: SymbolCode[] = [
  "XAUUSD",
  "EURUSD",
  "GBPUSD",
  "GBPJPY",
];

function validateLivePriceConfig(): { ok: boolean; message?: string } {
  const missing: string[] = [];
  if (!process.env.FX_API_URL) {
    missing.push("FX_API_URL");
  }
  if (!process.env.FX_API_KEY) {
    missing.push("FX_API_KEY");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing live price configuration: ${missing.join(", ")}`,
    };
  }

  return { ok: true };
}

function normalizeScanOptions(body: unknown): ScanOptions {
  if (!body || typeof body !== "object") {
    return {};
  }

  const payload = body as Record<string, unknown>;
  const options: ScanOptions = {};

  if (typeof payload.date === "string" && payload.date.trim()) {
    options.date = payload.date;
  }

  if (Array.isArray(payload.symbols)) {
    const symbols = payload.symbols.filter((s): s is SymbolCode =>
      SUPPORTED_SYMBOLS.includes(s as SymbolCode),
    );
    if (symbols.length > 0) {
      options.symbols = symbols;
    }
  }

  if (payload.filters && typeof payload.filters === "object") {
    const filters = payload.filters as Record<string, unknown>;
    options.filters = {};

    if (typeof filters.minRr === "number" && Number.isFinite(filters.minRr)) {
      options.filters.minRr = filters.minRr;
    }

    if (
      typeof filters.spreadCap === "number" &&
      Number.isFinite(filters.spreadCap)
    ) {
      options.filters.spreadCap = filters.spreadCap;
    }
  }

  if (payload.params && typeof payload.params === "object") {
    const params = payload.params as Record<string, unknown>;
    options.params = {};

    if (typeof params.atrWindow === "number" && Number.isFinite(params.atrWindow)) {
      options.params.atrWindow = params.atrWindow;
    }

    if (
      typeof params.structureLookback === "number" &&
      Number.isFinite(params.structureLookback)
    ) {
      options.params.structureLookback = params.structureLookback;
    }

    if (
      typeof params.trendLookback === "number" &&
      Number.isFinite(params.trendLookback)
    ) {
      options.params.trendLookback = params.trendLookback;
    }
  }

  return options;
}

/**
 * Core scan routine:
 *  - Runs the existing structural scan (scanMarket).
 *  - Fetches live prices for each symbol.
 *  - Computes nearest zone vs spot and attaches it to each SymbolScanResult.
 */
async function runScanWithLivePrices(options?: ScanOptions): Promise<ScanResponse> {
  // 1) Run the existing engine scan (no changes to engine.ts)
  const scan = await scanMarket(options); // expected to return ScanResponse shape

  const symbols = Object.keys(scan.symbols) as SymbolCode[];

  // 2) Fetch current prices in parallel
  const prices: LivePriceSnapshot[] = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const p = await getCurrentPrice(symbol);
        return p;
      } catch (err) {
        console.error("Failed to fetch live price for", symbol, err);
        return { spot: null, error: { code: "HTTP_ERROR", message: String(err) } };
      }
    }),
  );

  // 3) Attach nearestZone info per symbol
  symbols.forEach((symbol, idx) => {
    const symbolResult = scan.symbols[symbol];
    const spotInfo = prices[idx];

    if (!symbolResult) {
      return;
    }

    const nearest =
      spotInfo?.spot != null
        ? computeNearestZoneInfo(
            symbolResult.zones ?? [],
            spotInfo.spot,
            symbolResult.atr20 ?? null,
          )
        : null;

    // Mutate in place or reassign – both are fine
    scan.symbols[symbol] = {
      ...symbolResult,
      livePrice: spotInfo,
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
    const config = validateLivePriceConfig();
    if (!config.ok) {
      return NextResponse.json(
        { error: config.message },
        { status: 400 },
      );
    }

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
    const body = await req.json().catch(() => null);
    const options = normalizeScanOptions(body);

    const config = validateLivePriceConfig();
    if (!config.ok) {
      return NextResponse.json(
        { error: config.message },
        { status: 400 },
      );
    }

    const scan = await runScanWithLivePrices(options);
    return NextResponse.json({ signals: [scan] });
  } catch (err) {
    console.error("Error in POST /api/scan:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 },
    );
  }
}
