import { getDailyOhlc } from './data-provider';
import { classifyTrend } from './trend-analysis';
import { findStructuralZones, createLiquidityMap } from './zones';
import { generateModelATrades, generateModelBTrades } from './models';
import {
  SymbolCode,
  SymbolScanEntry,
  SymbolScanResult,
  ScanResponse,
  CONFIG,
  ScanOptions,
} from './types';

export async function scanSymbol(
  symbol: SymbolCode,
  options?: ScanOptions,
): Promise<SymbolScanResult> {
  const lookbackDays = Math.max(
    1,
    options?.params?.structureLookback ?? CONFIG.lookback_days,
  );
  const trendLookback = Math.max(
    1,
    options?.params?.trendLookback ?? CONFIG.trend_lookback,
  );
  const atrWindow = Math.max(2, options?.params?.atrWindow ?? 20);
  const minRr = options?.filters?.minRr ?? CONFIG.min_rr;
  const spreadCap = options?.filters?.spreadCap;

  // Get enough data for all calculations
  const neededBars = Math.max(
    lookbackDays + trendLookback + 2,
    atrWindow + 1,
  );
  const bars = await getDailyOhlc(symbol, neededBars);
  
  if (bars.length < neededBars) {
    throw new Error(`Insufficient data for ${symbol}: got ${bars.length}, need ${neededBars}`);
  }
  
  // Analyze trend
  const { trend, location, atr20 } = classifyTrend(bars, {
    lookbackDays,
    trendLookback,
    atrWindow,
  });
  
  // Find structural zones
  const zones = findStructuralZones(bars, symbol, lookbackDays);
  
  // Create liquidity map
  const liquidity = createLiquidityMap(bars.slice(-lookbackDays));

  // Generate trades
  const tradeOptions = { minRr, spreadCap };
  const modelATrades = generateModelATrades(
    trend,
    zones,
    liquidity,
    bars,
    symbol,
    tradeOptions,
  );
  const modelBTrades = generateModelBTrades(
    trend,
    zones,
    liquidity,
    bars,
    symbol,
    tradeOptions,
  );
  const trades = [...modelATrades, ...modelBTrades];

  return {
    symbol,
    trend,
    atr20,
    location,
    zones,
    trades,
    lastClose: bars[bars.length - 1]?.close,
  };
}

export async function scanMarket(options?: ScanOptions): Promise<ScanResponse> {
  const scanDate = options?.date || new Date().toISOString().split('T')[0];

  const defaultSymbols: SymbolCode[] = ["XAUUSD", "EURUSD", "GBPJPY", "GBPUSD"];
  const symbols: SymbolCode[] =
    options?.symbols && options.symbols.length > 0 ? options.symbols : defaultSymbols;

  const results: Partial<Record<SymbolCode, SymbolScanEntry>> = {};

  for (const symbol of symbols) {
    try {
      results[symbol] = await scanSymbol(symbol, options);
    } catch (error) {
      console.error(`Error scanning ${symbol}:`, error);
      const message =
        error instanceof Error ? error.message : "Unexpected error while scanning";
      results[symbol] = { symbol, error: message };
    }
  }

  return {
    date: scanDate,
    symbols: results
  };
}