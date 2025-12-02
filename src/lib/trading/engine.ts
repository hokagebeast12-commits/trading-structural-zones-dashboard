import { getDailyOhlc } from './data-provider';
import { classifyTrend } from './trend-analysis';
import { findStructuralZones, createLiquidityMap } from './zones';
import { generateModelATrades, generateModelBTrades } from './models';
import { 
  SymbolCode, 
  SymbolScanResult, 
  ScanResponse, 
  CONFIG 
} from './types';

export async function scanSymbol(symbol: SymbolCode): Promise<SymbolScanResult> {
  // Get enough data for all calculations
  const neededBars = CONFIG.lookback_days + CONFIG.trend_lookback + 2;
  const bars = await getDailyOhlc(symbol, neededBars);
  
  if (bars.length < neededBars) {
    throw new Error(`Insufficient data for ${symbol}: got ${bars.length}, need ${neededBars}`);
  }
  
  // Analyze trend
  const { trend, location, atr20 } = classifyTrend(bars);
  
  // Find structural zones
  const zones = findStructuralZones(bars, symbol);
  
  // Create liquidity map
  const liquidity = createLiquidityMap(bars.slice(-CONFIG.lookback_days));
  
  // Generate trades
  const modelATrades = generateModelATrades(trend, zones, liquidity, bars, symbol);
  const modelBTrades = generateModelBTrades(trend, zones, liquidity, bars, symbol);
  const trades = [...modelATrades, ...modelBTrades];
  
  return {
    symbol,
    trend,
    atr20,
    location,
    zones,
    trades
  };
}

export async function scanMarket(date?: string): Promise<ScanResponse> {
  const scanDate = date || new Date().toISOString().split('T')[0];
  
  const symbols: SymbolCode[] = ["XAUUSD", "EURUSD", "GBPJPY", "GBPUSD"];
  const results: Record<SymbolCode, SymbolScanResult> = {} as any;
  
  for (const symbol of symbols) {
    try {
      results[symbol] = await scanSymbol(symbol);
    } catch (error) {
      console.error(`Error scanning ${symbol}:`, error);
      // Return empty result for this symbol
      results[symbol] = {
        symbol,
        trend: "Neutral",
        atr20: 0,
        location: "Mid",
        zones: [],
        trades: []
      };
    }
  }
  
  return {
    date: scanDate,
    symbols: results
  };
}