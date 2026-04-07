import { headers } from "next/headers";

export default async function Home() {
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent") ?? "unknown";
  const renderedAt = new Date().toISOString();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col gap-12 justify-center py-32 px-16 bg-white dark:bg-black">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50 mb-2">
            SSR Test
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            This page is server-rendered on every request.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">
              Rendered at
            </p>
            <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {renderedAt}
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1">
              User-Agent (from request headers)
            </p>
            <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100 break-all">
              {userAgent}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
