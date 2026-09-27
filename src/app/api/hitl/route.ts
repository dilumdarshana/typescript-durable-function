import { start } from 'workflow/api';
import { handleAccessRequest } from '@/workflows/human-approval';
import { NextResponse } from 'next/server';

/**
 * Starts a human-in-the-loop approval request and returns its `runId`.
 *
 * The workflow suspends on a hook straight after this responds, so the
 * caller gets a run id immediately and the reviewer decides later.
 *
 * The deadline is passed as milliseconds rather than a duration string
 * because `sleep()`'s string overload only accepts the `ms` package's
 * `StringValue` union, which a wire-supplied `string` cannot satisfy.
 */
export async function POST(request: Request) {
  const { amount, approvalTimeoutMs } = await request.json();

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json(
      { error: 'amount must be a non-negative number' },
      { status: 400 }
    );
  }

  if (
    typeof approvalTimeoutMs !== 'number' ||
    !Number.isFinite(approvalTimeoutMs) ||
    approvalTimeoutMs <= 0
  ) {
    return NextResponse.json(
      { error: 'approvalTimeoutMs must be a positive number' },
      { status: 400 }
    );
  }

  const run = await start(handleAccessRequest, [
    { amount, approvalTimeoutMs },
  ]);

  return NextResponse.json({ runId: run.runId });
}
