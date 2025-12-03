// src/app/api/scan/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { scanMarket } from "@/lib/trading/engine";
import type {
  ScanOptions,
  ScanResponse,
  SymbolCode,
} from "@/lib/trading/types";
import { isSymbolScanError } from "@/lib/trading/types";
import { getCurrentPrice } from "@/lib/trading/live-prices";
import { computeNearestZoneInfo } from "@/lib/trading/nearest-zone";

const SUPPORTED_SYMBOLS: SymbolCode[] = [
  "XAUUSD",
  "EURUSD",
  "GBPUSD",
  "GBPJPY",
];

const manualCloseSchema = z
  .object({
    enabled: z.boolean(),
    close: z
      .number({ invalid_type_error: "manual close must be a number" })
      .finite()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.enabled) {
      if (typeof value.close !== "number" || !Number.isFinite(value.close)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Manual close is required when enabled and must be finite",
          path: ["close"],
        });
      }
    }
  });

const scanPayloadSchema = z
  .object({
    date: z
      .string()
      .trim()
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, {
        message: "Invalid date format (expected yyyy-mm-dd)",
      })
      .optional(),
    symbols: z
      .array(
        z.enum(SUPPORTED_SYMBOLS, { invalid_type_error: "Invalid symbol" }),
      )
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
          .number({
            invalid_type_error: "structureLookback must be a number",
          })
          .finite()
          .optional(),
        trendLookback: z
          .number({ invalid_type_error: "trendLookback must be a number" })
          .finite()
          .optional(),
      })
      .strict()
      .optional(),
    manualCloses: z
      .record(z.enum(SUPPORTED_SYMBOLS), manualCloseSchema)
      .optional(),
  })
  .strict();

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

function normalizeScanOptions(
  payload: z.infer<typeof scanPayloadSchema>,
): ScanOptions {
  const options: ScanOptions = {};

  if (payload.date) {
    options.date = payload.date;
  }

  if (payload.symbols) {
    options.symbols = payload.symbols;
  }

  if (payload.filters) {
    options.filters = { ...payload.filters };
  }

  if (payload.params) {
    options.params = { ...payload.params };
  }

  if (payload.manualCloses) {
    options.manualCloses = { ...payload.manualCloses };
  }

  return options;
}

/**
 * Core scan routine:
 *  - Runs the existing structural scan (scanMarket).
 *  - Fetches live prices for each symbol.
 *  - Computes nearest zone vs spot and attaches it to each SymbolScanResult.
 */
async function runScanWithLivePrices(
  options?: ScanOptions,
): Promise<ScanResponse> {
  // 1) Run the existing engine scan (no changes to engine.ts)
  const scan = await scanMarket(options); // expected to return ScanResponse shape

  const symbols = Object.keys(scan.symbols) as SymbolCode[];
  const symbolsNeedingPrices = symbols.filter((symbol) => {
    const entry = scan.symbols[symbol];
    return entry && !isSymbolScanError(entry);
  });

  if (symbolsNeedingPrices.length === 0) {
    return scan;
  }

  // 2) Fetch current prices in parallel
  const manualCloses = options?.manualCloses ?? {};

  const prices = await Promise.all(
    symbolsNeedingPrices.map(async (symbol) => {
      const manual = manualCloses[symbol];
      const manualEnabled =
        manual?.enabled &&
        typeof manual.close === "number" &&
        Number.isFinite(manual.close);

      if (manualEnabled) {
        return { spot: manual.close, source: "manual" as const };
      }

      try {
        const p = await getCurrentPrice(symbol);
        return p;
      } catch (err) {
        console.error("Failed to fetch live price for", symbol, err);
        return {
          spot: null,
          error: { code: "HTTP_ERROR", message: String(err) },
        };
      }
    }),
  );

  // 3) Attach livePrice + nearestZone per symbol
  symbolsNeedingPrices.forEach((symbol, idx) => {
    const entry = scan.symbols[symbol];
    const rawPrice = prices[idx];

    if (!entry || isSymbolScanError(entry)) {
      return;
    }

    const symbolResult = entry;

    const hasLiveQuote =
      typeof rawPrice?.spot === "number" && Number.isFinite(rawPrice.spot);
    const hasFallback =
      !hasLiveQuote &&
      typeof symbolResult.lastClose === "number" &&
      Number.isFinite(symbolResult.lastClose);

    const livePrice =
      hasLiveQuote
        ? { ...rawPrice, source: rawPrice?.source ?? "live" }
        : hasFallback
          ? {
              spot: symbolResult.lastClose,
              source: "fallback" as const,
              error:
                rawPrice?.error ??
                ({
                  code: "ENV_MISSING" as const,
                  message:
                    "Live prices are not configured; using last daily close as fallback",
                } satisfies Awaited<ReturnType<typeof getCurrentPrice>>["error"]),
            }
          : rawPrice;

    const nearestZone =
      typeof livePrice?.spot === "number" && Number.isFinite(livePrice.spot)
        ? computeNearestZoneInfo(
            symbolResult.zones ?? [],
            livePrice.spot,
            symbolResult.atr20 ?? null,
          )
        : null;

    scan.symbols[symbol] = {
      ...symbolResult,
      livePrice,
      nearestZone,
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
    if (!config.ok && config.message) {
      console.warn(config.message);
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
    const raw = await req.text();
    const body = raw ? JSON.parse(raw) : {};

    const parsed = scanPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const config = validateLivePriceConfig();
    if (!config.ok && config.message) {
      console.warn(config.message);
    }

    const options = normalizeScanOptions(parsed.data);
    const scan = await runScanWithLivePrices(options);
    return NextResponse.json({ signals: [scan] });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }

    console.error("Error in POST /api/scan:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 },
    );
  }
}
