import { NextResponse } from 'next/server';

import { markets } from '@/lib/court/service';

export async function GET() {
  return NextResponse.json(markets());
}
