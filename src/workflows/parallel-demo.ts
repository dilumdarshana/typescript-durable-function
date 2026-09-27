import { getStepMetadata, getWritable, sleep } from 'workflow';

export type ParallelPhase = 'sequential' | 'parallel' | 'race';

/** One progress tick, streamed to the UI as it happens. */
export type ParallelEvent = {
  phase: ParallelPhase;
  item: string;
  status: 'started' | 'finished';
  /** Real elapsed time since the run began, measured inside the step. */
  elapsedMs: number;
  note?: string;
};

/** What a single step reports back to the workflow. */
export type ItemResult = {
  item: string;
  startedAt: number;
  finishedAt: number;
};

export type PhaseReport = {
  phase: ParallelPhase;
  label: string;
  strategy: string;
  /** Span from the first start to the last finish within the phase. */
  wallClockMs: number;
  /** Items in the order they actually finished — differs per strategy. */
  completionOrder: string[];
  results: ItemResult[];
};

export type RaceReport = {
  /** Which branch settled first. */
  winner: 'sleep' | 'step';
  elapsedMs: number;
  note: string;
};

export type ParallelReport = {
  sequential: PhaseReport;
  parallel: PhaseReport;
  race: RaceReport;
  speedup: number;
};

/**
 * The simulated workload. Durations are fixed rather than random so the
 * demo produces the same timings on every run.
 *
 * The slowest item is listed first on purpose: that way the parallel phase
 * finishes in the *opposite* order to the array, which makes the "results
 * come back in array order, not completion order" rule visible rather than
 * coincidental.
 */
const WORKLOAD = [
  { item: 'recommendations', durationMs: 1200 },
  { item: 'order-history', durationMs: 700 },
  { item: 'user-profile', durationMs: 300 },
];

/** The long-running step in the race section is deliberately slower. */
const SLOW_STEP_MS = 6000;

/** How long the sleep branch waits before it wins the race. */
const RACE_TIMEOUT = '2s';

/**
 * Demonstrates that a workflow body is an ordinary async function, so
 * standard Promise combinators compose steps for you.
 *
 * Three phases run in sequence so their costs can be compared directly:
 * the same work done one item at a time, then all at once, then a
 * `Promise.race` that imposes a timeout without cancelling the loser.
 */
export async function handleParallelDemo() {
  'use workflow';

  const items = WORKLOAD.map((entry) => entry.item);

  // Phase 1 — sequential. Each step is awaited before the next is called,
  // so the total is the sum of every item's duration.
  const sequentialResults: ItemResult[] = [];
  for (const item of items) {
    sequentialResults.push(await processItem(item, 'sequential'));
  }

  // Phase 2 — parallel. Calling the step registers and enqueues it; the
  // `await Promise.all` only collects the results. So the total is roughly
  // the slowest single item instead of the sum of all of them.
  const parallelResults = await Promise.all(
    items.map((item) => processItem(item, 'parallel'))
  );

  // Phase 3 — the documented timeout pattern: race real work against a
  // sleep and treat the sleep as the deadline.
  const raceStart = Date.now();
  const raced = await Promise.race([
    slowItem(),
    sleep(RACE_TIMEOUT).then(() => 'timeout' as const),
  ]);

  const race: RaceReport =
    raced === 'timeout'
      ? {
          winner: 'sleep',
          elapsedMs: Date.now() - raceStart,
          note:
            'The sleep won, so the workflow moved on — but the slow step was ' +
            'never cancelled. It keeps running in the background and its ' +
            '"finished" event still arrives after this run has completed.',
        }
      : {
          winner: 'step',
          elapsedMs: Date.now() - raceStart,
          note: 'The step beat the sleep and won the race.',
        };

  const sequential = summarise('sequential', 'Sequential', 'one at a time (await in a loop)', sequentialResults);
  const parallel = summarise('parallel', 'Parallel', 'Promise.all over a mapped list', parallelResults);

  return {
    sequential,
    parallel,
    race,
    speedup: round(sequential.wallClockMs / parallel.wallClockMs),
  } satisfies ParallelReport;
}

/**
 * Simulates one unit of external work. Steps have the full Node.js runtime,
 * so a real timer stands in for a slow API call.
 *
 * Each step stamps its own timings: `Date.now()` inside a workflow body is
 * frozen across replays for determinism, so measuring there would be wrong.
 */
async function processItem(
  item: string,
  phase: ParallelPhase
): Promise<ItemResult> {
  'use step';

  const durationMs = WORKLOAD.find((entry) => entry.item === item)!.durationMs;
  const startedAt = Date.now();

  await report({ phase, item, status: 'started', elapsedMs: 0 });

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  const finishedAt = Date.now();

  await report({
    phase,
    item,
    status: 'finished',
    elapsedMs: finishedAt - startedAt,
  });

  return { item, startedAt, finishedAt };
}

/**
 * The loser of the race. Deliberately slower than RACE_TIMEOUT so the sleep
 * always wins.
 */
async function slowItem(): Promise<ItemResult> {
  'use step';

  const startedAt = Date.now();

  await report({
    phase: 'race',
    item: 'slow-report',
    status: 'started',
    elapsedMs: 0,
    note: `Running for ${SLOW_STEP_MS}ms`,
  });

  await new Promise((resolve) => setTimeout(resolve, SLOW_STEP_MS));

  const finishedAt = Date.now();

  await report({
    phase: 'race',
    item: 'slow-report',
    status: 'finished',
    elapsedMs: finishedAt - startedAt,
    note: 'The race was already decided — this step was never cancelled.',
  });

  return { item: 'slow-report', startedAt, finishedAt };
}

/**
 * Derives a phase's cost from the timestamps its steps reported.
 *
 * Comparing the earliest start to the latest finish is what separates the
 * two strategies: for sequential work the span covers every item, while for
 * parallel work it is bounded by the slowest one.
 */
function summarise(
  phase: ParallelPhase,
  label: string,
  strategy: string,
  results: ItemResult[]
): PhaseReport {
  const startedAt = Math.min(...results.map((r) => r.startedAt));
  const finishedAt = Math.max(...results.map((r) => r.finishedAt));

  return {
    phase,
    label,
    strategy,
    wallClockMs: finishedAt - startedAt,
    completionOrder: [...results]
      .sort((a, b) => a.finishedAt - b.finishedAt)
      .map((r) => r.item),
    results,
  };
}

/** Streams one progress event to the run's default stream. */
async function report(event: ParallelEvent) {
  const writer = getWritable<ParallelEvent>().getWriter();

  try {
    await writer.write(event);
  } finally {
    // Locks are per-step, so releasing here is what lets sibling steps in a
    // fan-out write to the same stream without blocking each other.
    writer.releaseLock();
  }
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
