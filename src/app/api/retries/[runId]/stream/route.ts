import { getRun } from 'workflow/api';

/**
 * Streams each step attempt to the client as it happens.
 *
 * `run.readable` yields *deserialized user values* — the objects the steps
 * wrote — rather than bytes, so it can't be piped into a `Response`
 * directly. We re-encode each chunk as a newline-delimited JSON line here.
 *
 * Chunks already written are replayed before live ones start, so a client
 * that connects late still sees the full attempt history.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = getRun(runId);
  const encoder = new TextEncoder();

  const ndjson = run.readable.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        // A step can write strings or structured values; normalise both to
        // one JSON object per line so the client only has to parse one shape.
        const payload =
          typeof chunk === 'string' ? chunk : JSON.stringify(chunk);

        controller.enqueue(encoder.encode(`${payload}\n`));
      },
    })
  );

  return new Response(ndjson, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}
