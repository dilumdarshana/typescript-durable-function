import { defineHook } from 'workflow';

/** What a reviewer sends back when deciding a request. */
export type ApprovalDecision = {
  approved: boolean;
  comment: string;
};

/**
 * A typed hook, shared between the workflow that waits on it and the API
 * route that resumes it.
 *
 * `defineHook()` is a thin wrapper over `createHook()` + `resumeHook()` that
 * exists to stop the two ends drifting apart: the workflow and the route
 * both import this one definition, so the payload type is checked in both
 * places. An optional Standard Schema validator (Zod, Valibot) can be passed
 * to validate payloads at runtime — omitted here to avoid the dependency.
 *
 * Defined in its own file because it must be importable from both a
 * `"use workflow"` function and an API route.
 */
export const approvalHook = defineHook<ApprovalDecision>();
