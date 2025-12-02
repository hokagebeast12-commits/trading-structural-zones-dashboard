import { NextRequest, NextResponse } from 'next/server';
import { scanMarket } from '@/lib/trading/engine';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    
    const result = await scanMarket(date);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}