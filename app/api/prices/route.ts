import { NextResponse } from 'next/server';

import { prices, store } from '@/lib/court/service';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || '';
  const days = Number(searchParams.get('days') || '90');
  try {
    const result = await prices(store, symbol, days);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
