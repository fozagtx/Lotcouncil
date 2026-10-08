'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Markets, Ruling } from '@/lib/court/types';

export default function HomePage() {
  const [markets, setMarkets] = useState<Markets | null>(null);
  const [symbol, setSymbol] = useState('');
  const [days, setDays] = useState(0);
  const [fee, setFee] = useState(0);
  const [idea, setIdea] = useState('buy when the 10 hour average crosses above the 40 hour average');
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [ruling, setRuling] = useState<Ruling | null>(null);

  useEffect(() => {
    fetch('/api/markets')
      .then((r) => r.json())
      .then((m: Markets) => {
        setMarkets(m);
        setSymbol(m.tokens[0].symbol);
        setDays(m.default_days);
        setFee(m.default_fee_pct);
      })
      .catch((e) => setMessages([`Could not load markets: ${(e as Error).message}`]));
  }, []);

  async function run() {
    setRunning(true);
    setMessages([]);
    setRuling(null);
    try {
      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, days, fee_pct: fee, idea }),
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.stage === 'understood') setMessages((p) => [...p, `Understood: ${ev.rule_text}`]);
          else if (ev.stage === 'data') setMessages((p) => [...p, `Loaded ${ev.market.candles} candles for ${ev.market.label}`]);
          else if (ev.stage === 'gate') setMessages((p) => [...p, `Gate ${ev.gate.passed ? 'passed' : 'failed'} — ${ev.gate.sentence}`]);
          else if (ev.stage === 'A' || ev.stage === 'B' || ev.stage === 'C') setMessages((p) => [...p, `${ev.test.name}: ${ev.test.passed ? 'PASS' : 'FAIL'} — ${ev.test.sentence}`]);
          else if (ev.stage === 'verdict') {
            setRuling(ev.ruling);
            setMessages((p) => [...p, `Verdict: ${ev.ruling.verdict}`]);
          } else if (ev.stage === 'explanation') setMessages((p) => [...p, ev.explanation.text]);
          else if (ev.stage === 'error') setMessages((p) => [...p, `Error: ${ev.message}`]);
        }
      }
    } catch (e) {
      setMessages((p) => [...p, `Error: ${(e as Error).message}`]);
    } finally {
      setRunning(false);
    }
  }

  if (!markets) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Lotcouncil</CardTitle>
            <CardDescription>Loading markets…</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Lotcouncil</CardTitle>
          <CardDescription>Put your trading idea on trial. No Python, full-stack Next.js.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Token</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.tokens.map((t) => (
                    <SelectItem key={t.symbol} value={t.symbol}>
                      {t.label} — {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Window (days)</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.windows_days.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fee (%)</Label>
              <Select value={String(fee)} onValueChange={(v) => setFee(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {markets.fees_pct.map((f) => (
                    <SelectItem key={f} value={String(f)}>
                      {f}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Idea</Label>
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="buy when the 10 hour average crosses above the 40 hour average"
            />
          </div>

          <Button onClick={run} disabled={running}>
            {running ? 'Judging…' : 'Run the court'}
          </Button>
        </CardContent>
      </Card>

      {messages.length > 0 && (
        <div className="mt-6 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className="rounded-md border border-border bg-muted/40 px-4 py-2 text-sm">
              {m}
            </div>
          ))}
        </div>
      )}

      {ruling && (
        <div className={`mt-6 rounded-xl border-2 p-6 text-center text-2xl font-bold ${ruling.verdict === 'PASS' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-red-600 text-red-700 dark:text-red-400'}`}>
          {ruling.verdict}
          <p className="mt-2 text-base font-normal text-muted-foreground">{ruling.headline}</p>
        </div>
      )}
    </main>
  );
}
