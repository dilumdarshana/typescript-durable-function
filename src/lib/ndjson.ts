/**
 * Wraps a workflow run's readable stream as a newline-delimited JSON
 * response.
 *
 * `run.readable` yields *deserialized user values* — whatever a step passed
 * to `writer.write()` — rather than bytes. A `Response` body must yield
 * bytes, so handing the stream straight to `new Response()` fails at runtime
 * with "failed to pipe response". Re-encoding each chunk here keeps that
 * conversion in one place instead of in every streaming route.
 *
 * Chunks already written are replayed before live ones begin, so a client
 * that connects late still receives the full history.
 */
export function ndjsonResponse(stream: ReadableStream) {
  const encoder = new TextEncoder();

  const ndjson = stream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        // A step can write either a string or a structured value. Normalise
        // both to one JSON object per line so clients only parse one shape.
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
