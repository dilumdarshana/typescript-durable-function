"use client";

import { useState } from 'react';
import type { RetryEvent, ScenarioReport } from '@/workflows/retry-demo';

type RunState = {
  runId: string;
  status: string;
  output: ScenarioReport[] | null;
  error: { code: string | null; message: string } | null;
};

/**
 * Interactive demo for step retries.
 *
 * Starts the workflow, tails its durable stream to render every attempt as it
 * happens, then polls for the final per-scenario summary.
 */
export function RetriesDemo() {
  const [failuresBeforeSuccess, setFailuresBeforeSuccess] = useState(2);
  const [run, setRun] = useState<RunState | null>(null);
  const [events, setEvents] = useState<RetryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startDemo() {
    setLoading(true);
    setError(null);
    setRun(null);
    setEvents([]);

    try {
      const res = await fetch('/api/retries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failuresBeforeSuccess }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const { runId } = await res.json();
      setRun({ runId, status: 'pending', output: null, error: null });

      // The stream replays past attempts first, then tails live ones.
      void tailStream(runId);
      void pollStatus(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Reads the newline-delimited JSON stream. Chunks don't align to line
   * boundaries, so we buffer until we see a newline.
   */
  async function tailStream(runId: string) {
    const res = await fetch(`/api/retries/${runId}/stream`);

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
    const res = await fetch(`/api/retries/${runId}`);
    const data = await res.json();
    setRun(data);

    if (data.status === 'pending' || data.status === 'running') {
      setTimeout(() => pollStatus(runId), 1000);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8 pt-12">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Retries</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Three steps fail on purpose to contrast the SDK&apos;s retry
          behaviours. A plain <code>Error</code> is retried until it succeeds, a{' '}
          <code>RetryableError</code> backs off before retrying, and a{' '}
          <code>FatalError</code> is never retried.
        </p>
      </div>

      <form
        className="flex w-full max-w-2xl flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startDemo();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            Failures before success
          </span>
          <input
            type="number"
            min={0}
            max={5}
            value={failuresBeforeSuccess}
            onChange={(e) => setFailuresBeforeSuccess(Number(e.target.value))}
            className="w-32 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? 'Starting...' : 'Run retries demo'}
        </button>
      </form>

      {error && (
        <p className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {run && (
        <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              Run {run.runId}
            </span>
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {run.status}
            </span>
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="w-full max-w-2xl rounded-lg border border-zinc-200 text-sm dark:border-zinc-800">
          <p className="border-b border-zinc-200 px-4 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            Attempt log
          </p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {events.map((event, index) => (
              <li
                key={`${event.scenario}-${event.attempt}-${index}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2"
              >
                <span className="w-24 shrink-0 font-mono text-xs uppercase text-zinc-500 dark:text-zinc-400">
                  {event.scenario}
                </span>
                <span className="w-20 shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  attempt {event.attempt}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${
                    event.outcome === 'succeeded'
                      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                  }`}
                >
                  {event.errorType === 'none' ? 'ok' : event.errorType}
                </span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {event.message}
                </span>
                <span className="w-full font-mono text-xs text-zinc-400 dark:text-zinc-500">
                  idempotency key: {event.idempotencyKey}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {run?.output && (
        <div className="w-full max-w-2xl rounded-lg border border-zinc-200 text-sm dark:border-zinc-800">
          <p className="border-b border-zinc-200 px-4 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            Summary
          </p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {run.output.map((report) => (
              <li key={report.scenario} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {report.title}
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {report.behaviour}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      report.outcome === 'succeeded'
                        ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {report.outcome}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {report.attempts} attempt
                    {report.attempts === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  {report.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {run?.error && (
        <p className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Run failed{run.error.code ? ` (${run.error.code})` : ''}:{' '}
          {run.error.message}
        </p>
      )}
    </div>
  );
}
