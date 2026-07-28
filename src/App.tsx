import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { TaskWorkspace } from "./features/tasks/TaskWorkspace";
import {
  loadTaskWorkspace,
  type TaskWorkspaceData,
} from "./features/tasks/workspace-loader";
import { APP_NAME } from "./lib/app-meta";
import {
  SmartSpaceCommandError,
  smartSpaceClient,
  type CategoryDto,
  type CreateCategoryInput,
  type CreateTaskInput,
  type DeleteCategoryInput,
  type DeleteCategoryResultDto,
  type MoveTaskInput,
  type RenameCategoryInput,
  type RenameTaskInput,
  type ReorderCategoriesInput,
  type SetTaskDueDateInput,
  type SetTaskStatusInput,
  type SmartSpaceClient,
  type TaskDto,
} from "./lib/smartspace-client";

export type WorkspaceState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: TaskWorkspaceData }
  | { readonly status: "error"; readonly message: string };

const clientKeys = new WeakMap<SmartSpaceClient, number>();
let nextClientKey = 0;

function getClientKey(client: SmartSpaceClient) {
  const existingKey = clientKeys.get(client);
  if (existingKey !== undefined) {
    return existingKey;
  }

  nextClientKey += 1;
  clientKeys.set(client, nextClientKey);
  return nextClientKey;
}

function getWorkspaceErrorMessage(error: unknown) {
  if (error instanceof SmartSpaceCommandError) {
    if (error.code === "data_corrupt") {
      return "Your local task data could not be read.";
    }

    if (
      error.code === "database_unavailable" ||
      error.code === "database_operation_failed"
    ) {
      return "SmartSpace could not open your local task data.";
    }
  }

  return "SmartSpace could not load your tasks.";
}

function insertTaskInStorageOrder(
  data: TaskWorkspaceData,
  createdTask: TaskDto,
): TaskWorkspaceData {
  if (
    !data.categories.some((category) => category.id === createdTask.categoryId)
  ) {
    return data;
  }

  return {
    ...data,
    tasks: sortTasksInStorageOrder(data.categories, [
      ...data.tasks,
      createdTask,
    ]),
  };
}

function sortTasksInStorageOrder(
  categories: readonly CategoryDto[],
  tasks: readonly TaskDto[],
) {
  const categoryPositions = new Map(
    categories.map((category) => [category.id, category.position]),
  );
  return [...tasks].sort((left, right) => {
    const categoryDifference =
      (categoryPositions.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER) -
      (categoryPositions.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER);

    return categoryDifference || left.position - right.position;
  });
}

function moveTaskInStorageOrder(
  data: TaskWorkspaceData,
  taskId: string,
  updatedTask: TaskDto,
): TaskWorkspaceData {
  const existingTask = data.tasks.find((task) => task.id === taskId);
  if (
    existingTask === undefined ||
    !data.categories.some((category) => category.id === updatedTask.categoryId)
  ) {
    return data;
  }

  if (existingTask.categoryId === updatedTask.categoryId) {
    return replaceTask(data, taskId, updatedTask);
  }

  const remainingTasks = data.tasks.filter((task) => task.id !== taskId);
  const sourceTasks = remainingTasks
    .filter((task) => task.categoryId === existingTask.categoryId)
    .map((task, position) =>
      task.position === position ? task : { ...task, position },
    );
  const targetTasks = remainingTasks.filter(
    (task) => task.categoryId === updatedTask.categoryId,
  );
  const targetPosition = Math.max(
    0,
    Math.min(updatedTask.position, targetTasks.length),
  );
  targetTasks.splice(targetPosition, 0, updatedTask);
  const positionedTargetTasks = targetTasks.map((task, position) =>
    task.position === position ? task : { ...task, position },
  );
  const unaffectedTasks = remainingTasks.filter(
    (task) =>
      task.categoryId !== existingTask.categoryId &&
      task.categoryId !== updatedTask.categoryId,
  );

  return {
    ...data,
    tasks: sortTasksInStorageOrder(data.categories, [
      ...unaffectedTasks,
      ...sourceTasks,
      ...positionedTargetTasks,
    ]),
  };
}

function insertCategoryInStorageOrder(
  data: TaskWorkspaceData,
  createdCategory: CategoryDto,
): TaskWorkspaceData {
  const categories = [...data.categories];
  const insertionIndex = Math.max(
    0,
    Math.min(createdCategory.position, categories.length),
  );
  categories.splice(insertionIndex, 0, createdCategory);

  return { ...data, categories };
}

function replaceTask(
  data: TaskWorkspaceData,
  taskId: string,
  updatedTask: TaskDto,
): TaskWorkspaceData {
  if (
    !data.categories.some((category) => category.id === updatedTask.categoryId)
  ) {
    return data;
  }

  return {
    ...data,
    tasks: data.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
  };
}

function replaceCategory(
  data: TaskWorkspaceData,
  categoryId: string,
  updatedCategory: CategoryDto,
): TaskWorkspaceData {
  return {
    ...data,
    categories: data.categories.map((category) =>
      category.id === categoryId ? updatedCategory : category,
    ),
  };
}

function replaceCategoriesInStorageOrder(
  data: TaskWorkspaceData,
  categories: readonly CategoryDto[],
): TaskWorkspaceData {
  return {
    ...data,
    categories,
    tasks: sortTasksInStorageOrder(categories, data.tasks),
  };
}

function replaceWorkspaceAfterCategoryDeletion(
  result: DeleteCategoryResultDto,
): TaskWorkspaceData {
  return {
    categories: result.categories,
    tasks: result.tasks,
  };
}

function TaskLoadingState({
  regionRef,
}: {
  readonly regionRef?: Ref<HTMLElement>;
}) {
  return (
    <section
      aria-busy="true"
      aria-label="Loading tasks"
      className="grid min-h-0 grid-cols-[10.5rem_minmax(0,1fr)] max-[520px]:grid-cols-[8.5rem_minmax(0,1fr)]"
      ref={regionRef}
      role="status"
      tabIndex={-1}
    >
      <div className="border-r border-[var(--border-subtle)] bg-[var(--surface-sidebar)] p-3">
        <div className="skeleton-line w-14" />
        <div className="skeleton-line mt-5 w-full" />
        <div className="skeleton-line mt-3 w-4/5" />
      </div>
      <div className="bg-[var(--surface-raised)] p-4">
        <div className="skeleton-line w-24" />
        <div className="skeleton-line mt-7 h-4 w-3/4" />
        <div className="skeleton-line mt-5 h-4 w-1/2" />
      </div>
      <span className="sr-only">Loading your workspace</span>
    </section>
  );
}

function TaskErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) {
  return (
    <section
      aria-label="Task loading error"
      className="grid min-h-0 place-content-center bg-[var(--surface-raised)] px-6 text-center"
      role="alert"
    >
      <p className="text-sm font-semibold">Tasks unavailable</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--text-muted)]">
        {message}
      </p>
      <button
        className="retry-button mx-auto mt-4"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}

function ApplicationWorkspace() {
  return (
    <section
      aria-label="Application workspace"
      className="grid min-h-0 grid-rows-[auto_1fr] bg-[var(--surface-app)]"
    >
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4">
        <h2 className="truncate text-sm font-semibold">Applications</h2>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">
          0 open
        </span>
      </header>
      <div className="grid min-h-0 place-content-center px-6 text-center">
        <div
          aria-hidden="true"
          className="mx-auto grid size-10 place-content-center border border-[var(--border-strong)] bg-[var(--surface-raised)] text-xs font-bold text-[var(--text-muted)]"
        >
          APP
        </div>
        <p className="mt-3 text-sm font-medium">No app open</p>
      </div>
    </section>
  );
}

export function WorkspaceBody({
  workspace,
  onRetry,
  onCreateCategory,
  onCreateTask,
  onDeleteCategory,
  onMoveTask,
  onRenameCategory,
  onRenameTask,
  onReorderCategories,
  onSetTaskDueDate,
  onSetTaskStatus,
  loadingRegionRef,
}: {
  readonly workspace: WorkspaceState;
  readonly onRetry: () => void;
  readonly onCreateCategory?: (
    input: CreateCategoryInput,
  ) => Promise<CategoryDto>;
  readonly onCreateTask?: (input: CreateTaskInput) => Promise<TaskDto>;
  readonly onDeleteCategory?: (
    input: DeleteCategoryInput,
  ) => Promise<DeleteCategoryResultDto>;
  readonly onMoveTask?: (input: MoveTaskInput) => Promise<TaskDto>;
  readonly onRenameCategory?: (
    input: RenameCategoryInput,
  ) => Promise<CategoryDto>;
  readonly onRenameTask?: (input: RenameTaskInput) => Promise<TaskDto>;
  readonly onReorderCategories?: (
    input: ReorderCategoriesInput,
  ) => Promise<readonly CategoryDto[]>;
  readonly onSetTaskDueDate?: (input: SetTaskDueDateInput) => Promise<TaskDto>;
  readonly onSetTaskStatus?: (input: SetTaskStatusInput) => Promise<TaskDto>;
  readonly loadingRegionRef?: Ref<HTMLElement>;
}) {
  return (
    <div className="workspace-grid grid min-h-0 grid-cols-[minmax(24rem,0.9fr)_minmax(26rem,1.1fr)]">
      {workspace.status === "loading" ? (
        <TaskLoadingState regionRef={loadingRegionRef} />
      ) : null}
      {workspace.status === "error" ? (
        <TaskErrorState message={workspace.message} onRetry={onRetry} />
      ) : null}
      {workspace.status === "ready" ? (
        <TaskWorkspace
          data={workspace.data}
          onCreateCategory={onCreateCategory}
          onCreateTask={onCreateTask}
          onDeleteCategory={onDeleteCategory}
          onMoveTask={onMoveTask}
          onRenameCategory={onRenameCategory}
          onRenameTask={onRenameTask}
          onReorderCategories={onReorderCategories}
          onSetTaskDueDate={onSetTaskDueDate}
          onSetTaskStatus={onSetTaskStatus}
        />
      ) : null}
      <ApplicationWorkspace />
    </div>
  );
}

function AppSession({ client }: { readonly client: SmartSpaceClient }) {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [workspace, setWorkspace] = useState<WorkspaceState>({
    status: "loading",
  });
  const loadingRegionRef = useRef<HTMLElement>(null);
  const categoryDeletionBarrierRef = useRef<Promise<void> | undefined>(
    undefined,
  );
  const moveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWorkspaceMutationsRef = useRef(new Set<Promise<unknown>>());
  const shouldFocusLoading = useRef(false);

  const trackWorkspaceMutation = useCallback(
    <Result,>(result: Promise<Result>) => {
      pendingWorkspaceMutationsRef.current.add(result);
      void result.then(
        () => pendingWorkspaceMutationsRef.current.delete(result),
        () => pendingWorkspaceMutationsRef.current.delete(result),
      );
      return result;
    },
    [],
  );

  const runWorkspaceMutation = useCallback(
    <Result,>(operation: () => Promise<Result>) => {
      const barrier = categoryDeletionBarrierRef.current;
      return trackWorkspaceMutation(
        barrier === undefined ? operation() : barrier.then(operation),
      );
    },
    [trackWorkspaceMutation],
  );

  const runCategoryDeletion = useCallback(
    <Result,>(operation: () => Promise<Result>) => {
      const pendingMutations = [...pendingWorkspaceMutationsRef.current];
      const result =
        pendingMutations.length === 0
          ? operation()
          : Promise.allSettled(pendingMutations).then(operation);
      const barrier = result.then(
        () => undefined,
        () => undefined,
      );
      categoryDeletionBarrierRef.current = barrier;
      void barrier.then(() => {
        if (categoryDeletionBarrierRef.current === barrier) {
          categoryDeletionBarrierRef.current = undefined;
        }
      });
      return trackWorkspaceMutation(result);
    },
    [trackWorkspaceMutation],
  );

  useEffect(() => {
    let active = true;

    void loadTaskWorkspace(client).then(
      (data) => {
        if (active) {
          setWorkspace({ status: "ready", data });
        }
      },
      (error: unknown) => {
        if (active) {
          setWorkspace({
            status: "error",
            message: getWorkspaceErrorMessage(error),
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [client, loadAttempt]);

  useEffect(() => {
    if (workspace.status === "loading" && shouldFocusLoading.current) {
      shouldFocusLoading.current = false;
      loadingRegionRef.current?.focus();
    }
  }, [workspace.status]);

  const createTask = useCallback(
    (input: CreateTaskInput) =>
      runWorkspaceMutation(async () => {
        const createdTask = await client.createTask(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: insertTaskInStorageOrder(current.data, createdTask),
              }
            : current,
        );
        return createdTask;
      }),
    [client, runWorkspaceMutation],
  );

  const createCategory = useCallback(
    (input: CreateCategoryInput) =>
      runWorkspaceMutation(async () => {
        const createdCategory = await client.createCategory(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: insertCategoryInStorageOrder(
                  current.data,
                  createdCategory,
                ),
              }
            : current,
        );
        return createdCategory;
      }),
    [client, runWorkspaceMutation],
  );

  const renameCategory = useCallback(
    (input: RenameCategoryInput) =>
      runWorkspaceMutation(async () => {
        const updatedCategory = await client.renameCategory(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: replaceCategory(
                  current.data,
                  input.categoryId,
                  updatedCategory,
                ),
              }
            : current,
        );
        return updatedCategory;
      }),
    [client, runWorkspaceMutation],
  );

  const reorderCategories = useCallback(
    (input: ReorderCategoriesInput) =>
      runWorkspaceMutation(async () => {
        const reorderedCategories = await client.reorderCategories(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: replaceCategoriesInStorageOrder(
                  current.data,
                  reorderedCategories,
                ),
              }
            : current,
        );
        return reorderedCategories;
      }),
    [client, runWorkspaceMutation],
  );

  const deleteCategory = useCallback(
    (input: DeleteCategoryInput) =>
      runCategoryDeletion(async () => {
        const result = await client.deleteCategory(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: replaceWorkspaceAfterCategoryDeletion(result),
              }
            : current,
        );
        return result;
      }),
    [client, runCategoryDeletion],
  );

  const setTaskStatus = useCallback(
    (input: SetTaskStatusInput) =>
      runWorkspaceMutation(async () => {
        const updatedTask = await client.setTaskStatus(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: replaceTask(current.data, input.taskId, updatedTask),
              }
            : current,
        );
        return updatedTask;
      }),
    [client, runWorkspaceMutation],
  );

  const renameTask = useCallback(
    (input: RenameTaskInput) =>
      runWorkspaceMutation(async () => {
        const updatedTask = await client.renameTask(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: replaceTask(current.data, input.taskId, updatedTask),
              }
            : current,
        );
        return updatedTask;
      }),
    [client, runWorkspaceMutation],
  );

  const setTaskDueDate = useCallback(
    (input: SetTaskDueDateInput) =>
      runWorkspaceMutation(async () => {
        const updatedTask = await client.setTaskDueDate(input);
        setWorkspace((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                data: replaceTask(current.data, input.taskId, updatedTask),
              }
            : current,
        );
        return updatedTask;
      }),
    [client, runWorkspaceMutation],
  );

  const moveTask = useCallback(
    (input: MoveTaskInput) =>
      runWorkspaceMutation(() => {
        const operation = moveQueueRef.current.then(async () => {
          const updatedTask = await client.moveTask(input);
          setWorkspace((current) =>
            current.status === "ready"
              ? {
                  status: "ready",
                  data: moveTaskInStorageOrder(
                    current.data,
                    input.taskId,
                    updatedTask,
                  ),
                }
              : current,
          );
          return updatedTask;
        });
        moveQueueRef.current = operation.then(
          () => undefined,
          () => undefined,
        );
        return operation;
      }),
    [client, runWorkspaceMutation],
  );

  return (
    <main className="grid h-screen min-h-0 grid-rows-[3.25rem_minmax(0,1fr)] overflow-hidden bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-content-center bg-[var(--accent-strong)] text-[0.625rem] font-bold text-[var(--text-on-accent)]"
          >
            SS
          </span>
          <h1 className="truncate text-sm font-semibold">{APP_NAME}</h1>
        </div>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">Local</span>
      </header>

      <WorkspaceBody
        loadingRegionRef={loadingRegionRef}
        onCreateCategory={createCategory}
        onCreateTask={createTask}
        onDeleteCategory={deleteCategory}
        onMoveTask={moveTask}
        onRenameCategory={renameCategory}
        onRenameTask={renameTask}
        onReorderCategories={reorderCategories}
        onSetTaskDueDate={setTaskDueDate}
        onSetTaskStatus={setTaskStatus}
        onRetry={() => {
          shouldFocusLoading.current = true;
          setWorkspace({ status: "loading" });
          setLoadAttempt((attempt) => attempt + 1);
        }}
        workspace={workspace}
      />
    </main>
  );
}

export function App({
  client = smartSpaceClient,
}: {
  readonly client?: SmartSpaceClient;
}) {
  return <AppSession client={client} key={getClientKey(client)} />;
}
