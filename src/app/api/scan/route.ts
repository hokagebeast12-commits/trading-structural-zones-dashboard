import { NextResponse } from "next/server";
import { scanMarket } from "@/lib/trading/engine";
import type { ScanResponse } from "@/lib/trading/types";

/**
 * Helper to run the market scan and normalize the result
 * so the API always returns { signals: ScanResponse[] }.
 */
async function runScan(): Promise<ScanResponse[]> {
  const result = await scanMarket();

  // If scanMarket already returns an array, use it directly.
  if (Array.isArray(result)) {
    return result as ScanResponse[];
  }

  // Otherwise, wrap the single ScanResponse in an array.
  return [result as ScanResponse];
}

export async function GET() {
  try {
    const signals = await runScan();
    return NextResponse.json({ signals });
  } catch (err) {
    console.error("Error in GET /api/scan:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const signals = await runScan();
    return NextResponse.json({ signals });
  } catch (err) {
    console.error("Error in POST /api/scan:", err);
    return NextResponse.json(
      { error: "Scan failed" },
      { status: 500 },
    );
  }
}
