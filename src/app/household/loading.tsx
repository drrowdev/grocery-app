export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <main className="flex-1 px-5 py-5 mx-auto w-full max-w-2xl space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-14 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          </div>
        </div>
        <div className="h-28 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-48 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-40 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </main>
    </div>
  );
}
