import { getRun } from 'workflow/api';
import { ndjsonResponse } from '@/lib/ndjson';

/**
 * Streams progress events as the fan-out proceeds.
 *
 * Every step in this demo writes to the same stream, so the log makes the
 * interleaving visible: sequential items finish in a strict order, while
 * parallel items finish in whatever order they happen to complete.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = getRun(runId);

  return ndjsonResponse(run.readable);
}
