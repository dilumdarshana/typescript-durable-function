"use client";

import { useState } from 'react';
import type { ApprovalReport, HitlEvent } from '@/workflows/human-approval';

type RunState = {
  runId: string;
  status: string;
  output: ApprovalReport | null;
  error: { code: string | null; message: string } | null;
};

type Pending = { token: string; amount: number; approvalTimeoutMs: number };

/**
 * Interactive demo for human-in-the-loop approvals.
 *
 * Starts a run that suspends on a hook, shows the approve/deny controls once
 * the token arrives over the stream, then reports the outcome.
 */
export function HumanInTheLoopDemo() {
  const [run, setRun] = useState<RunState | null>(null);
  const [events, setEvents] = useState<HitlEvent[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startDemo(approvalTimeoutMs: number) {
    setLoading(true);
    setError(null);
    setNotice(null);
    setRun(null);
    setEvents([]);
    setPending(null);
    setComment('');

    try {
      const res = await fetch('/api/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 250, approvalTimeoutMs }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      setRun({ runId: data.runId, status: 'pending', output: null, error: null });

      void tailStream(data.runId);
      void pollStatus(data.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  /** Reads the newline-delimited JSON stream, buffering partial lines. */
  async function tailStream(runId: string) {
    const res = await fetch(`/api/hitl/${runId}/stream`);

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
          const event: HitlEvent = JSON.parse(line);
          setEvents((previous) => [...previous, event]);

          // The token is the reviewer's handle on this run.
          if (event.kind === 'pending') {
            setPending({
              token: event.token,
              amount: event.amount,
              approvalTimeoutMs: event.approvalTimeoutMs,
            });
          }
        } catch {
          // Ignore partial or non-JSON lines rather than breaking the tail.
        }
      }
    }
  }

  async function pollStatus(runId: string) {
    const res = await fetch(`/api/hitl/${runId}`);
    const data = await res.json();
    setRun(data);

    if (data.status === 'pending' || data.status === 'running') {
      setTimeout(() => pollStatus(runId), 1000);
    }
  }

  async function decide(approved: boolean) {
    if (!pending) {
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const res = await fetch('/api/hitl/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pending.token, approved, comment }),
      });

      const data = await res.json();

      if (!res.ok) {
        // A 404 here means the run already reached a terminal state, so its
        // hook token was released — the decision arrived too late.
        setNotice(data.error ?? `Request failed with status ${res.status}`);
        return;
      }

      setPending(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8 pt-12">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Human-in-the-Loop
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          The workflow suspends on a hook until a reviewer decides. The wait
          lives in the event log rather than in memory, so the run can sit
          idle — even across a deploy — and still resume exactly where it
          stopped.
        </p>
      </div>

      <div className="flex w-full max-w-2xl flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => startDemo(60_000)}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? 'Starting...' : 'Request $250 access'}
        </button>
        <button
          type="button"
          onClick={() => startDemo(2_000)}
          disabled={loading}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100"
        >
          Request with a 2s window
        </button>
      </div>

      <p className="w-full max-w-2xl text-center text-xs text-zinc-500 dark:text-zinc-400">
        The second button sets a 2 second approval window so you can watch the
        timeout branch resolve on its own.
      </p>

      {error && (
        <p className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {run && (
        <div className="flex w-full max-w-2xl items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            Run {run.runId}
          </span>
          <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {run.status}
          </span>
          {pending && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              suspended on a hook — no compute is being used
            </span>
          )}
        </div>
      )}

      {pending && (
        <div className="w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Waiting for a decision on ${pending.amount} (expires in{' '}
            {Math.round(pending.approvalTimeoutMs / 1000)}s)
          </p>

          <p className="mt-2 break-all font-mono text-xs text-amber-800 dark:text-amber-300">
            token: {pending.token}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            This token is a bearer secret — whoever holds it can resume the
            run. It is released as soon as the run reaches a terminal state.
          </p>

          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment for the reviewer"
            className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-amber-600 dark:border-amber-800 dark:bg-zinc-950 dark:text-zinc-50"
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => decide(true)}
              disabled={submitting}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => decide(false)}
              disabled={submitting}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className="w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {notice}
        </p>
      )}

      {events.length > 0 && (
        <div className="w-full max-w-2xl rounded-lg border border-zinc-200 text-sm dark:border-zinc-800">
          <p className="border-b border-zinc-200 px-4 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            Run activity
          </p>
          <ul className="divide-y divide-zinc-200 font-mono text-xs dark:divide-zinc-800">
            {events.map((event, index) => (
              <li key={index} className="px-4 py-1.5 text-zinc-600 dark:text-zinc-400">
                {describe(event)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run?.output && (
        <div
          className={`w-full max-w-2xl rounded-lg border px-4 py-3 text-sm ${
            run.output.status === 'approved'
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
              : 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
          }`}
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            Result: {run.output.status}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {run.output.status === 'approved' &&
              `Provisioned $${run.output.amount} (receipt ${run.output.receipt}).`}
            {run.output.status === 'rejected' &&
              `Denied${run.output.comment ? `: ${run.output.comment}` : '.'} No access was provisioned.`}
            {run.output.status === 'expired' &&
              'No decision arrived before the deadline, so the run finished without provisioning.'}
          </p>
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

/** Renders one streamed event as a log line. */
function describe(event: HitlEvent) {
  switch (event.kind) {
    case 'pending':
      return `published hook token, waiting up to ${Math.round(event.approvalTimeoutMs / 1000)}s`;
    case 'decided':
      return event.approved
        ? `decision: approved${event.comment ? ` (${event.comment})` : ''}`
        : `decision: denied${event.comment ? ` (${event.comment})` : ''}`;
    case 'expired':
      return `expired after ${Math.round(event.approvalTimeoutMs / 1000)}s, no decision received`;
    case 'provisioned':
      return `provisioned, receipt ${event.receipt}`;
  }
}
