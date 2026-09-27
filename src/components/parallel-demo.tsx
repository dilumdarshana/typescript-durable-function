"use client";

import { useState } from 'react';
import type { ParallelEvent, ParallelReport } from '@/workflows/parallel-demo';

type RunState = {
  runId: string;
  status: string;
  output: ParallelReport | null;
  error: { code: string | null; message: string } | null;
};

const PHASE_LABELS: Record<string, string> = {
  sequential: 'Sequential',
  parallel: 'Parallel',
  race: 'Race',
};

/**
 * Interactive demo for parallel step execution.
 *
 * Streams progress events so the fan-out is visible while it happens, then
 * shows the timing comparison the workflow calculated.
 */
export function ParallelDemo() {
  const [run, setRun] = useState<RunState | null>(null);
  const [events, setEvents] = useState<ParallelEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startDemo() {
    setLoading(true);
    setError(null);
    setRun(null);
    setEvents([]);

    try {
      const res = await fetch('/api/parallel', { method: 'POST' });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const { runId } = await res.json();
      setRun({ runId, status: 'pending', output: null, error: null });

      void tailStream(runId);
      void pollStatus(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  /** Reads the newline-delimited JSON stream, buffering partial lines. */
  async function tailStream(runId: string) {
    const res = await fetch(`/api/parallel/${runId}/stream`);

    if (!res.body) {
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        try {
          setEvents((previous) => [...previous, JSON.parse(line)]);
        } catch {
          // Ignore partial or non-JSON lines rather than breaking the tail.
        }
      }
    }
  }

  async function pollStatus(runId: string) {
    const res = await fetch(`/api/parallel/${runId}`);
    const data = await res.json();
    setRun(data);

    if (data.status === 'pending' || data.status === 'running') {
      setTimeout(() => pollStatus(runId), 1000);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8 pt-12">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Parallel Execution
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          A workflow body is an ordinary async function, so{' '}
          <code>Promise.all</code> and <code>Promise.race</code> compose
          steps directly. The same three items run one at a time, then all at
          once, then raced against a <code>sleep()</code> deadline.
        </p>
      </div>

      <button
        type="button"
        onClick={startDemo}
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {loading ? 'Starting...' : 'Run parallel demo'}
      </button>

      {error && (
        <p className="w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {run && (
        <div className="flex w-full max-w-3xl items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            Run {run.runId}
          </span>
          <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {run.status}
          </span>
        </div>
      )}

      {events.length > 0 && (
        <div className="w-full max-w-3xl rounded-lg border border-zinc-200 text-sm dark:border-zinc-800">
          <p className="border-b border-zinc-200 px-4 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            Step activity
          </p>
          <ul className="divide-y divide-zinc-200 font-mono text-xs dark:divide-zinc-800">
            {events.map((event, index) => (
              <li
                key={`${event.phase}-${event.item}-${event.status}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 px-4 py-1.5"
              >
                <span className="w-24 shrink-0 uppercase text-zinc-500 dark:text-zinc-400">
                  {PHASE_LABELS[event.phase]}
                </span>
                <span className="w-36 shrink-0 text-zinc-700 dark:text-zinc-300">
                  {event.item}
                </span>
                <span
                  className={
                    event.status === 'finished'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }
                >
                  {event.status}
                </span>
                {event.elapsedMs > 0 && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {event.elapsedMs}ms
                  </span>
                )}
                {event.note && (
                  <span className="w-full text-zinc-500 dark:text-zinc-400">
                    {event.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run?.output && (
        <div className="w-full max-w-3xl space-y-4">
          <div className="rounded-lg border border-zinc-200 text-sm dark:border-zinc-800">
            <p className="border-b border-zinc-200 px-4 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
              Wall-clock comparison
            </p>
            <div className="grid grid-cols-1 gap-px bg-zinc-200 sm:grid-cols-2 dark:bg-zinc-800">
              {[run.output.sequential, run.output.parallel].map((phase) => (
                <div key={phase.phase} className="bg-white p-4 dark:bg-zinc-900">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {phase.label}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {phase.strategy}
                  </p>
                  <p className="mt-2 font-mono text-2xl text-zinc-900 dark:text-zinc-50">
                    {phase.wallClockMs}ms
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    finished in order: {phase.completionOrder.join(' → ')}
                  </p>
                </div>
              ))}
            </div>
            <p className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              <code>Promise.all</code> cut {run.output.speedup}× the elapsed
              time. Results still come back in array order regardless of
              which step finished first.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Promise.race won by: {run.output.race.winner} ({run.output.race.elapsedMs}
              ms)
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              {run.output.race.note}
            </p>
          </div>
        </div>
      )}

      {run?.error && (
        <p className="w-full max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Run failed{run.error.code ? ` (${run.error.code})` : ''}:{' '}
          {run.error.message}
        </p>
      )}
    </div>
  );
}
