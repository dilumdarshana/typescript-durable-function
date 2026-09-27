import { start } from 'workflow/api';
import { handleUserSignup } from '@/workflows/user-signup';
import { NextResponse } from 'next/server';

/**
 * Route handler that starts the user signup workflow.
 *
 * `start()` enqueues a new workflow run and returns immediately — the
 * workflow executes asynchronously in the background and does not block
 * this request. The returned `runId` lets callers track the run's progress
 * via GET /api/signup/[runId].
 */
export async function POST(request: Request) {
  const { email } = await request.json();

  const run = await start(handleUserSignup, [email]);

  return NextResponse.json({
    message: 'User signup workflow started',
    runId: run.runId,
  });
}
