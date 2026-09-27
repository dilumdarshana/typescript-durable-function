# Workflow SDK Concepts

This document explains the major concepts behind Vercel's Workflow SDK. Each concept maps to a demo in this project.

## Concepts

- ✓ **Workflows** — A stateful function that coordinates multi-step logic over time. Marked with the `"use workflow"` directive, it remembers its progress and can resume exactly where it left off, even after pausing, restarting, or deploying new code. All inputs and outputs are recorded in an event log.
- ✓ **Steps** — A stateless function that runs a unit of durable work inside a workflow. Marked with the `"use step"` directive, it has full Node.js runtime access, built-in retries, and survives failures like network errors or process crashes. Each step compiles into an isolated API route; while it executes, the workflow suspends without consuming resources.
- ✓ **Retries** — Steps retry automatically on failure (`maxRetries` defaults to 3, so up to 4 total attempts: 1 initial + 3 retries). `RetryableError` customizes the retry delay (e.g. honoring a `429 Retry-After`), and `FatalError` skips retrying for permanent failures. Retried steps with side effects must be idempotent.
- ✓ **Parallel execution** — A workflow body is an ordinary async function, so `Promise.all` and `Promise.race` compose steps, sleeps, and hooks with no special API to learn. A step is enqueued when it is *called*, not when it is awaited, so `Promise.all(items.map(i => step(i)))` fans the whole batch out in a single suspension. Results come back in **array order, not completion order**. There is no concurrency limit and no `parallel()` helper. `Promise.race` against `sleep()` is the documented timeout pattern, but the losing branch is **not** cancelled — it runs to completion in the background and the run finishes without it. (`Promise.allSettled` works as a language primitive but is not documented by the SDK.)
- ✓ **Error handling** — Uncaught errors in steps are retried; `FatalError` fails permanently; `RetryableError` schedules a retry with a delay. Runs expose an `errorCode` (`USER_ERROR`, `RUNTIME_ERROR`, etc.) and the original thrown value as `cause`. The Saga pattern runs compensating rollback steps in reverse order when a workflow fails partway.
- ✓ **Durable execution** — The SDK uses event sourcing: every mutation (run, step, hook, wait) is persisted as an event, and state is reconstructed by replaying the event log. Workflows are deterministic so replays resume exactly where execution stopped, across crashes, restarts, and deployments.
- ✓ **Long-running workflows** — `sleep()` pauses a workflow for minutes to months without consuming compute, resuming automatically when the time expires. Runs are pinned to the deployment they started on (Skew Protection), so deploying new code doesn't affect in-flight runs.
- ✓ **Human-in-the-loop** — Hooks (`createHook`/`defineHook`) and webhooks (`createWebhook`) pause a workflow until external data arrives — a human approval, a webhook call, or a third-party API response. `resumeHook()`/`resumeWebhook()` deliver the payload and the workflow resumes automatically; no polling or manual state management.
- ✓ **AI workflows** — Durable AI agents built with AI SDK's `WorkflowAgent` (or `DurableAgent`). Agents run inside workflows so LLM calls, tool calls, and multi-turn chat sessions survive restarts, can sleep for hours, and stream responses durably. Tools are defined as steps for retry semantics.
- ✓ **RAG** — Retrieval-augmented generation patterns: workflows orchestrate retrieval steps (search, embeddings, vector store lookups) feeding context into LLM generation steps. Long-running research agents combine parallel retrieval fan-out, durable sleeps, and streaming to produce grounded answers.
- ✓ **Streaming** — `getWritable()` writes incremental data (progress updates, AI tokens, logs) to the run's stream, consumed via `run.readable`. Streams are durable and resumable (`getReadable({ startIndex })`), support namespacing, and can be passed between steps. Stream operations must happen in steps, never in the workflow body. Note that `run.readable` yields *deserialized values*, not bytes — pipe it through a `TransformStream` before handing it to a `Response`, or the response fails to serialize.
- ✓ **Observability** — The Workflow CLI (`npx workflow inspect runs`) and web UI (`--web`) inspect runs, steps, hooks, waits, and stream output. The event log provides a complete audit trail; on Vercel, the Observability tab tracks runs in real time, traces failures, and analyzes performance.

## Directives

The SDK has exactly **two** directives. Both are compile-time markers read by the SWC plugin that `withWorkflow()` installs — nothing inspects them at runtime.

| Directive | Applies to | Effect |
| --- | --- | --- |
| `"use workflow"` | an `async` function | Marks it as a durable workflow entrypoint. The body is bundled into an orchestrator route and runs in a **Node.js VM sandbox**: deterministic, no side effects. |
| `"use step"` | an `async` function | Marks it as an atomic unit of work. The body is left completely intact, registered with the runtime, and executed in **your own runtime** with full Node.js access and automatic retries. |

### Placement: must be the first statement in the function body

This is a hard compiler error, not a warning — `The "use workflow" directive must be at the top of the function body`.

```ts
// ✅ correct
export async function handleUserSignup(email: string) {
  "use workflow";
  const user = await createUser(email);
  return user;
}

// ❌ build error — a statement precedes the directive
export async function handleUserSignup(email: string) {
  const user = await createUser(email);
  "use workflow";
  return user;
}
```

The marked function must also be `async` (`Functions marked with "use step" must be async functions`). A mis-spelled directive is rejected too, with a `Did you mean ...?` suggestion.

### Quote style

The docs never state a quote requirement, and the compiler matches on the string literal's **value** rather than its quote style, so single quotes almost certainly work. Every sample in the SDK docs uses double quotes and this project follows suit — but only the *spelling* is enforced, not the quotes.

This is the one place the project's single-quote convention doesn't apply. Directive strings stay double-quoted, like `"use strict"`.

### What a workflow body cannot use

Workflow functions run in a sandbox without full Node.js access. Most invalid patterns are caught as **build-time errors** by the transform, before you ever deploy.

| Unavailable in a workflow | Use instead |
| --- | --- |
| Node.js core modules — `fs`, `path`, `http`, `https`, `net`, `dns`, `child_process`, `os`, `stream`, `crypto` | move the logic into a step |
| global `fetch` | `import { fetch } from 'workflow'` |
| `setTimeout`, `setInterval`, `setImmediate` and their `clear*` counterparts | `sleep()` from `'workflow'` |
| `Buffer` | plain serializable values |
| reading or writing streams (`getWriter()`, `write()`, `close()`) | do all stream work inside steps |
| mutating `process.env` (frozen read-only snapshot) | — |

Available and safe inside a workflow: `console`, the web platform APIs, and — importantly — `Math.random()`, `Date.now()`, and `crypto.randomUUID()`. The SDK fixes these across replays so they return the same value every time, which is why they aren't a source of replay divergence. A workflow body must still be *pure*: no API calls, no database writes, no file I/O.

The flip side is that you cannot measure elapsed time in a workflow body — a frozen `Date.now()` would return the same value on every replay. Time anything inside a step, which runs with the real clock, and do the arithmetic on the returned numbers.

### Arguments and return values

Everything crossing the workflow ↔ step boundary is **serialized**, so it must be serializable. Functions, class instances, and symbols can't be reconstructed and will fail. Parameters pass **by value, not by reference** — return new data from a step rather than mutating what you passed in.

### Call rules

- A workflow function **cannot be called directly**. Import it and hand it to `start()`; calling it yourself throws `You attempted to execute workflow ... function directly`.
- `"use step"` outside a workflow is a **no-op** — the function just runs in the current process, with no retry semantics and no observability. That makes step functions safely reusable in tests and ordinary code.
- Steps may be imported from other modules, and class *instance* methods can be steps (requires `WORKFLOW_SERIALIZE`/`WORKFLOW_DESERIALIZE` on the class). `"use workflow"` cannot go on instance methods.
- Both directives are inert without the compiler, which is what makes plain unit testing possible.

### Errors

- Retries are step-only. A step throwing a plain `Error` is retried — `maxRetries` defaults to **3**, giving up to 4 total attempts.
- `FatalError` marks a permanent failure and skips retries. It belongs in steps; an error thrown in the *workflow body* always exits the run and is never retried.
- `REPLAY_DIVERGENCE` and `CORRUPTED_EVENT_LOG` cannot be caught inside a workflow.

### Not SDK directives

`"use client"` and `"use server"` are React / Next.js directives. The SDK docs cite them only as *prior art* for scoped execution directives: they mark **where** code runs, whereas `"use workflow"` additionally changes **how** it runs.

One practical warning from the SDK docs: don't put a top-level `"use server"` in a module imported by a workflow or step. The workflow transform wraps imports in a synchronous initializer that Next.js rejects (`Server Actions must be async functions`). Keep `"use server"` on the files that define the Server Actions, and move shared logic into separate directive-free modules.

## Architecture

Under the hood the SDK transforms ordinary async functions into durable workflows using the two directives above (see [Directives](#directives)):

```
"use workflow"  →  orchestrator function (deterministic, sandboxed, no full Node.js access)
"use step"      →  worker function (full Node.js runtime, automatic retries)
```

**Execution model**

1. A workflow function is compiled into a route that orchestrates execution.
2. When the workflow awaits a step, the runtime persists the step's input to the **event log**, suspends the workflow, and runs the step in an isolated route.
3. When the step completes, the workflow resumes and replays deterministically from the event log — so it always continues exactly where it left off.
4. `sleep()` and hooks/webhooks are also promises, so they suspend the workflow the same way without consuming compute.

**Event sourcing**

Every state change is an event (`run_created`, `step_started`, `step_completed`, `hook_received`, `wait_completed`, ...) persisted to the event log. Entities (runs, steps, hooks, waits) are materialized views derived by replaying events. This gives a complete audit trail, enables debugging by replay, and guarantees recoverability after failures.

**Suspension primitives**

| Primitive | Purpose |
| --- | --- |
| `await step()` | Run durable work with retries; workflow suspends while it runs |
| `sleep(duration)` | Pause for a duration or until a date; no compute consumed |
| `createHook()` / `defineHook()` | Wait for external data; resume via `resumeHook()` |
| `createWebhook()` | Wait for an HTTP request at a generated URL |

**Deployment model**

- Each step compiles into an isolated API route; the workflow function compiles into an orchestrator route.
- Runs are pinned to the deployment that created them (Skew Protection), so deploys and rollbacks don't disturb in-flight runs.
- On Vercel, workflow and step data is encrypted at rest, runs across all Function regions, and is billed by events, data written, and data retained.
