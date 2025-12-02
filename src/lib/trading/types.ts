export type SymbolCode = "XAUUSD" | "EURUSD" | "GBPJPY" | "GBPUSD";

export interface OhlcBar {
  date: string;   // ISO yyyy-mm-dd (UTC is fine)
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface OcZone {
  zone_low: number;
  zone_high: number;
  zone_mid: number;
  score: number;
}

export interface LiquidityMap {
  highs: number[];  // all daily highs
  lows: number[];   // all daily lows
}

export interface TradeCandidate {
  model: "A" | "B";
  direction: "Long" | "Short";
  entry: number;
  stop: number;
  tp1: number;
  risk_price: number;
  reward_price: number;
  rr: number;
  status: "VALID";
  stopType: "Swing" | "PD";
}

export interface SymbolScanResult {
  symbol: SymbolCode;
  trend: "Bull" | "Bear" | "Neutral";
  atr20: number;
  location: "Discount" | "Mid" | "Premium";
  zones: OcZone[];
  trades: TradeCandidate[];
}

export interface ScanResponse {
  date: string;   // echo of query param or today
  symbols: Record<SymbolCode, SymbolScanResult>;
}

export const CONFIG = {
  lookback_days: 20,        // window for zones & liquidity
  trend_lookback: 10,       // days to classify trend
  risk_cap: {
    XAUUSD: 40.0,           // ≈ $40 between Entry and SL
    EURUSD: 0.0040,         // 40 pips (0.0040 in price)
    GBPJPY: 0.0040,         // 40 pips (0.0040 in price) - JPY pairs
    GBPUSD: 0.0040          // 40 pips (0.0040 in price)
  } as Record<SymbolCode, number>,
  min_rr: 2.0,              // minimum Reward:Risk
  oc_cluster_radius: {
    XAUUSD: 5.0,            // $5 band for clustering O/C
    EURUSD: 0.0005,         // 5 pips
    GBPJPY: 0.0005,         // 5 pips - JPY pairs
    GBPUSD: 0.0005          // 5 pips
  } as Record<SymbolCode, number>,
  sl_buffer: {
    XAUUSD: 2.0,            // $2 beyond low/high or PDL/PDH
    EURUSD: 0.0005,         // 5 pips
    GBPJPY: 0.0005,         // 5 pips - JPY pairs
    GBPUSD: 0.0005          // 5 pips
  } as Record<SymbolCode, number>,
};