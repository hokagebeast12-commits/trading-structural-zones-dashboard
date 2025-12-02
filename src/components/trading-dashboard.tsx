'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Activity, RefreshCw } from 'lucide-react';
import type { ScanResponse, SymbolCode } from '@/lib/trading/types';

export default function TradingDashboard() {
  const [signals, setSignals] = useState<ScanResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const DECIMALS: Record<string, number> = {
    XAUUSD: 2,
    EURUSD: 5,
    GBPUSD: 5,
    GBPJPY: 3,
  };

  function formatPrice(symbol: string | SymbolCode, price: number) {
    const d = DECIMALS[symbol] ?? 5;
    return price.toFixed(d);
  }

  async function fetchScan() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/scan');
      if (!res.ok) {
        setErrorMessage('Scan failed – please try again.');
        setSignals(null);
        return;
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.signals)) {
        setErrorMessage('Unexpected scan response format.');
        setSignals(null);
        return;
      }
      setSignals(data.signals);
    } catch (err) {
      console.error('Error fetching scan:', err);
      setErrorMessage('Scan failed – please try again.');
      setSignals(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial fetch
    fetchScan();
  }, []);

  const latestScan = signals && signals.length > 0 ? signals[0] : null;
  const lastScanTime = latestScan?.date ?? null;
  const symbolsList: SymbolCode[] = ['XAUUSD', 'EURUSD', 'GBPJPY', 'GBPUSD'];

  const hasAnyTrades = !!latestScan && Object.values(latestScan.symbols).some(s => s.trades && s.trades.length > 0);

  return (
    <div className="min-h-screen flex bg-[#050816] text-slate-100">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-[260px] border-r border-slate-800 bg-[#050816] p-4">...
    </div>
  );
}
