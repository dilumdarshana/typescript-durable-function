# Workflow SDK Concepts

This document explains the major concepts behind Vercel's Workflow SDK. Each concept maps to a demo in this project.

## Concepts

- ✓ **Workflows** — A stateful function that coordinates multi-step logic over time. Marked with the `"use workflow"` directive, it remembers its progress and can resume exactly where it left off, even after pausing, restarting, or deploying new code. All inputs and outputs are recorded in an event log.
- ✓ **Steps** — A stateless function that runs a unit of durable work inside a workflow. Marked with the `"use step"` directive, it has full Node.js runtime access, built-in retries, and survives failures like network errors or process crashes. Each step compiles into an isolated API route; while it executes, the workflow suspends without consuming resources.
- ✓ **Retries** — Steps retry automatically on failure (3 retries by default, configurable via `maxRetries`). `RetryableError` customizes the retry delay (e.g. honoring a `429 Retry-After`), and `FatalError` skips retrying for permanent failures. Retried steps with side effects must be idempotent.
- ✓ **Parallel execution** — Workflows are plain async functions, so `Promise.all`, `Promise.allSettled`, and `Promise.race` compose steps, sleeps, and hooks naturally. `Promise.all` runs independent steps concurrently; `Promise.race` returns the first to settle (losing branches keep running).
- ✓ **Error handling** — Uncaught errors in steps are retried; `FatalError` fails permanently; `RetryableError` schedules a retry with a delay. Runs expose an `errorCode` (`USER_ERROR`, `RUNTIME_ERROR`, etc.) and the original thrown value as `cause`. The Saga pattern runs compensating rollback steps in reverse order when a workflow fails partway.
- ✓ **Durable execution** — The SDK uses event sourcing: every mutation (run, step, hook, wait) is persisted as an event, and state is reconstructed by replaying the event log. Workflows are deterministic so replays resume exactly where execution stopped, across crashes, restarts, and deployments.
- ✓ **Long-running workflows** — `sleep()` pauses a workflow for minutes to months without consuming compute, resuming automatically when the time expires. Runs are pinned to the deployment they started on (Skew Protection), so deploying new code doesn't affect in-flight runs.
- ✓ **Human-in-the-loop** — Hooks (`createHook`/`defineHook`) and webhooks (`createWebhook`) pause a workflow until external data arrives — a human approval, a webhook call, or a third-party API response. `resumeHook()`/`resumeWebhook()` deliver the payload and the workflow resumes automatically; no polling or manual state management.
- ✓ **AI workflows** — Durable AI agents built with AI SDK's `WorkflowAgent` (or `DurableAgent`). Agents run inside workflows so LLM calls, tool calls, and multi-turn chat sessions survive restarts, can sleep for hours, and stream responses durably. Tools are defined as steps for retry semantics.
- ✓ **RAG** — Retrieval-augmented generation patterns: workflows orchestrate retrieval steps (search, embeddings, vector store lookups) feeding context into LLM generation steps. Long-running research agents combine parallel retrieval fan-out, durable sleeps, and streaming to produce grounded answers.
- ✓ **Streaming** — `getWritable()` writes incremental data (progress updates, AI tokens, logs) to the run's stream, consumed via `run.readable`. Streams are durable and resumable (`getReadable({ startIndex })`), support namespacing, and can be passed between steps. Stream operations must happen in steps, never in the workflow body.
- ✓ **Observability** — The Workflow CLI (`npx workflow inspect runs`) and web UI (`--web`) inspect runs, steps, hooks, waits, and stream output. The event log provides a complete audit trail; on Vercel, the Observability tab tracks runs in real time, traces failures, and analyzes performance.

## Architecture

The Workflow SDK turns ordinary async functions into durable workflows using two compile-time directives:

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
