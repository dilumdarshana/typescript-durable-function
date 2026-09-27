import { getRun } from 'workflow/api';
import { WorkflowRunFailedError } from 'workflow/errors';
import { NextResponse } from 'next/server';
import type { ParallelReport } from '@/workflows/parallel-demo';

/**
 * Polls a parallel execution run for its final timing report.
 *
 * As with the retries demo, a failed run is possible: reading `returnValue`
 * on one throws a `WorkflowRunFailedError` whose `cause` carries the message
 * and a classification `code`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = getRun<ParallelReport>(runId);
  const status = await run.status;

  let output: ParallelReport | null = null;
  let error: { code: string | null; message: string } | null = null;

  if (status === 'completed') {
    output = await run.returnValue;
  } else if (status === 'failed') {
    try {
      await run.returnValue;
    } catch (err) {
      if (WorkflowRunFailedError.is(err)) {
        error = { code: err.cause.code ?? null, message: err.cause.message };
      } else {
        error = {
          code: null,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  return NextResponse.json({ runId: run.runId, status, output, error });
}
