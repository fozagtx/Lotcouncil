import { NextResponse } from 'next/server';

import { audit, store } from '@/lib/court/service';
import type { AuditBody } from '@/lib/court/types';

export async function POST(request: Request) {
  let body: AuditBody;
  try {
    body = (await request.json()) as AuditBody;
  } catch {
    return NextResponse.json({ error: 'That is not valid JSON.' }, { status: 400 });
  }
  try {
    const file = await audit(store, body);
    const symbol = (file.market as { symbol: string }).symbol;
    const verdict = (file.result as { verdict: string }).verdict;
    const name = `lotcouncil-${symbol.replace(/USDT$/, '')}-${verdict.toLowerCase()}.json`;
    return NextResponse.json(file, {
      headers: { 'Content-Disposition': `attachment; filename="${name}"` },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
