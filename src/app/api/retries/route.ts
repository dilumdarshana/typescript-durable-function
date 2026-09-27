import { start } from 'workflow/api';
import { handleRetryDemo } from '@/workflows/retry-demo';
import { NextResponse } from 'next/server';

/**
 * Starts the retries demo workflow.
 *
 * `failuresBeforeSuccess` controls how many attempts the first step fails
 * before it succeeds, so the UI can demonstrate recovery at any point.
 */
export async function POST(request: Request) {
  const { failuresBeforeSuccess } = await request.json();

  const run = await start(handleRetryDemo, [failuresBeforeSuccess]);

  return NextResponse.json({ runId: run.runId });
}
