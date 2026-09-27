import { withWorkflow } from 'workflow/next';
import type { NextConfig } from 'next';

/**
 * Next.js configuration.
 *
 * `withWorkflow()` wraps the config to enable the Workflow SDK's runtime
 * (including the /.well-known/workflow/* routes and workflow execution).
 */
const nextConfig: NextConfig = {
  /* config options here */
};

export default withWorkflow(nextConfig);
