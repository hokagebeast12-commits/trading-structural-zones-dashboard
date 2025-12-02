import { Suspense } from "react";

import TradingDashboard from "@/components/trading-dashboard";

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050816]" />}>
      <TradingDashboard />
    </Suspense>
  );
}