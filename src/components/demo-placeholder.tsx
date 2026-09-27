/**
 * Simple placeholder component used for demos that are not yet implemented.
 */
export function DemoPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Coming soon</p>
    </div>
  );
}