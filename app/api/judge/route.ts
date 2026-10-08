import { store, judgeEvents } from '@/lib/court/service';
import type { JudgeBody } from '@/lib/court/types';

export async function POST(request: Request) {
  let body: JudgeBody;
  try {
    body = (await request.json()) as JudgeBody;
  } catch {
    return new Response(JSON.stringify({ stage: 'error', message: 'That is not valid JSON.' }) + '\n', {
      status: 400,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of judgeEvents(store, body)) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
    },
  });
}
