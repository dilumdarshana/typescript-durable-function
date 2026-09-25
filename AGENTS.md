# AGENTS.md

## Project Overview

A comprehensive set of demos showcasing Vercel's Workflow SDK. Each demo lives in its own route under `src/app/` and explains a distinct concept (e.g. steps, retries, timeouts, parallel execution, human-in-the-loop, durable execution).

## Tech Stack

- **Next.js** 16.3.6 (App Router, Turbopack, `src/` directory)
- **React** 19.2.8
- **Tailwind CSS** 4.3.3 (via `@tailwindcss/postcss`, no `tailwind.config`)
- **TypeScript** 7.0.2
- **pnpm** 11.21.0 (see `packageManager` in `package.json`)

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build (runs type checking)
- `pnpm start` — serve production build
- `pnpm lint` — run ESLint

## Conventions

- Use the App Router with the `src/` directory: `src/app/`
- Import alias: `@/*` maps to `src/*`
- Use Tailwind utility classes for styling; no custom CSS unless necessary
- Each demo is a self-contained route under `src/app/` with its own page and any supporting components/utilities colocated
- Keep demos focused: one concept per route, with a short explanation rendered on the page
- Use Server Components by default; add `"use client"` only where interactivity is required
- Never add comments unless they explain a non-obvious Workflow SDK concept

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->