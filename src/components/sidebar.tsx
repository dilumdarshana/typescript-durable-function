"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { samples } from '@/lib/samples';

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <nav className="sticky top-0 flex h-screen flex-col gap-1 overflow-y-auto p-4">
        <Link
          href="/"
          className="mb-4 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Workflow SDK Demos
        </Link>
        {samples.map((sample) => {
          const active = pathname === sample.href;
          return (
            <Link
              key={sample.id}
              href={sample.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
              }`}
            >
              {sample.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}