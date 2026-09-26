"use client";

import { useState } from 'react';

type RunStatus = {
  runId: string;
  status: string;
  output: { userId: string; status: string } | null;
};

export function UserSignupDemo() {
  const [email, setEmail] = useState('');
  const [run, setRun] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startWorkflow() {
    setLoading(true);
    setError(null);
    setRun(null);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();
      setRun({ runId: data.runId, status: 'pending', output: null });
      pollStatus(data.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function pollStatus(runId: string) {
    const res = await fetch(`/api/signup/${runId}`);
    const data = await res.json();
    setRun(data);

    if (data.status === 'pending' || data.status === 'running') {
      setTimeout(() => pollStatus(runId), 1000);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">User Signup</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          A durable workflow that creates a user, sends a welcome email, sleeps
          for 5 seconds, then sends an onboarding email.
        </p>
      </div>

      <form
        className="flex w-full max-w-md flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          startWorkflow();
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? 'Starting...' : 'Start workflow'}
        </button>
      </form>

      {error && (
        <p className="w-full max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {run && (
        <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="font-medium text-zinc-900 dark:text-zinc-50">
              Run {run.runId}
            </span>
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {run.status}
            </span>
          </div>
          {run.output && (
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Output: {JSON.stringify(run.output)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}