export default function Loading() {
  return (
    <div className="flex flex-col flex-1 min-h-dvh bg-zinc-50 dark:bg-zinc-950">
      <div className="px-4 pt-5 pb-2 mx-auto w-full max-w-5xl">
        <div className="flex items-center justify-end gap-2 mb-4">
          <div className="h-4 w-8 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-7 w-14 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        </div>
      </div>
      <div className="flex-1 px-4 pb-5 mx-auto w-full max-w-5xl flex gap-4">
        <aside className="hidden md:flex flex-col w-52 shrink-0 self-start rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="h-3 w-12 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse mx-2 my-2" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="mx-1 my-0.5 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse"
            />
          ))}
        </aside>
        <main className="flex-1 min-w-0 max-w-2xl mx-auto">
          <div className="flex gap-2 mb-1.5">
            <div className="flex-1 h-12 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-12 w-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            <div className="h-12 w-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          </div>
          <div className="h-0.5 mb-4 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          <div className="flex gap-1.5 mb-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 w-24 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-11 rounded-xl bg-zinc-200 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
