import Link from "next/link";
import { samples } from "@/lib/samples";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Workflow SDK Demos
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          A comprehensive set of demos showcasing Vercel&apos;s Workflow SDK
        </p>
      </div>
      <nav className="flex flex-col gap-2">
        {samples.map((sample) => (
          <Link
            key={sample.id}
            href={sample.href}
            className="rounded-lg border border-zinc-200 px-6 py-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-50"
          >
            {sample.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}