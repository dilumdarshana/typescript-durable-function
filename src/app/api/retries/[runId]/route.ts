import { getRun } from 'workflow/api';
import { WorkflowRunFailedError } from 'workflow/errors';
import { NextResponse } from 'next/server';
import type { ScenarioReport } from '@/workflows/retry-demo';

/**
 * Polls a retries demo run for its final status and summary.
 *
 * Because the demo deliberately fails steps, this route has to handle a
 * failed run as well as a successful one: reading `run.returnValue` on a
 * failed run throws a `WorkflowRunFailedError` whose `cause` carries the
 * user-facing message and a classification `code`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  // getRun is generic, so we can type the run's return value up front and
  // avoid casting it at the assignment below.
  const run = getRun<ScenarioReport[]>(runId);
  const status = await run.status;

  let output: ScenarioReport[] | null = null;
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
