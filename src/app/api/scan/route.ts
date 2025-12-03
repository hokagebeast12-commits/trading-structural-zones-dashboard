// src/app/api/scan/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
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

const scanPayloadSchema = z
  .object({
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "Invalid date format (expected yyyy-mm-dd)")
      .optional(),
    symbols: z
      .array(z.enum(SUPPORTED_SYMBOLS, { invalid_type_error: "Invalid symbol" }))
      .nonempty({ message: "At least one symbol is required" })
      .optional(),
    filters: z
      .object({
        minRr: z
          .number({ invalid_type_error: "minRr must be a number" })
          .finite()
          .optional(),
        spreadCap: z
          .number({ invalid_type_error: "spreadCap must be a number" })
          .finite()
          .optional(),
      })
      .strict()
      .optional(),
    params: z
      .object({
        atrWindow: z
          .number({ invalid_type_error: "atrWindow must be a number" })
          .finite()
          .optional(),
        structureLookback: z
          .number({ invalid_type_error: "structureLookback must be a number" })
          .finite()
          .optional(),
        trendLookback: z
          .number({ invalid_type_error: "trendLookback must be a number" })
          .finite()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

function normalizeScanOptions(payload: z.infer<typeof scanPayloadSchema>): ScanOptions {
  const options: ScanOptions = {};

  if (payload.date) {
    options.date = payload.date;
  }

  if (payload.symbols && payload.symbols.length > 0) {
    options.symbols = payload.symbols;
  }

  if (payload.filters) {
    options.filters = { ...payload.filters };
  }

  if (payload.params) {
    options.params = { ...payload.params };
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
    const parsed = scanPayloadSchema.safeParse(body ?? {});

    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      console.warn("Scan payload validation failed", { details, body });

      return NextResponse.json(
        { error: "Invalid scan payload", details },
        { status: 400 },
      );
    }

    const options = normalizeScanOptions(parsed.data);
    console.info("Scan options normalized", options);

    const options = normalizeScanOptions(parsed.data);
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
