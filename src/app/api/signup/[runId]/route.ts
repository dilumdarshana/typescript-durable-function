import { getRun } from 'workflow/api';
import { NextResponse } from 'next/server';

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