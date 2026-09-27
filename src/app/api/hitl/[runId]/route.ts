import { getRun } from 'workflow/api';
import { WorkflowRunFailedError } from 'workflow/errors';
import { NextResponse } from 'next/server';
import type { ApprovalReport } from '@/workflows/human-approval';

/**
 * Polls a human-in-the-loop run for its final report.
 *
 * Note there is no "waiting for approval" run status — a run blocked on a
 * hook reports plain `running`, indistinguishable from one crunching a long
 * step. That is why the pending/decided state is streamed separately rather
 * than inferred from `status`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = getRun<ApprovalReport>(runId);
  const status = await run.status;

  let output: ApprovalReport | null = null;
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
