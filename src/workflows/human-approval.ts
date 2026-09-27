import { getStepMetadata, getWorkflowMetadata, getWritable, sleep } from 'workflow';
import { approvalHook } from './hooks/approval-hook';

/** Progress events streamed to the UI as the request progresses. */
export type HitlEvent =
  | { kind: 'pending'; token: string; amount: number; approvalTimeoutMs: number }
  | { kind: 'decided'; approved: boolean; comment: string }
  | { kind: 'expired'; approvalTimeoutMs: number }
  | { kind: 'provisioned'; receipt: string };

/** The workflow's final report. */
export type ApprovalReport = {
  status: 'approved' | 'rejected' | 'expired';
  amount: number;
  comment: string;
  receipt: string | null;
};

/**
 * A human-in-the-loop approval gate.
 *
 * The workflow suspends at a hook until a reviewer sends a decision through
 * the API route. Nothing polls and no state is held in memory: the wait is
 * recorded in the event log, so the run can sit idle indefinitely and still
 * resume correctly, even across a deploy.
 */
export async function handleAccessRequest(input: {
  amount: number;
  approvalTimeoutMs: number;
}) {
  "use workflow";

  const { amount, approvalTimeoutMs } = input;
  const { workflowRunId } = getWorkflowMetadata();

  // Hook tokens must be unique across every live run in the project, so a
  // hardcoded token would collide as soon as two requests overlap. Deriving
  // it from the run id keeps it unique per run.
  const hook = approvalHook.create({ token: `approval:${workflowRunId}` });

  // create() only builds the handle — it does not register anything.
  // Awaiting getConflict() is what suspends the run and commits the
  // registration, so the token is already live by the time a reviewer
  // receives it. Skip this and a decision can arrive before the hook exists.
  await hook.getConflict();

  // The token has to reach the browser, and stream writes are only allowed
  // from inside steps — so a step publishes it.
  await announceRequest(hook.token, amount, approvalTimeoutMs);

  // Hooks have no native timeout, so the deadline is just another promise in
  // a race. Note the loser is not cancelled: an expired hook stays
  // registered until the run reaches a terminal state.
  const decision = await Promise.race([
    hook,
    sleep(approvalTimeoutMs).then(() => null),
  ]);

  if (decision === null) {
    await announceExpiry(approvalTimeoutMs);

    return {
      status: 'expired',
      amount,
      comment: '',
      receipt: null,
    } satisfies ApprovalReport;
  }

  await announceDecision(decision.approved, decision.comment);

  if (!decision.approved) {
    return {
      status: 'rejected',
      amount,
      comment: decision.comment,
      receipt: null,
    } satisfies ApprovalReport;
  }

  const receipt = await provisionAccess(amount, decision.comment);

  return {
    status: 'approved',
    amount,
    comment: decision.comment,
    receipt,
  } satisfies ApprovalReport;
}

/** Publishes the hook token so the UI can offer approve/deny controls. */
async function announceRequest(
  token: string,
  amount: number,
  approvalTimeoutMs: number
) {
  "use step";

  await report({ kind: 'pending', token, amount, approvalTimeoutMs });
}

async function announceDecision(approved: boolean, comment: string) {
  "use step";

  await report({ kind: 'decided', approved, comment });
}

async function announceExpiry(approvalTimeoutMs: number) {
  "use step";

  await report({ kind: 'expired', approvalTimeoutMs });
}

/**
 * Runs only on the approved path, so the workflow shows that a rejection
 * short-circuits the work rather than unwinding it.
 */
async function provisionAccess(amount: number, comment: string) {
  "use step";

  const { stepId } = getStepMetadata();

  // Stands in for a real provisioning call.
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Derived from the step id, which is stable across retries — the same
  // property that makes it usable as an idempotency key.
  const receipt = `rcpt_${stepId.slice(-8)}`;

  await report({ kind: 'provisioned', receipt });

  console.log(`Provisioned $${amount} (${comment || 'no comment'})`);

  return receipt;
}

/**
 * Streams one event to the run's default stream.
 *
 * Plain helper, not a step — only valid when called from inside a step,
 * where the run's stream context exists. The lock must always be released,
 * or the step's request hangs until it times out.
 */
async function report(event: HitlEvent) {
  const writer = getWritable<HitlEvent>().getWriter();

  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
