import { getHookByToken } from 'workflow/api';
import { HookNotFoundError } from 'workflow/errors';
import { NextResponse } from 'next/server';
import { approvalHook } from '@/workflows/hooks/approval-hook';

/**
 * Records a reviewer's decision and resumes the waiting workflow.
 *
 * This is the whole resumption path. The workflow is not held open — it
 * suspended on a hook, and this call delivers the payload and wakes it up.
 *
 * Note this uses `createHook` + a private route rather than `createWebhook`.
 * A webhook is resumable by anyone who has its URL, and that token is the
 * only authorization performed. Here the token only ever travels between our
 * own route and our own UI, so we get to decide who may resume.
 */
export async function POST(request: Request) {
  const { token, approved, comment } = await request.json();

  if (typeof token !== 'string' || typeof approved !== 'boolean') {
    return NextResponse.json(
      { error: 'token and approved are required' },
      { status: 400 }
    );
  }

  // The token is a bearer secret, so confirm the hook is still live before
  // acting on it. Hook tokens are released as soon as the owning run reaches
  // a terminal state and can then be reused, which means a stale or replayed
  // approval link must not be able to resume anything.
  try {
    await getHookByToken(token);
  } catch (err) {
    if (HookNotFoundError.is(err)) {
      return NextResponse.json(
        { error: 'This approval link has expired or was already decided.' },
        { status: 404 }
      );
    }

    throw err;
  }

  // `resume()` throws HookNotFoundError rather than returning null, so there
  // is no falsy check here — the guard above is the one place that needs it.
  const hook = await approvalHook.resume(token, {
    approved,
    comment: typeof comment === 'string' ? comment : '',
  });

  return NextResponse.json({ success: true, runId: hook.runId });
}
