import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  SmartSpaceCommandError,
  type CategoryDto,
  type CreateTaskInput,
  type SetTaskStatusInput,
  type TaskDto,
} from "../../lib/smartspace-client";
import type { TaskWorkspaceData } from "./workspace-loader";

const ALL_TASKS = "all";
const COMPLETED_TASKS = "completed";

function countTasksByCategory(tasks: readonly TaskDto[]) {
  const counts = new Map<string, number>();
  let completed = 0;

  for (const task of tasks) {
    counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1);
    if (task.status === "completed") {
      completed += 1;
    }
  }

  return { byCategory: counts, completed };
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

type TaskFeedback =
  { readonly kind: "error" | "success"; readonly message: string } | undefined;

function getSetTaskStatusErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "task_not_found") {
      return "This task is no longer available.";
    }

    if (error.code === "invalid_input") {
      return "Task status could not be changed.";
    }
  }

  return "Task could not be updated. Try again.";
}

const TaskRow = memo(function TaskRow({
  category,
  onSetTaskStatus,
  task,
}: {
  readonly category: CategoryDto | undefined;
  readonly onSetTaskStatus?: (input: SetTaskStatusInput) => Promise<TaskDto>;
  readonly task: TaskDto;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState<TaskFeedback>();
  const updatingRef = useRef(false);
  const isCompleted = task.status === "completed";
  const actionLabel = isCompleted
    ? `Reopen task: ${task.title}`
    : `Complete task: ${task.title}`;

  async function toggleStatus() {
    if (updatingRef.current || onSetTaskStatus === undefined) {
      return;
    }

    const status = isCompleted ? "open" : "completed";
    updatingRef.current = true;
    setIsUpdating(true);
    setFeedback(undefined);

    try {
      await onSetTaskStatus({ taskId: task.id, status });
      setFeedback({
        kind: "success",
        message: status === "completed" ? "Task completed." : "Task reopened.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getSetTaskStatusErrorMessage(error),
      });
    } finally {
      updatingRef.current = false;
      setIsUpdating(false);
    }
  }

  return (
    <li
      aria-busy={isUpdating ? "true" : undefined}
      className="task-row grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 last:border-b-0"
    >
      {onSetTaskStatus === undefined ? (
        <TaskStatusMark status={task.status} />
      ) : (
        <button
          aria-label={isUpdating ? `Updating task: ${task.title}` : actionLabel}
          aria-pressed={isCompleted}
          className="task-status-button"
          disabled={isUpdating}
          onClick={() => void toggleStatus()}
          title={isCompleted ? "Reopen task" : "Complete task"}
          type="button"
        />
      )}
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
        {feedback === undefined ? null : (
          <p
            className={
              feedback.kind === "error"
                ? "mt-1.5 text-[0.6875rem] text-[var(--status-danger)]"
                : "mt-1.5 text-[0.6875rem] text-[var(--status-success)]"
            }
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </li>
  );
});

function EmptyTaskList({
  view,
}: {
  readonly view: "all" | "category" | "completed";
}) {
  const title =
    view === "all"
      ? "No tasks yet"
      : view === "completed"
        ? "No completed tasks"
        : "No tasks in this category";
  const description =
    view === "all"
      ? "Your list is clear."
      : view === "completed"
        ? "Completed tasks will appear here."
        : "Choose another category to continue.";

  return (
    <div className="grid min-h-44 place-content-center px-6 text-center">
      <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

type CreateFeedback =
  { readonly kind: "error" | "success"; readonly message: string } | undefined;

function getCreateTaskErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "invalid_input") {
      return "Enter a valid task title.";
    }

    if (error.code === "category_not_found") {
      return "That category is no longer available.";
    }
  }

  return "Task could not be added. Try again.";
}

function QuickAddTask({
  categories,
  defaultCategoryId,
  onCreateTask,
}: {
  readonly categories: readonly CategoryDto[];
  readonly defaultCategoryId: string | undefined;
  readonly onCreateTask: (input: CreateTaskInput) => Promise<TaskDto>;
}) {
  const [title, setTitle] = useState("");
  const [categoryOverride, setCategoryOverride] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CreateFeedback>();
  const submittingRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const availableCategoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  );
  const selectedCategoryId =
    categoryOverride !== undefined && availableCategoryIds.has(categoryOverride)
      ? categoryOverride
      : defaultCategoryId;

  useEffect(() => {
    if (!isSubmitting && feedback?.kind === "success") {
      titleInputRef.current?.focus();
    }
  }, [feedback, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (title.trim().length === 0 || selectedCategoryId === undefined) {
      setFeedback({ kind: "error", message: "Enter a task title." });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setFeedback(undefined);

    try {
      await onCreateTask({ title, categoryId: selectedCategoryId });
      setTitle("");
      setCategoryOverride(undefined);
      setFeedback({ kind: "success", message: "Task added." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getCreateTaskErrorMessage(error),
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const cannotSubmit =
    isSubmitting ||
    title.trim().length === 0 ||
    selectedCategoryId === undefined;

  return (
    <form
      aria-label="Add task"
      className="quick-task-form border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-3"
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="quick-task-title">
        Task title
      </label>
      <input
        className="quick-task-input"
        disabled={isSubmitting}
        id="quick-task-title"
        onChange={(event) => {
          setTitle(event.target.value);
          if (feedback?.kind === "error") {
            setFeedback(undefined);
          }
        }}
        placeholder="Task title"
        ref={titleInputRef}
        type="text"
        value={title}
      />
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <label className="sr-only" htmlFor="quick-task-category">
          Task category
        </label>
        <select
          className="quick-task-select min-w-0"
          disabled={isSubmitting || categories.length === 0}
          id="quick-task-category"
          onChange={(event) => setCategoryOverride(event.target.value)}
          value={selectedCategoryId ?? ""}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          className="quick-task-submit"
          disabled={cannotSubmit}
          type="submit"
        >
          {isSubmitting ? "Adding..." : "Add task"}
        </button>
      </div>
      <div className="min-h-5 pt-1.5">
        {feedback === undefined ? null : (
          <p
            className={
              feedback.kind === "error"
                ? "text-[0.6875rem] text-[var(--status-danger)]"
                : "text-[0.6875rem] text-[var(--status-success)]"
            }
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </form>
  );
}

export function TaskWorkspace({
  data,
  onCreateTask,
  onSetTaskStatus,
}: {
  readonly data: TaskWorkspaceData;
  readonly onCreateTask?: (input: CreateTaskInput) => Promise<TaskDto>;
  readonly onSetTaskStatus?: (input: SetTaskStatusInput) => Promise<TaskDto>;
}) {
  const [selectedViewId, setSelectedViewId] = useState(ALL_TASKS);
  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );
  const taskCounts = useMemo(
    () => countTasksByCategory(data.tasks),
    [data.tasks],
  );
  const effectiveViewId =
    selectedViewId === ALL_TASKS ||
    selectedViewId === COMPLETED_TASKS ||
    categoryById.has(selectedViewId)
      ? selectedViewId
      : ALL_TASKS;
  const visibleTasks = useMemo(() => {
    if (effectiveViewId === ALL_TASKS) {
      return data.tasks;
    }

    if (effectiveViewId === COMPLETED_TASKS) {
      return data.tasks.filter((task) => task.status === "completed");
    }

    return data.tasks.filter((task) => task.categoryId === effectiveViewId);
  }, [data.tasks, effectiveViewId]);
  const activeCategory =
    effectiveViewId === ALL_TASKS || effectiveViewId === COMPLETED_TASKS
      ? undefined
      : categoryById.get(effectiveViewId);
  const inboxCategory = data.categories.find(
    (category) => category.kind === "inbox",
  );
  const defaultCreateCategoryId = activeCategory?.id ?? inboxCategory?.id;
  const viewTitle =
    effectiveViewId === COMPLETED_TASKS
      ? "Completed"
      : (activeCategory?.name ?? "All tasks");
  const emptyView =
    effectiveViewId === ALL_TASKS
      ? "all"
      : effectiveViewId === COMPLETED_TASKS
        ? "completed"
        : "category";

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
          aria-current={effectiveViewId === ALL_TASKS ? "page" : undefined}
          className="nav-item"
          onClick={() => setSelectedViewId(ALL_TASKS)}
          type="button"
        >
          <span className="truncate">All tasks</span>
          <span className="nav-count">{data.tasks.length}</span>
        </button>
        <button
          aria-current={
            effectiveViewId === COMPLETED_TASKS ? "page" : undefined
          }
          className="nav-item"
          onClick={() => setSelectedViewId(COMPLETED_TASKS)}
          type="button"
        >
          <span className="truncate">Completed</span>
          <span className="nav-count">{taskCounts.completed}</span>
        </button>

        <p className="mt-5 px-2 pb-2 text-[0.6875rem] font-semibold uppercase text-[var(--text-faint)]">
          Categories
        </p>
        <ul className="space-y-0.5">
          {data.categories.map((category) => (
            <li key={category.id}>
              <button
                aria-current={
                  effectiveViewId === category.id ? "page" : undefined
                }
                className="nav-item"
                onClick={() => setSelectedViewId(category.id)}
                type="button"
              >
                <span className="truncate">{category.name}</span>
                <span className="nav-count">
                  {taskCounts.byCategory.get(category.id) ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="grid min-h-0 grid-rows-[auto_auto_1fr] bg-[var(--surface-raised)]">
        <header className="border-b border-[var(--border-subtle)] px-4 py-3">
          <h2 className="truncate text-sm font-semibold">{viewTitle}</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}
          </p>
        </header>
        {onCreateTask === undefined ? null : (
          <QuickAddTask
            categories={data.categories}
            defaultCategoryId={defaultCreateCategoryId}
            onCreateTask={onCreateTask}
          />
        )}
        <div className="min-h-0 overflow-y-auto">
          {visibleTasks.length === 0 ? (
            <EmptyTaskList view={emptyView} />
          ) : (
            <ul aria-label="Task list">
              {visibleTasks.map((task) => (
                <TaskRow
                  category={categoryById.get(task.categoryId)}
                  key={task.id}
                  onSetTaskStatus={onSetTaskStatus}
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
