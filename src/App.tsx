import { APP_NAME } from "./lib/app-meta";

export function App() {
  return (
    <main className="grid min-h-screen grid-rows-[auto_1fr] bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <header className="flex h-12 items-center border-b border-[var(--border-subtle)] px-4">
        <h1 className="text-sm font-semibold">{APP_NAME}</h1>
      </header>
      <div className="grid min-h-0 grid-cols-[15rem_minmax(0,1fr)]">
        <aside
          aria-label="Task navigation"
          className="border-r border-[var(--border-subtle)] p-3"
        >
          <p className="text-xs font-medium text-[var(--text-muted)]">Inbox</p>
        </aside>
        <section aria-label="Application workspace" className="min-w-0 p-5">
          <p className="text-sm text-[var(--text-muted)]">Workspace</p>
        </section>
      </div>
    </main>
  );
}
