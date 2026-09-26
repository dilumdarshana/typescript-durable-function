import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workflow SDK Demos",
  description: "A comprehensive set of demos showcasing Vercel's Workflow SDK",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
        <footer className="border-t border-zinc-200 px-6 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          © 2026
        </footer>
      </body>
    </html>
  );
}