"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { demos } from '@/lib/demos';

/**
 * Left sidebar navigation listing every demo.
 *
 * A client component because it needs `usePathname()` to highlight the
 * currently active demo.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        <Link
          href="/"
          className="mb-4 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Workflow SDK Demos
        </Link>
        {demos.map((demo) => {
          // Highlight the tab matching the current route.
          const active = pathname === demo.href;
          return (
            <Link
              key={demo.id}
              href={demo.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
            >
              {demo.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
