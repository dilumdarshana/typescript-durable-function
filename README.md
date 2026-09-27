# Workflow SDK Demos

A reference project showcasing [Vercel's Workflow SDK](https://workflow-sdk.dev) in TypeScript and Next.js. Each route under `src/app/` demonstrates one durable-execution concept end to end.

**Live demo:** https://typescript-durable-function.vercel.app/

## Demos

| Demo | Route | Shows |
| --- | --- | --- |
| Basics | `/basics` | Workflows, steps, `sleep()`, automatic retries, `FatalError`, run status polling |
| Retries | `/retries` | `maxRetries`, `RetryableError` backoff, idempotency |
| Parallel Execution | `/parallel-execution` | Composing steps with `Promise.all` / `Promise.race`, and the non-cancelled loser |
| Human-in-the-Loop | `/human-in-the-loop` | A typed `defineHook`, resuming from a private route, and an approval timeout |

## Concepts

See [CONCEPTS.md](./CONCEPTS.md) for the SDK's execution model, event sourcing, suspension primitives, deployment model, and a detailed reference on the `"use workflow"` and `"use step"` directives.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm build   # production build (includes type checking)
pnpm start   # serve the production build
pnpm lint    # ESLint
```

> **Note:** `pnpm lint` currently fails with `typescript-eslint does not support TS 7.0` — a known toolchain incompatibility, unrelated to application code. `pnpm build` type-checks cleanly.

## How a demo is wired

Each demo follows the same three-part shape:

1. **Workflow** — `src/workflows/*.ts` holds the `"use workflow"` orchestrator and its `"use step"` functions.
2. **API routes** — `src/app/api/**` start the workflow with `start()` and read run state with `getRun()`.
3. **UI** — a client component under `src/components/` that triggers the workflow, tails the run's stream for live events, and polls for the final result.

`withWorkflow()` in `next.config.ts` installs the SWC plugin that compiles the directives. Without it, both directives are inert no-ops.

## Project Structure

```
src/
├── app/
│   ├── api/                 # start + status routes
│   ├── basics/              # demo pages (one concept per route)
│   ├── retries/
│   ├── parallel-execution/
│   └── human-in-the-loop/
├── components/              # client components, one per demo
├── lib/demos.ts             # demo registry driving the sidebar
└── workflows/               # "use workflow" and "use step" functions
```

## Deploying

Deploy to Vercel and the SDK registers the required `/.well-known/workflow/*` routes automatically via `withWorkflow()`.
