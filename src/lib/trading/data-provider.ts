import { OhlcBar, SymbolCode } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

// Generate synthetic daily OHLC data for demonstration
function generateSyntheticData(symbol: SymbolCode, lookback: number): OhlcBar[] {
  const bars: OhlcBar[] = [];
  const today = new Date();
  
  // Base prices for each symbol
  const basePrices = {
    XAUUSD: 2350,
    EURUSD: 1.05,
    GBPJPY: 190,    // GBP/JPY typical range
    GBPUSD: 1.26     // GBP/USD typical range
  };
  
  const basePrice = basePrices[symbol];
  const dailyVolatility = symbol === 'XAUUSD' ? 20 : symbol.includes('JPY') ? 0.5 : 0.005;
  
  for (let i = lookback - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate realistic price movements with some trend
    const trend = i < lookback / 2 ? 1 : -1; // Simple trend reversal
    const randomWalk = (Math.random() - 0.5) * dailyVolatility * 2;
    const trendComponent = trend * dailyVolatility * 0.3;
    
    if (i === lookback - 1) {
      // First bar
      const close = basePrice + randomWalk;
      bars.push({
        date: date.toISOString().split('T')[0],
        open: close,
        high: close + Math.random() * dailyVolatility,
        low: close - Math.random() * dailyVolatility,
        close: close
      });
    } else {
      const prevClose = bars[bars.length - 1].close;
      const open = prevClose + (Math.random() - 0.5) * dailyVolatility * 0.5;
      const close = open + trendComponent + randomWalk;
      const high = Math.max(open, close) + Math.random() * dailyVolatility * 0.7;
      const low = Math.min(open, close) - Math.random() * dailyVolatility * 0.7;
      
      bars.push({
        date: date.toISOString().split('T')[0],
        open,
        high,
        low,
        close
      });
    }
  }
  
  return bars;
}

// Load broker CSV OHLC data
function loadBrokerCsvOhlc(symbol: SymbolCode): OhlcBar[] {
  try {
    // Map symbols to CSV files
    const csvFiles = {
      XAUUSD: 'XAUUSD_Daily_202510010000_202511280000.csv',
      EURUSD: 'EURUSD_Daily_202510010000_202511280000.csv',
      GBPJPY: 'GBPJPY_Daily_202510010000_202511280000.csv',
      GBPUSD: 'GBPUSD_Daily_202510010000_202511280000.csv'
    };
    
    const csvFile = csvFiles[symbol];
    const csvPath = join(process.cwd(), 'data', csvFile);
    
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return [];
    }
    
    // Parse header to find column indices
    const headerLine = lines[0];
    const headers = headerLine.split('\t').map(h => h.replace(/[<>]/g, '').trim());
    
    const dateIndex = headers.findIndex(h => h.toUpperCase() === 'DATE');
    const openIndex = headers.findIndex(h => h.toUpperCase() === 'OPEN');
    const highIndex = headers.findIndex(h => h.toUpperCase() === 'HIGH');
    const lowIndex = headers.findIndex(h => h.toUpperCase() === 'LOW');
    const closeIndex = headers.findIndex(h => h.toUpperCase() === 'CLOSE');
    
    if (dateIndex === -1 || openIndex === -1 || highIndex === -1 || lowIndex === -1 || closeIndex === -1) {
      throw new Error(`Required columns not found in CSV header: ${headers.join(', ')}`);
    }
    
    const bars: OhlcBar[] = [];
    
    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split('\t');
      if (columns.length <= Math.max(dateIndex, openIndex, highIndex, lowIndex, closeIndex)) {
        continue; // Skip malformed rows
      }
      
      // Parse date from format like "2025.10.01" to "YYYY-MM-DD"
      const dateStr = columns[dateIndex].trim();
      let normalizedDate: string;
      
      if (dateStr.includes('.')) {
        // Format: YYYY.MM.DD
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          normalizedDate = `${year}-${month}-${day}`;
        } else {
          continue; // Skip invalid date format
        }
      } else {
        // Assume it's already in a valid format
        normalizedDate = dateStr;
      }
      
      const open = parseFloat(columns[openIndex]);
      const high = parseFloat(columns[highIndex]);
      const low = parseFloat(columns[lowIndex]);
      const close = parseFloat(columns[closeIndex]);
      
      if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        continue; // Skip rows with invalid numbers
      }
      
      bars.push({
        date: normalizedDate,
        open,
        high,
        low,
        close
      });
    }
    
    // Sort by date ascending
    bars.sort((a, b) => a.date.localeCompare(b.date));
    
    return bars;
    
  } catch (error) {
    console.error(`Failed to load CSV for ${symbol}:`, error);
    return [];
  }
}

export async function getDailyOhlc(
  symbol: SymbolCode,
  lookback: number
): Promise<OhlcBar[]> {
  try {
    const allBars = loadBrokerCsvOhlc(symbol);
    if (allBars.length === 0) {
      throw new Error(`No bars parsed from CSV for ${symbol}`);
    }
    const sliced = allBars.slice(-lookback);
    sliced.sort((a, b) => (a.date < b.date ? -1 : 1));
    return sliced;
  } catch (err) {
    console.error("Failed to load broker CSV OHLC for", symbol, err);
    return generateSyntheticData(symbol, lookback);
  }
}