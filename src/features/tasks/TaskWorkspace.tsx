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
  type CreateCategoryInput,
  type CreateTaskInput,
  type MoveTaskInput,
  type RenameTaskInput,
  type SetTaskDueDateInput,
  type SetTaskStatusInput,
  type TaskDto,
} from "../../lib/smartspace-client";
import type { TaskWorkspaceData } from "./workspace-loader";

const ALL_TASKS = "all";
const COMPLETED_TASKS = "completed";
const TODAY_TASKS = "today";

function getLocalCalendarDate(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMillisecondsUntilNextLocalDay(date = new Date()) {
  const nextDay = new Date(date);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1, nextDay.getTime() - date.getTime());
}

function useLocalCalendarDate() {
  const [today, setToday] = useState(getLocalCalendarDate);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setToday(getLocalCalendarDate());
    }, getMillisecondsUntilNextLocalDay());

    return () => window.clearTimeout(timeout);
  }, [today]);

  return today;
}

function countTasksByCategory(tasks: readonly TaskDto[], today: string) {
  const counts = new Map<string, number>();
  let completed = 0;
  let dueToday = 0;

  for (const task of tasks) {
    counts.set(task.categoryId, (counts.get(task.categoryId) ?? 0) + 1);
    if (task.dueDate === today) {
      dueToday += 1;
    }
    if (task.status === "completed") {
      completed += 1;
    }
  }

  return { byCategory: counts, completed, dueToday };
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

function getSetTaskDueDateErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "task_not_found") {
      return "This task is no longer available.";
    }

    if (error.code === "invalid_input") {
      return "Enter a valid due date.";
    }
  }

  return "Due date could not be updated. Try again.";
}

function getMoveTaskErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "task_not_found") {
      return "This task is no longer available.";
    }

    if (error.code === "category_not_found") {
      return "That category is no longer available.";
    }

    if (error.code === "invalid_input") {
      return "Task could not be moved.";
    }
  }

  return "Task could not be moved. Try again.";
}

function getRenameTaskErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "task_not_found") {
      return "This task is no longer available.";
    }

    if (error.code === "invalid_input") {
      return "Enter a valid task title.";
    }
  }

  return "Task title could not be updated. Try again.";
}

const TaskRow = memo(function TaskRow({
  categories,
  category,
  isOverdue,
  onMoveTask,
  onRenameTask,
  onSetTaskDueDate,
  onSetTaskStatus,
  task,
}: {
  readonly categories: readonly CategoryDto[];
  readonly category: CategoryDto | undefined;
  readonly isOverdue: boolean;
  readonly onMoveTask?: (input: MoveTaskInput) => Promise<TaskDto>;
  readonly onRenameTask?: (input: RenameTaskInput) => Promise<TaskDto>;
  readonly onSetTaskDueDate?: (input: SetTaskDueDateInput) => Promise<TaskDto>;
  readonly onSetTaskStatus?: (input: SetTaskStatusInput) => Promise<TaskDto>;
  readonly task: TaskDto;
}) {
  const [pendingAction, setPendingAction] = useState<
    "category" | "due-date" | "status" | "title"
  >();
  const [feedback, setFeedback] = useState<TaskFeedback>();
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState(task.categoryId);
  const [dueDateDraft, setDueDateDraft] = useState(task.dueDate ?? "");
  const [titleDraft, setTitleDraft] = useState(task.title);
  const updatingRef = useRef(false);
  const categorySelectRef = useRef<HTMLSelectElement>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const dueDateTriggerRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleTriggerRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreCategoryFocusRef = useRef(false);
  const shouldRestoreDueDateFocusRef = useRef(false);
  const shouldRestoreTitleFocusRef = useRef(false);
  const isCompleted = task.status === "completed";
  const isUpdating = pendingAction !== undefined;
  const actionLabel = isCompleted
    ? `Reopen task: ${task.title}`
    : `Complete task: ${task.title}`;

  useEffect(() => {
    if (isEditingCategory) {
      categorySelectRef.current?.focus();
    } else if (shouldRestoreCategoryFocusRef.current) {
      shouldRestoreCategoryFocusRef.current = false;
      categoryTriggerRef.current?.focus();
    }
  }, [isEditingCategory]);

  useEffect(() => {
    if (isEditingDueDate) {
      dueDateInputRef.current?.focus();
    } else if (shouldRestoreDueDateFocusRef.current) {
      shouldRestoreDueDateFocusRef.current = false;
      dueDateTriggerRef.current?.focus();
    }
  }, [isEditingDueDate]);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    } else if (shouldRestoreTitleFocusRef.current) {
      shouldRestoreTitleFocusRef.current = false;
      titleTriggerRef.current?.focus();
    }
  }, [isEditingTitle]);

  function closeTitleEditor() {
    if (updatingRef.current) {
      return;
    }

    setTitleDraft(task.title);
    setFeedback(undefined);
    shouldRestoreTitleFocusRef.current = true;
    setIsEditingTitle(false);
  }

  async function updateTitle(title: string) {
    if (updatingRef.current || onRenameTask === undefined) {
      return;
    }

    updatingRef.current = true;
    setPendingAction("title");
    setFeedback(undefined);

    try {
      const updatedTask = await onRenameTask({ taskId: task.id, title });
      setTitleDraft(updatedTask.title);
      shouldRestoreTitleFocusRef.current = true;
      setIsEditingTitle(false);
      setFeedback({ kind: "success", message: "Task renamed." });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getRenameTaskErrorMessage(error),
      });
    } finally {
      updatingRef.current = false;
      setPendingAction(undefined);
    }
  }

  function submitTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = titleDraft.trim();
    if (normalizedTitle.length > 0 && normalizedTitle !== task.title) {
      void updateTitle(titleDraft);
    }
  }

  function closeCategoryEditor() {
    if (updatingRef.current) {
      return;
    }

    setCategoryDraft(task.categoryId);
    setFeedback(undefined);
    shouldRestoreCategoryFocusRef.current = true;
    setIsEditingCategory(false);
  }

  async function updateCategory(categoryId: string) {
    if (updatingRef.current || onMoveTask === undefined) {
      return;
    }

    updatingRef.current = true;
    setPendingAction("category");
    setFeedback(undefined);

    try {
      const updatedTask = await onMoveTask({ taskId: task.id, categoryId });
      const targetCategory = categories.find(
        (candidate) => candidate.id === updatedTask.categoryId,
      );
      setCategoryDraft(updatedTask.categoryId);
      shouldRestoreCategoryFocusRef.current = true;
      setIsEditingCategory(false);
      setFeedback({
        kind: "success",
        message: `Task moved to ${targetCategory?.name ?? "another category"}.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getMoveTaskErrorMessage(error),
      });
    } finally {
      updatingRef.current = false;
      setPendingAction(undefined);
    }
  }

  function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryDraft !== task.categoryId) {
      void updateCategory(categoryDraft);
    }
  }

  function closeDueDateEditor() {
    if (updatingRef.current) {
      return;
    }

    setDueDateDraft(task.dueDate ?? "");
    setFeedback(undefined);
    shouldRestoreDueDateFocusRef.current = true;
    setIsEditingDueDate(false);
  }

  async function updateDueDate(dueDate: string | null) {
    if (updatingRef.current || onSetTaskDueDate === undefined) {
      return;
    }

    updatingRef.current = true;
    setPendingAction("due-date");
    setFeedback(undefined);

    try {
      await onSetTaskDueDate({ taskId: task.id, dueDate });
      shouldRestoreDueDateFocusRef.current = true;
      setIsEditingDueDate(false);
      setFeedback({
        kind: "success",
        message: dueDate === null ? "Due date cleared." : "Due date updated.",
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getSetTaskDueDateErrorMessage(error),
      });
    } finally {
      updatingRef.current = false;
      setPendingAction(undefined);
    }
  }

  function submitDueDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dueDateDraft.length > 0) {
      void updateDueDate(dueDateDraft);
    }
  }

  async function toggleStatus() {
    if (updatingRef.current || onSetTaskStatus === undefined) {
      return;
    }

    const status = isCompleted ? "open" : "completed";
    updatingRef.current = true;
    setPendingAction("status");
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
      setPendingAction(undefined);
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
      <div className="task-row-content min-w-0">
        {onRenameTask === undefined ? (
          <p
            className={
              task.status === "completed"
                ? "break-words text-sm leading-5 text-[var(--text-muted)] line-through"
                : "break-words text-sm leading-5 text-[var(--text-primary)]"
            }
          >
            {task.title}
          </p>
        ) : (
          <button
            aria-expanded={isEditingTitle}
            aria-label={`Edit title for task: ${task.title}`}
            className={
              task.status === "completed"
                ? "task-title-trigger task-title-trigger-completed line-through"
                : "task-title-trigger"
            }
            disabled={isUpdating}
            onClick={() => {
              setTitleDraft(task.title);
              setFeedback(undefined);
              setIsEditingCategory(false);
              setIsEditingDueDate(false);
              setIsEditingTitle(true);
            }}
            ref={titleTriggerRef}
            title="Rename task"
            type="button"
          >
            {task.title}
          </button>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-[var(--text-muted)]">
          {onMoveTask === undefined ||
          category === undefined ||
          categories.length < 2 ? (
            <span>{category?.name ?? "Unknown category"}</span>
          ) : (
            <button
              aria-expanded={isEditingCategory}
              aria-label={`Edit category for task: ${task.title}`}
              className="task-category-trigger"
              disabled={isUpdating}
              onClick={() => {
                setCategoryDraft(task.categoryId);
                setFeedback(undefined);
                setIsEditingDueDate(false);
                setIsEditingTitle(false);
                setIsEditingCategory(true);
              }}
              ref={categoryTriggerRef}
              title="Move task"
              type="button"
            >
              {category.name}
            </button>
          )}
          {onSetTaskDueDate === undefined ? (
            task.dueDate === null ? null : (
              <span
                className={
                  isOverdue ? "text-[var(--status-danger)]" : undefined
                }
              >
                Due {task.dueDate}
              </span>
            )
          ) : (
            <button
              aria-expanded={isEditingDueDate}
              aria-label={`Edit due date for task: ${task.title}`}
              className={
                isOverdue
                  ? "task-due-date-trigger task-due-date-trigger-status-danger"
                  : "task-due-date-trigger"
              }
              disabled={isUpdating}
              onClick={() => {
                setDueDateDraft(task.dueDate ?? "");
                setFeedback(undefined);
                setIsEditingCategory(false);
                setIsEditingTitle(false);
                setIsEditingDueDate(true);
              }}
              ref={dueDateTriggerRef}
              title="Edit due date"
              type="button"
            >
              {task.dueDate === null ? "Add due date" : `Due ${task.dueDate}`}
            </button>
          )}
          {isOverdue ? <span className="overdue-label">Overdue</span> : null}
        </div>
        {isEditingTitle ? (
          <form
            aria-label={`Edit title for task: ${task.title}`}
            className="task-title-form"
            onSubmit={submitTitle}
          >
            <label className="sr-only" htmlFor={`task-title-${task.id}`}>
              Title for {task.title}
            </label>
            <input
              className="task-title-input"
              disabled={isUpdating}
              id={`task-title-${task.id}`}
              onChange={(event) => {
                setTitleDraft(event.target.value);
                if (feedback?.kind === "error") {
                  setFeedback(undefined);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeTitleEditor();
                }
              }}
              ref={titleInputRef}
              type="text"
              value={titleDraft}
            />
            <button
              aria-label={`Save title for task: ${task.title}`}
              className="task-title-save"
              disabled={
                isUpdating ||
                titleDraft.trim().length === 0 ||
                titleDraft.trim() === task.title
              }
              type="submit"
            >
              {pendingAction === "title" ? "Saving..." : "Save"}
            </button>
            <button
              aria-label={`Cancel title edit for task: ${task.title}`}
              className="task-title-cancel"
              disabled={isUpdating}
              onClick={closeTitleEditor}
              type="button"
            >
              Cancel
            </button>
          </form>
        ) : null}
        {isEditingCategory ? (
          <form
            aria-label={`Edit category for task: ${task.title}`}
            className="task-category-form"
            onSubmit={submitCategory}
          >
            <label className="sr-only" htmlFor={`task-category-${task.id}`}>
              Category for {task.title}
            </label>
            <select
              className="task-category-select"
              disabled={isUpdating}
              id={`task-category-${task.id}`}
              onChange={(event) => {
                setCategoryDraft(event.target.value);
                if (feedback?.kind === "error") {
                  setFeedback(undefined);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeCategoryEditor();
                }
              }}
              ref={categorySelectRef}
              value={categoryDraft}
            >
              {categories.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <button
              aria-label={`Move task: ${task.title}`}
              className="task-category-save"
              disabled={isUpdating || categoryDraft === task.categoryId}
              type="submit"
            >
              {pendingAction === "category" ? "Moving..." : "Move"}
            </button>
            <button
              aria-label={`Cancel category edit for task: ${task.title}`}
              className="task-category-cancel"
              disabled={isUpdating}
              onClick={closeCategoryEditor}
              type="button"
            >
              Cancel
            </button>
          </form>
        ) : null}
        {isEditingDueDate ? (
          <form
            aria-label={`Edit due date for task: ${task.title}`}
            className="task-due-date-form"
            onSubmit={submitDueDate}
          >
            <label className="sr-only" htmlFor={`task-due-date-${task.id}`}>
              Due date for {task.title}
            </label>
            <input
              className="task-due-date-input"
              disabled={isUpdating}
              id={`task-due-date-${task.id}`}
              onChange={(event) => {
                setDueDateDraft(event.target.value);
                if (feedback?.kind === "error") {
                  setFeedback(undefined);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeDueDateEditor();
                }
              }}
              ref={dueDateInputRef}
              type="date"
              value={dueDateDraft}
            />
            <button
              className="task-due-date-save"
              disabled={isUpdating || dueDateDraft.length === 0}
              type="submit"
            >
              {pendingAction === "due-date" ? "Saving..." : "Save"}
            </button>
            <button
              className="task-due-date-clear"
              disabled={isUpdating || task.dueDate === null}
              onClick={() => void updateDueDate(null)}
              type="button"
            >
              Clear
            </button>
            <button
              className="task-due-date-cancel"
              disabled={isUpdating}
              onClick={closeDueDateEditor}
              type="button"
            >
              Cancel
            </button>
          </form>
        ) : null}
        {feedback === undefined ? null : (
          <p
            className={
              feedback.kind === "error"
                ? "task-feedback mt-1.5 text-[0.6875rem] text-[var(--status-danger)]"
                : "task-feedback mt-1.5 text-[0.6875rem] text-[var(--status-success)]"
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
  readonly view: "all" | "category" | "completed" | "today";
}) {
  const title =
    view === "all"
      ? "No tasks yet"
      : view === "today"
        ? "No tasks due today"
        : view === "completed"
          ? "No completed tasks"
          : "No tasks in this category";
  const description =
    view === "all"
      ? "Your list is clear."
      : view === "today"
        ? "Tasks due today will appear here."
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

function getCreateCategoryErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "invalid_input") {
      return "Enter a valid category name.";
    }

    if (error.code === "duplicate_category_name") {
      return "A category with this name already exists.";
    }
  }

  return "Category could not be added. Try again.";
}

function CreateCategory({
  onCreateCategory,
}: {
  readonly onCreateCategory: (
    input: CreateCategoryInput,
  ) => Promise<CategoryDto>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CreateFeedback>();
  const submittingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else if (shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  function closeForm() {
    if (submittingRef.current) {
      return;
    }

    shouldRestoreFocusRef.current = true;
    setName("");
    setFeedback(undefined);
    setIsOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (name.trim().length === 0) {
      setFeedback({
        kind: "error",
        message: "Enter a category name.",
      });
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setFeedback(undefined);

    try {
      await onCreateCategory({ name });
      shouldRestoreFocusRef.current = true;
      setName("");
      setFeedback({ kind: "success", message: "Category added." });
      setIsOpen(false);
    } catch (error) {
      setFeedback({
        kind: "error",
        message: getCreateCategoryErrorMessage(error),
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="category-creator">
      <div className="flex items-center justify-between gap-1 px-2 pb-2">
        <p className="min-w-0 text-[0.6875rem] font-semibold uppercase text-[var(--text-faint)]">
          Categories
        </p>
        <button
          aria-controls="create-category-form"
          aria-expanded={isOpen}
          aria-label="Add category"
          className="category-add-trigger"
          onClick={() => {
            setFeedback(undefined);
            setIsOpen(true);
          }}
          ref={triggerRef}
          title="Add category"
          type="button"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {isOpen ? (
        <form
          aria-label="Add category"
          className="category-create-form"
          id="create-category-form"
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="create-category-name">
            Category name
          </label>
          <input
            className="category-name-input"
            disabled={isSubmitting}
            id="create-category-name"
            onChange={(event) => {
              setName(event.target.value);
              if (feedback?.kind === "error") {
                setFeedback(undefined);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeForm();
              }
            }}
            placeholder="Category name"
            ref={inputRef}
            type="text"
            value={name}
          />
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <button
              className="category-create-submit"
              disabled={isSubmitting || name.trim().length === 0}
              type="submit"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
            <button
              className="category-create-cancel"
              disabled={isSubmitting}
              onClick={closeForm}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {feedback === undefined ? null : (
        <p
          className={
            feedback.kind === "error"
              ? "category-create-feedback text-[var(--status-danger)]"
              : "category-create-feedback text-[var(--status-success)]"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}

export function TaskWorkspace({
  data,
  onCreateCategory,
  onCreateTask,
  onMoveTask,
  onRenameTask,
  onSetTaskDueDate,
  onSetTaskStatus,
}: {
  readonly data: TaskWorkspaceData;
  readonly onCreateCategory?: (
    input: CreateCategoryInput,
  ) => Promise<CategoryDto>;
  readonly onCreateTask?: (input: CreateTaskInput) => Promise<TaskDto>;
  readonly onMoveTask?: (input: MoveTaskInput) => Promise<TaskDto>;
  readonly onRenameTask?: (input: RenameTaskInput) => Promise<TaskDto>;
  readonly onSetTaskDueDate?: (input: SetTaskDueDateInput) => Promise<TaskDto>;
  readonly onSetTaskStatus?: (input: SetTaskStatusInput) => Promise<TaskDto>;
}) {
  const [selectedViewId, setSelectedViewId] = useState(ALL_TASKS);
  const [viewHeadingFocusVersion, setViewHeadingFocusVersion] = useState(0);
  const today = useLocalCalendarDate();
  const viewHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingViewHeadingFocusRef = useRef<
    { readonly taskId: string; readonly viewId: string } | undefined
  >(undefined);
  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  );
  const taskCounts = useMemo(
    () => countTasksByCategory(data.tasks, today),
    [data.tasks, today],
  );
  const effectiveViewId =
    selectedViewId === ALL_TASKS ||
    selectedViewId === COMPLETED_TASKS ||
    selectedViewId === TODAY_TASKS ||
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

    if (effectiveViewId === TODAY_TASKS) {
      return data.tasks.filter((task) => task.dueDate === today);
    }

    return data.tasks.filter((task) => task.categoryId === effectiveViewId);
  }, [data.tasks, effectiveViewId, today]);
  const setTaskDueDateForCurrentView = useMemo(() => {
    if (onSetTaskDueDate === undefined) {
      return undefined;
    }

    return async (input: SetTaskDueDateInput) => {
      const updatedTask = await onSetTaskDueDate(input);
      if (effectiveViewId === TODAY_TASKS && updatedTask.dueDate !== today) {
        pendingViewHeadingFocusRef.current = {
          taskId: updatedTask.id,
          viewId: effectiveViewId,
        };
        setViewHeadingFocusVersion((version) => version + 1);
      }
      return updatedTask;
    };
  }, [effectiveViewId, onSetTaskDueDate, today]);
  const moveTaskForCurrentView = useMemo(() => {
    if (onMoveTask === undefined) {
      return undefined;
    }

    return async (input: MoveTaskInput) => {
      const updatedTask = await onMoveTask(input);
      if (
        effectiveViewId !== ALL_TASKS &&
        effectiveViewId !== COMPLETED_TASKS &&
        effectiveViewId !== TODAY_TASKS &&
        updatedTask.categoryId !== effectiveViewId
      ) {
        pendingViewHeadingFocusRef.current = {
          taskId: updatedTask.id,
          viewId: effectiveViewId,
        };
        setViewHeadingFocusVersion((version) => version + 1);
      }
      return updatedTask;
    };
  }, [effectiveViewId, onMoveTask]);

  useEffect(() => {
    const pendingFocus = pendingViewHeadingFocusRef.current;
    if (pendingFocus === undefined) {
      return;
    }

    if (pendingFocus.viewId !== effectiveViewId) {
      pendingViewHeadingFocusRef.current = undefined;
      return;
    }

    if (!visibleTasks.some((task) => task.id === pendingFocus.taskId)) {
      pendingViewHeadingFocusRef.current = undefined;
      viewHeadingRef.current?.focus();
    }
  }, [effectiveViewId, viewHeadingFocusVersion, visibleTasks]);
  const activeCategory =
    effectiveViewId === ALL_TASKS ||
    effectiveViewId === COMPLETED_TASKS ||
    effectiveViewId === TODAY_TASKS
      ? undefined
      : categoryById.get(effectiveViewId);
  const inboxCategory = data.categories.find(
    (category) => category.kind === "inbox",
  );
  const defaultCreateCategoryId = activeCategory?.id ?? inboxCategory?.id;
  const viewTitle =
    effectiveViewId === TODAY_TASKS
      ? "Today"
      : effectiveViewId === COMPLETED_TASKS
        ? "Completed"
        : (activeCategory?.name ?? "All tasks");
  const emptyView =
    effectiveViewId === ALL_TASKS
      ? "all"
      : effectiveViewId === TODAY_TASKS
        ? "today"
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
          aria-current={effectiveViewId === TODAY_TASKS ? "page" : undefined}
          className="nav-item"
          onClick={() => setSelectedViewId(TODAY_TASKS)}
          type="button"
        >
          <span className="truncate">Today</span>
          <span className="nav-count">{taskCounts.dueToday}</span>
        </button>
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

        <div className="mt-5">
          {onCreateCategory === undefined ? (
            <p className="px-2 pb-2 text-[0.6875rem] font-semibold uppercase text-[var(--text-faint)]">
              Categories
            </p>
          ) : (
            <CreateCategory onCreateCategory={onCreateCategory} />
          )}
        </div>
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
          <h2
            className="truncate text-sm font-semibold"
            ref={viewHeadingRef}
            tabIndex={-1}
          >
            {viewTitle}
          </h2>
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
                  categories={data.categories}
                  category={categoryById.get(task.categoryId)}
                  isOverdue={
                    task.status === "open" &&
                    task.dueDate !== null &&
                    task.dueDate < today
                  }
                  key={task.id}
                  onMoveTask={moveTaskForCurrentView}
                  onRenameTask={onRenameTask}
                  onSetTaskDueDate={setTaskDueDateForCurrentView}
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
