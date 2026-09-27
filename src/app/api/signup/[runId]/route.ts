import { getRun } from 'workflow/api';
import { NextResponse } from 'next/server';

/**
 * Route handler that polls a workflow run's status.
 *
 * `getRun()` returns a `Run` handle for a run ID. Its `status` getter
 * resolves to the current run state (pending / running / completed /
 * failed / cancelled). The return value is only available once the run
 * reaches the `completed` state — reading it earlier would block until
 * completion, so we guard it with the status check.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = getRun(runId);

  const status = await run.status;

  let output: unknown = null;
  if (status === 'completed') {
    output = await run.returnValue;
  }

  return NextResponse.json({
    runId: run.runId,
    status,
    output,
  });
}