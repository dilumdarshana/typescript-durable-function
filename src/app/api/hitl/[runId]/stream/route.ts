import { getRun } from 'workflow/api';
import { ndjsonResponse } from '@/lib/ndjson';

/**
 * Streams the approval lifecycle: the hook token being published, the
 * decision arriving, and the request either expiring or being provisioned.
 *
 * The run suspends between these, so the connection simply stays open with
 * no traffic while it waits for a human.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  const run = getRun(runId);

  return ndjsonResponse(run.readable);
}
