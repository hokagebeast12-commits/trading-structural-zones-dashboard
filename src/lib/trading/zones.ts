import { OhlcBar, OcZone, LiquidityMap, SymbolCode, CONFIG } from './types';

export function nearestAbove(list: number[], price: number): number | null {
  const filtered = list.filter(p => p > price);
  if (filtered.length === 0) return null;
  return Math.min(...filtered);
}

export function nearestBelow(list: number[], price: number): number | null {
  const filtered = list.filter(p => p < price);
  if (filtered.length === 0) return null;
  return Math.max(...filtered);
}

export function createLiquidityMap(bars: OhlcBar[]): LiquidityMap {
  return {
    highs: bars.map(b => b.high),
    lows: bars.map(b => b.low)
  };
}

export function findStructuralZones(bars: OhlcBar[], symbol: SymbolCode): OcZone[] {
  if (bars.length < CONFIG.lookback_days) {
    return [];
  }
  
  // Use last lookback_days for zone analysis
  const analysisBars = bars.slice(-CONFIG.lookback_days);
  const clusterRadius = CONFIG.oc_cluster_radius[symbol];
  
  // Collect all Opens and Closes
  const points: number[] = [];
  for (const bar of analysisBars) {
    points.push(bar.open);
    points.push(bar.close);
  }
  
  // Sort points ascending
  points.sort((a, b) => a - b);
  
  // Cluster points
  const clusters: number[][] = [];
  let currentCluster: number[] = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const currentPoint = points[i];
    const lastPointInCluster = currentCluster[currentCluster.length - 1];
    
    if (Math.abs(currentPoint - lastPointInCluster) <= clusterRadius) {
      currentCluster.push(currentPoint);
    } else {
      clusters.push(currentCluster);
      currentCluster = [currentPoint];
    }
  }
  clusters.push(currentCluster);
  
  // Create zones from clusters
  const zones: OcZone[] = [];
  for (const cluster of clusters) {
    const zone_low = Math.min(...cluster);
    const zone_high = Math.max(...cluster);
    const zone_mid = (zone_low + zone_high) / 2;
    
    zones.push({
      zone_low,
      zone_high,
      zone_mid,
      score: 0 // Will be calculated next
    });
  }
  
  // Score zones
  for (const zone of zones) {
    let score = 0;
    for (const bar of analysisBars) {
      if (bar.close >= zone.zone_low && bar.close <= zone.zone_high) {
        score += 2;
      }
      if (bar.open >= zone.zone_low && bar.open <= zone.zone_high) {
        score += 1;
      }
    }
    zone.score = score;
  }
  
  // Sort by score descending and keep top 5
  zones.sort((a, b) => b.score - a.score);
  return zones.slice(0, 5);
}