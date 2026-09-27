import { FatalError, sleep } from 'workflow';

// The shape of a user created by the workflow.
export type User = {
  id: string;
  email: string;
};

/**
 * A durable workflow that orchestrates a user signup.
 *
 * The `"use workflow"` directive marks this function as a workflow
 * orchestrator. It is compiled into a dedicated route and its progress is
 * persisted to an event log, so it can suspend and resume exactly where it
 * left off — even across crashes, restarts, or new deployments.
 *
 * Workflow functions are deterministic and run in a sandboxed Node.js VM
 * with no full Node.js access — no `fs`, global `fetch`, timers, or
 * `Buffer`. All real work (DB calls, APIs, etc.) must happen inside step
 * functions (`"use step"`). `console`, `Math.random()`, and `Date.now()`
 * are allowed; the SDK fixes the latter two across replays.
 */
export async function handleUserSignup(email: string) {
  "use workflow";

  // Each awaited step suspends the workflow while the step runs in its own
  // isolated route, then resumes automatically with the step's result.
  const user = await createUser(email);
  await sendWelcomeEmail(user);

  // sleep() pauses the workflow without consuming any compute resources.
  // It can be seconds, hours, days, or months long.
  await sleep('5s');

  await sendOnboardingEmail(user);

  // The return value is persisted to the event log and can be read later
  // via the run's `returnValue`.
  return { userId: user.id, status: 'onboarded' };
}

/**
 * A step function. The `"use step"` directive gives it full Node.js runtime
 * access and automatic retries: if it throws a plain Error, the runtime
 * retries it (maxRetries defaults to 3, so up to 4 total attempts) before
 * propagating the failure to the workflow.
 *
 * Outside a workflow this directive is a no-op and the function just runs
 * like any other — which is what makes step functions unit-testable.
 */
async function createUser(email: string): Promise<User> {
  "use step";

  console.log(`Creating user with email: ${email}`);

  return { id: crypto.randomUUID(), email };
}

/**
 * Demonstrates automatic retries: ~30% of the time this step throws a plain
 * Error, which the runtime treats as transient and retries automatically.
 */
async function sendWelcomeEmail(user: User) {
  "use step";

  console.log(`Sending welcome email to user: ${user.id}`);

  if (Math.random() < 0.3) {
    throw new Error('Transient email provider error');
  }
}

/**
 * Demonstrates FatalError: an intentional, permanent failure that should NOT
 * be retried. The workflow fails immediately with this error.
 */
async function sendOnboardingEmail(user: User) {
  "use step";

  if (!user.email.includes('@')) {
    throw new FatalError('Invalid email');
  }

  console.log(`Sending onboarding email to user: ${user.id}`);
}
