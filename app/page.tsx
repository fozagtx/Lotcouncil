'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
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
        <h1 className="mb-6 text-3xl font-bold tracking-tight">Lotcouncil</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Loading markets…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Lotcouncil</h1>
      <p className="mb-6 text-zinc-600 dark:text-zinc-400">Put your trading idea on trial. No Python, full-stack Next.js.</p>

      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Token</label>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {markets.tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.label} — {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Window (days)</label>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {markets.windows_days.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Fee (%)</label>
            <select
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
            >
              {markets.fees_pct.map((f) => (
                <option key={f} value={f}>
                  {f}%
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Idea</label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="buy when the 10 hour average crosses above the 40 hour average"
          />
        </div>

        <Button onClick={run} disabled={running}>
          {running ? 'Judging…' : 'Run the court'}
        </Button>
      </div>

      {messages.length > 0 && (
        <div className="mt-6 space-y-2">
          {messages.map((m, i) => (
            <div key={i} className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              {m}
            </div>
          ))}
        </div>
      )}

      {ruling && (
        <div className={`mt-6 rounded-xl border-2 p-6 text-center text-2xl font-bold ${ruling.verdict === 'PASS' ? 'border-green-600 text-green-700 dark:text-green-400' : 'border-red-600 text-red-700 dark:text-red-400'}`}>
          {ruling.verdict}
          <p className="mt-2 text-base font-normal text-zinc-700 dark:text-zinc-300">{ruling.headline}</p>
        </div>
      )}
    </main>
  );
}
