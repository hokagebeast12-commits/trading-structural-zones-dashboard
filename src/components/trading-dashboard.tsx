'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Activity, Target, Shield } from 'lucide-react';
import { ScanResponse, SymbolCode, CONFIG } from '@/lib/trading/types';

export default function TradingDashboard() {
  const [scanData, setScanData] = useState<ScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolCode>('XAUUSD');

  const fetchScanData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/scan');
      const data = await response.json();
      setScanData(data);
    } catch (error) {
      console.error('Failed to fetch scan data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScanData();
  }, []);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'Bull':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'Bear':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'Bull':
        return 'bg-green-500/10 text-green-600 border-green-200';
      case 'Bear':
        return 'bg-red-500/10 text-red-600 border-red-200';
      default:
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
    }
  };

  const getLocationColor = (location: string) => {
    switch (location) {
      case 'Discount':
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'Premium':
        return 'bg-purple-500/10 text-purple-600 border-purple-200';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  const formatPrice = (price: number, symbol: SymbolCode) => {
    if (symbol === 'XAUUSD') {
      return price.toFixed(2);
    } else if (symbol.includes('JPY')) {
      return price.toFixed(3); // JPY pairs typically show 3 decimal places
    } else {
      return price.toFixed(5); // Non-JPY forex pairs show 5 decimal places
    }
  };

  const formatPips = (value: number, symbol: SymbolCode) => {
    if (symbol === 'XAUUSD') {
      return `$${value.toFixed(2)}`;
    } else if (symbol.includes('JPY')) {
      return `${(value * 100).toFixed(0)} pips`; // JPY pairs: 0.01 = 1 pip
    } else {
      return `${(value * 10000).toFixed(0)} pips`; // Non-JPY pairs: 0.0001 = 1 pip
    }
  };

  const currentSymbolData = scanData?.symbols[selectedSymbol];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Trading Dashboard</h1>
            <p className="text-purple-200">Structural Zone Analysis & Trade Generation</p>
          </div>
          <Button 
            onClick={fetchScanData} 
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Run Scan
          </Button>
        </div>

        {scanData && (
          <>
            {/* Symbol Tabs */}
            <Tabs value={selectedSymbol} onValueChange={(value) => setSelectedSymbol(value as SymbolCode)}>
              <TabsList className="grid w-full grid-cols-4 bg-purple-800/20 border-purple-700">
                <TabsTrigger value="XAUUSD" className="data-[state=active]:bg-purple-600 text-white">
                  XAUUSD (Gold)
                </TabsTrigger>
                <TabsTrigger value="EURUSD" className="data-[state=active]:bg-purple-600 text-white">
                  EURUSD
                </TabsTrigger>
                <TabsTrigger value="GBPJPY" className="data-[state=active]:bg-purple-600 text-white">
                  GBPJPY
                </TabsTrigger>
                <TabsTrigger value="GBPUSD" className="data-[state=active]:bg-purple-600 text-white">
                  GBPUSD
                </TabsTrigger>
              </TabsList>

              {(['XAUUSD', 'EURUSD', 'GBPJPY', 'GBPUSD'] as SymbolCode[]).map((symbol) => (
                <TabsContent key={symbol} value={symbol} className="space-y-6 mt-6">
                  {currentSymbolData && (
                    <>
                      {/* Market Overview */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card className="bg-purple-800/10 border-purple-700/50 backdrop-blur-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-white text-sm font-medium">Trend</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center space-x-2">
                              {getTrendIcon(currentSymbolData.trend)}
                              <Badge className={getTrendColor(currentSymbolData.trend)}>
                                {currentSymbolData.trend}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-purple-800/10 border-purple-700/50 backdrop-blur-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-white text-sm font-medium">Location</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <Badge className={getLocationColor(currentSymbolData.location)}>
                              {currentSymbolData.location}
                            </Badge>
                          </CardContent>
                        </Card>

                        <Card className="bg-purple-800/10 border-purple-700/50 backdrop-blur-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-white text-sm font-medium">ATR (20)</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-white font-semibold">
                              {formatPips(currentSymbolData.atr20, symbol)}
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-purple-800/10 border-purple-700/50 backdrop-blur-sm">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-white text-sm font-medium">Risk Cap</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-white font-semibold">
                              {formatPips(CONFIG.risk_cap[symbol], symbol)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Structural Zones */}
                      <Card className="bg-purple-800/10 border-purple-700/50 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center">
                            <Activity className="h-5 w-5 mr-2 text-purple-400" />
                            Structural Zones
                          </CardTitle>
                          <CardDescription className="text-purple-200">
                            Top 5 Open/Close clusters ranked by score
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {currentSymbolData.zones.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {currentSymbolData.zones.map((zone, index) => (
                                <Card key={index} className="bg-purple-900/20 border-purple-600/30">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-white font-medium">Zone {index + 1}</h4>
                                      <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                                        Score: {zone.score}
                                      </Badge>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-purple-300">Mid:</span>
                                        <span className="text-white font-mono">
                                          {formatPrice(zone.zone_mid, symbol)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-purple-300">Range:</span>
                                        <span className="text-white font-mono text-xs">
                                          {formatPrice(zone.zone_low, symbol)} - {formatPrice(zone.zone_high, symbol)}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-purple-300">
                              No structural zones identified
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Trade Candidates */}
                      <Card className="bg-purple-800/10 border-purple-700/50 backdrop-blur-sm">
                        <CardHeader>
                          <CardTitle className="text-white flex items-center">
                            <Target className="h-5 w-5 mr-2 text-purple-400" />
                            Trade Candidates
                          </CardTitle>
                          <CardDescription className="text-purple-200">
                            Generated trades from Model A (Structural Swing) and Model B (PDH/PDL)
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {currentSymbolData.trades.length > 0 ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {currentSymbolData.trades.map((trade, index) => (
                                <Card key={index} className="bg-purple-900/20 border-purple-600/30">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center space-x-2">
                                        <Badge variant="outline" className="bg-purple-600/20 text-purple-300 border-purple-500">
                                          Model {trade.model}
                                        </Badge>
                                        <Badge className={
                                          trade.direction === 'Long' 
                                            ? 'bg-green-600/20 text-green-400 border-green-500'
                                            : 'bg-red-600/20 text-red-400 border-red-500'
                                        }>
                                          {trade.direction}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-purple-600/20 text-purple-300">
                                          {trade.stopType}
                                        </Badge>
                                      </div>
                                      <div className="text-white font-bold">
                                        {trade.rr.toFixed(2)}:1
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-purple-300 text-sm">Entry:</span>
                                        <span className="text-white font-mono font-semibold">
                                          {formatPrice(trade.entry, symbol)}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-purple-300 text-sm">Stop Loss:</span>
                                        <span className="text-red-400 font-mono">
                                          {formatPrice(trade.stop, symbol)}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center">
                                        <span className="text-purple-300 text-sm">Take Profit:</span>
                                        <span className="text-green-400 font-mono">
                                          {formatPrice(trade.tp1, symbol)}
                                        </span>
                                      </div>

                                      <Separator className="bg-purple-700/30" />

                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-purple-300 text-sm">Risk:</span>
                                          <span className="text-red-400 font-mono text-sm">
                                            {formatPips(trade.risk_price, symbol)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-purple-300 text-sm">Reward:</span>
                                          <span className="text-green-400 font-mono text-sm">
                                            {formatPips(trade.reward_price, symbol)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-purple-300 text-xs">Risk Usage:</span>
                                          <span className="text-purple-300 text-xs">
                                            {((trade.risk_price / CONFIG.risk_cap[symbol]) * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                        <Progress 
                                          value={(trade.risk_price / CONFIG.risk_cap[symbol]) * 100}
                                          className="h-2 bg-purple-800/50"
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-purple-300 text-xs">R:R Ratio:</span>
                                          <span className="text-purple-300 text-xs">
                                            {Math.min(trade.rr / CONFIG.min_rr * 100, 100).toFixed(0)}%
                                          </span>
                                        </div>
                                        <Progress 
                                          value={Math.min(trade.rr / CONFIG.min_rr * 100, 100)}
                                          className="h-2 bg-purple-800/50"
                                        />
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-purple-300">
                              <Shield className="h-12 w-12 mx-auto mb-4 text-purple-500" />
                              <p>No valid trades for current configuration / trend</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}

        {!scanData && !loading && (
          <div className="text-center py-12">
            <Activity className="h-16 w-16 mx-auto mb-4 text-purple-500" />
            <p className="text-purple-200 text-lg">Click "Run Scan" to analyze the market</p>
          </div>
        )}
      </div>
    </div>
  );
}