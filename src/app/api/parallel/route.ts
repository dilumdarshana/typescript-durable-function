import { start } from 'workflow/api';
import { handleParallelDemo } from '@/workflows/parallel-demo';
import { NextResponse } from 'next/server';

/**
 * Starts the parallel execution demo workflow.
 *
 * The workflow needs no input — the workload it simulates is fixed — so this
 * route exists purely to hand back a `runId` for the stream and status
 * routes to follow.
 */
export async function POST() {
  const run = await start(handleParallelDemo);

  return NextResponse.json({ runId: run.runId });
}
