import { useMemo, useState } from "react";
import type { CategoryDto, TaskDto } from "../../lib/smartspace-client";
import type { TaskWorkspaceData } from "./workspace-loader";

const ALL_TASKS = "all";

function countTasksByCategory(tasks: readonly TaskDto[]) {
  const counts = new Map<string, number>();

  for (const task of tasks) {
    counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1);
  }

  return counts;
}

function TaskStatusMark({ status }: Pick<TaskDto, "status">) {
  return (
    <span
      aria-label={status === "completed" ? "Completed" : "Open"}
      className={
        status === "completed"
          ? "mt-0.5 size-4 shrink-0 rounded-full border-4 border-[var(--accent-strong)] bg-[var(--surface-raised)]"
          : "mt-0.5 size-4 shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)]"
      }
      role="img"
    />
  );
}

function TaskRow({
  category,
  task,
}: {
  readonly category: CategoryDto | undefined;
  readonly task: TaskDto;
}) {
  return (
    <li className="task-row grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 last:border-b-0">
      <TaskStatusMark status={task.status} />
      <div className="min-w-0">
        <p
          className={
            task.status === "completed"
              ? "break-words text-sm leading-5 text-[var(--text-muted)] line-through"
              : "break-words text-sm leading-5 text-[var(--text-primary)]"
          }
        >
          {task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-[var(--text-muted)]">
          <span>{category?.name ?? "Unknown category"}</span>
          {task.dueDate === null ? null : <span>Due {task.dueDate}</span>}
        </div>
      </div>
    </li>
  );
}

function EmptyTaskList({ filtered }: { readonly filtered: boolean }) {
  return (
    <div className="grid min-h-44 place-content-center px-6 text-center">
      <p className="text-sm font-medium text-[var(--text-primary)]">
        {filtered ? "No tasks in this category" : "No tasks yet"}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {filtered
          ? "Choose another category to continue."
          : "Your list is clear."}
      </p>
    </div>
  );
}

export function TaskWorkspace({ data }: { readonly data: TaskWorkspaceData }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(ALL_TASKS);
  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );
  const taskCounts = useMemo(
    () => countTasksByCategory(data.tasks),
    [data.tasks],
  );
  const effectiveCategoryId =
    selectedCategoryId === ALL_TASKS || categoryById.has(selectedCategoryId)
      ? selectedCategoryId
      : ALL_TASKS;
  const visibleTasks = useMemo(
    () =>
      effectiveCategoryId === ALL_TASKS
        ? data.tasks
        : data.tasks.filter((task) => task.categoryId === effectiveCategoryId),
    [data.tasks, effectiveCategoryId],
  );
  const activeCategory =
    effectiveCategoryId === ALL_TASKS
      ? undefined
      : categoryById.get(effectiveCategoryId);

  return (
    <section
      aria-label="Tasks"
      className="grid min-h-0 grid-cols-[10.5rem_minmax(0,1fr)] max-[520px]:grid-cols-[8.5rem_minmax(0,1fr)]"
    >
      <nav
        aria-label="Task categories"
        className="min-h-0 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)] px-2 py-3"
      >
        <p className="px-2 pb-2 text-[0.6875rem] font-semibold uppercase text-[var(--text-faint)]">
          Tasks
        </p>
        <button
          aria-current={effectiveCategoryId === ALL_TASKS ? "page" : undefined}
          className="nav-item"
          onClick={() => setSelectedCategoryId(ALL_TASKS)}
          type="button"
        >
          <span className="truncate">All tasks</span>
          <span className="nav-count">{data.tasks.length}</span>
        </button>

        <p className="mt-5 px-2 pb-2 text-[0.6875rem] font-semibold uppercase text-[var(--text-faint)]">
          Categories
        </p>
        <ul className="space-y-0.5">
          {data.categories.map((category) => (
            <li key={category.id}>
              <button
                aria-current={
                  effectiveCategoryId === category.id ? "page" : undefined
                }
                className="nav-item"
                onClick={() => setSelectedCategoryId(category.id)}
                type="button"
              >
                <span className="truncate">{category.name}</span>
                <span className="nav-count">
                  {taskCounts.get(category.id) ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid min-h-0 grid-rows-[auto_1fr] bg-[var(--surface-raised)]">
        <header className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="truncate text-sm font-semibold">
            {activeCategory?.name ?? "All tasks"}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}
          </p>
        </header>
        <div className="min-h-0 overflow-y-auto">
          {visibleTasks.length === 0 ? (
            <EmptyTaskList filtered={effectiveCategoryId !== ALL_TASKS} />
          ) : (
            <ul aria-label="Task list">
              {visibleTasks.map((task) => (
                <TaskRow
                  category={categoryById.get(task.categoryId)}
                  key={task.id}
                  task={task}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
