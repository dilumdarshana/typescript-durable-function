export type Demo = {
  id: string;
  label: string;
  href: string;
};

/**
 * Registry of all demos shown in the sidebar and on the landing page.
 */
export const demos: Demo[] = [
  { id: 'basics', label: 'Basics', href: '/basics' },
  { id: 'retries', label: 'Retries', href: '/retries' },
  { id: 'parallel-execution', label: 'Parallel Execution', href: '/parallel-execution' },
  { id: 'human-in-the-loop', label: 'Human-in-the-Loop', href: '/human-in-the-loop' },
];