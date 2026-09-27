import {
  FatalError,
  RetryableError,
  getStepMetadata,
  getWritable,
} from 'workflow';

/**
 * The three retry behaviours this demo contrasts. Each one fails on every
 * attempt, so the difference is entirely in how the runtime reacts.
 */
export type RetryScenario = 'transient' | 'backoff' | 'fatal';

/** One step attempt, streamed to the UI as it happens. */
export type RetryEvent = {
  scenario: RetryScenario;
  attempt: number;
  outcome: 'failed' | 'succeeded';
  errorType: 'plain' | 'retryable' | 'fatal' | 'none';
  message: string;
  /** Stable across retries — the documented idempotency-key pattern. */
  idempotencyKey: string;
};

/** The workflow's final report, returned once every scenario has run. */
export type ScenarioReport = {
  scenario: RetryScenario;
  title: string;
  behaviour: string;
  outcome: 'succeeded' | 'failed';
  attempts: number;
  detail: string;
};

const TRANSIENT_MAX_RETRIES = 5;
const BACKOFF_MAX_RETRIES = 2;
const BACKOFF_RETRY_AFTER = '1s';

/**
 * Runs three failing steps back to back to contrast the SDK's retry
 * behaviours. Every failure is caught, so the run always completes and can
 * report a side-by-side summary.
 */
export async function handleRetryDemo(failuresBeforeSuccess: number) {
  "use workflow";

  const reports: ScenarioReport[] = [];

  // 1. A plain Error is treated as transient: retried until it succeeds.
  //    `failuresBeforeSuccess` lets the UI choose how many attempts fail.
  try {
    const attempts = await recoverAfterTransientError(failuresBeforeSuccess);
    reports.push({
      scenario: 'transient',
      title: 'Plain Error',
      behaviour: 'retried automatically',
      outcome: 'succeeded',
      attempts,
      detail: `Failed ${failuresBeforeSuccess} time(s), then succeeded on attempt ${attempts}.`,
    });
  } catch (err) {
    reports.push({
      scenario: 'transient',
      title: 'Plain Error',
      behaviour: 'retried automatically',
      outcome: 'failed',
      attempts: TRANSIENT_MAX_RETRIES + 1,
      detail: `Exhausted maxRetries (${TRANSIENT_MAX_RETRIES}). ${messageOf(err)}`,
    });
  }

  // 2. RetryableError adds a `retryAfter` delay, so retries are spaced out
  //    instead of being re-enqueued immediately.
  try {
    await rateLimitedWithBackoff();
    reports.push({
      scenario: 'backoff',
      title: 'RetryableError',
      behaviour: `retried after ${BACKOFF_RETRY_AFTER} delay`,
      outcome: 'succeeded',
      attempts: 1,
      detail: 'Unexpectedly succeeded.',
    });
  } catch (err) {
    reports.push({
      scenario: 'backoff',
      title: 'RetryableError',
      behaviour: `retried after ${BACKOFF_RETRY_AFTER} delay`,
      outcome: 'failed',
      attempts: BACKOFF_MAX_RETRIES + 1,
      detail: `Gave up after ${BACKOFF_MAX_RETRIES + 1} attempts. ${messageOf(err)}`,
    });
  }

  // 3. FatalError marks a permanent failure and skips the retry loop
  //    entirely — attempt stays at 1.
  try {
    await rejectInvalidPayload();
    reports.push({
      scenario: 'fatal',
      title: 'FatalError',
      behaviour: 'never retried',
      outcome: 'succeeded',
      attempts: 1,
      detail: 'Unexpectedly succeeded.',
    });
  } catch (err) {
    reports.push({
      scenario: 'fatal',
      title: 'FatalError',
      behaviour: 'never retried',
      outcome: 'failed',
      attempts: 1,
      detail: `Failed on the first attempt. ${messageOf(err)}`,
    });
  }

  return reports;
}

/**
 * Fails its first `failuresBeforeSuccess` attempts with a plain Error, then
 * succeeds. Plain errors are the default retried case.
 */
async function recoverAfterTransientError(failuresBeforeSuccess: number) {
  "use step";

  const { attempt, stepId } = getStepMetadata();
  const shouldFail = attempt <= failuresBeforeSuccess;

  await reportAttempt({
    scenario: 'transient',
    attempt,
    outcome: shouldFail ? 'failed' : 'succeeded',
    errorType: shouldFail ? 'plain' : 'none',
    message: shouldFail
      ? `Upstream returned 503 Service Unavailable (attempt ${attempt})`
      : `Upstream healthy on attempt ${attempt}`,
    idempotencyKey: stepId,
  });

  if (shouldFail) {
    throw new Error(`Transient upstream error on attempt ${attempt}`);
  }

  return attempt;
}
recoverAfterTransientError.maxRetries = TRANSIENT_MAX_RETRIES;

/**
 * Always throws a RetryableError with a `retryAfter` delay, so the runtime
 * spaces the retries out instead of re-enqueueing immediately. Runs out of
 * retries after BACKOFF_MAX_RETRIES + 1 attempts.
 */
async function rateLimitedWithBackoff() {
  "use step";

  const { attempt, stepId } = getStepMetadata();

  await reportAttempt({
    scenario: 'backoff',
    attempt,
    outcome: 'failed',
    errorType: 'retryable',
    message: `Upstream returned 429 Too Many Requests (attempt ${attempt})`,
    idempotencyKey: stepId,
  });

  throw new RetryableError('Rate limited by upstream.', {
    retryAfter: BACKOFF_RETRY_AFTER,
  });
}
rateLimitedWithBackoff.maxRetries = BACKOFF_MAX_RETRIES;

/**
 * Always throws a FatalError, which the runtime treats as permanent and does
 * not retry — `attempt` never advances past 1.
 */
async function rejectInvalidPayload() {
  "use step";

  const { attempt, stepId } = getStepMetadata();

  await reportAttempt({
    scenario: 'fatal',
    attempt,
    outcome: 'failed',
    errorType: 'fatal',
    message: `Payload failed validation (attempt ${attempt})`,
    idempotencyKey: stepId,
  });

  throw new FatalError('Invalid payload. Retrying cannot fix this.');
}

/**
 * Streams one attempt to the run's default stream so the UI can render
 * retries as they happen.
 *
 * This is a plain helper, not a step — it is only valid when called from
 * inside a step, where the run's stream context is available. The lock is
 * released in `finally` so a failed write can't leave the stream locked for
 * the next attempt.
 */
async function reportAttempt(event: RetryEvent) {
  const writer = getWritable<RetryEvent>().getWriter();

  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

/** Pulls a readable message off whatever the step threw. */
function messageOf(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}
