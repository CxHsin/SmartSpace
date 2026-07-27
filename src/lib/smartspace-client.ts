import { invoke } from "@tauri-apps/api/core";

export type CategoryKind = "inbox" | "user";
export type TaskStatus = "open" | "completed";

export interface CategoryDto {
  readonly id: string;
  readonly name: string;
  readonly position: number;
  readonly kind: CategoryKind;
}

export interface DeleteCategoryResultDto {
  readonly categoryId: string;
  readonly migratedTaskCount: number;
}

export interface TaskDto {
  readonly id: string;
  readonly title: string;
  readonly status: TaskStatus;
  readonly dueDate: string | null;
  readonly categoryId: string;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateTaskInput {
  readonly title: string;
  readonly categoryId: string;
}

export interface SetTaskStatusInput {
  readonly taskId: string;
  readonly status: TaskStatus;
}

export interface RenameTaskInput {
  readonly taskId: string;
  readonly title: string;
}

export interface SetTaskDueDateInput {
  readonly taskId: string;
  readonly dueDate: string | null;
}

export interface MoveTaskInput {
  readonly taskId: string;
  readonly categoryId: string;
}

export interface ReorderTasksInput {
  readonly categoryId: string;
  readonly orderedTaskIds: readonly string[];
}

export interface DeleteTaskInput {
  readonly taskId: string;
}

export interface CreateCategoryInput {
  readonly name: string;
}

export interface RenameCategoryInput {
  readonly categoryId: string;
  readonly name: string;
}

export interface ReorderCategoriesInput {
  readonly orderedCategoryIds: readonly string[];
}

export interface DeleteCategoryInput {
  readonly categoryId: string;
}

export type CommandErrorCode =
  | "invalid_input"
  | "category_not_found"
  | "task_not_found"
  | "duplicate_category_name"
  | "cannot_delete_inbox"
  | "database_unavailable"
  | "data_corrupt"
  | "database_operation_failed";

export class SmartSpaceCommandError extends Error {
  readonly code: CommandErrorCode | "unknown";

  constructor(code: CommandErrorCode | "unknown", message: string) {
    super(message);
    this.name = "SmartSpaceCommandError";
    this.code = code;
  }
}

export type InvokeCommand = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export interface SmartSpaceClient {
  listCategories(): Promise<readonly CategoryDto[]>;
  listTasks(): Promise<readonly TaskDto[]>;
  createTask(input: CreateTaskInput): Promise<TaskDto>;
  setTaskStatus(input: SetTaskStatusInput): Promise<TaskDto>;
  renameTask(input: RenameTaskInput): Promise<TaskDto>;
  setTaskDueDate(input: SetTaskDueDateInput): Promise<TaskDto>;
  moveTask(input: MoveTaskInput): Promise<TaskDto>;
  reorderTasks(input: ReorderTasksInput): Promise<readonly TaskDto[]>;
  deleteTask(input: DeleteTaskInput): Promise<TaskDto>;
  createCategory(input: CreateCategoryInput): Promise<CategoryDto>;
  renameCategory(input: RenameCategoryInput): Promise<CategoryDto>;
  reorderCategories(
    input: ReorderCategoriesInput,
  ): Promise<readonly CategoryDto[]>;
  deleteCategory(input: DeleteCategoryInput): Promise<DeleteCategoryResultDto>;
}

const commandErrorCodes = new Set<CommandErrorCode>([
  "invalid_input",
  "category_not_found",
  "task_not_found",
  "duplicate_category_name",
  "cannot_delete_inbox",
  "database_unavailable",
  "data_corrupt",
  "database_operation_failed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCommandError(error: unknown): SmartSpaceCommandError {
  if (error instanceof SmartSpaceCommandError) {
    return error;
  }

  if (
    isRecord(error) &&
    typeof error.code === "string" &&
    commandErrorCodes.has(error.code as CommandErrorCode) &&
    typeof error.message === "string"
  ) {
    return new SmartSpaceCommandError(
      error.code as CommandErrorCode,
      error.message,
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : "SmartSpace command failed unexpectedly.";
  return new SmartSpaceCommandError("unknown", message);
}

export function createSmartSpaceClient(
  invokeCommand: InvokeCommand = invoke,
): SmartSpaceClient {
  async function invokeTyped<T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await invokeCommand<T>(command, args);
    } catch (error) {
      throw normalizeCommandError(error);
    }
  }

  return {
    listCategories: () =>
      invokeTyped<readonly CategoryDto[]>("list_categories"),
    listTasks: () => invokeTyped<readonly TaskDto[]>("list_tasks"),
    createTask: (request) => invokeTyped<TaskDto>("create_task", { request }),
    setTaskStatus: (request) =>
      invokeTyped<TaskDto>("set_task_status", { request }),
    renameTask: (request) => invokeTyped<TaskDto>("rename_task", { request }),
    setTaskDueDate: (request) =>
      invokeTyped<TaskDto>("set_task_due_date", { request }),
    moveTask: (request) => invokeTyped<TaskDto>("move_task", { request }),
    reorderTasks: (request) =>
      invokeTyped<readonly TaskDto[]>("reorder_tasks", { request }),
    deleteTask: (request) => invokeTyped<TaskDto>("delete_task", { request }),
    createCategory: (request) =>
      invokeTyped<CategoryDto>("create_category", { request }),
    renameCategory: (request) =>
      invokeTyped<CategoryDto>("rename_category", { request }),
    reorderCategories: (request) =>
      invokeTyped<readonly CategoryDto[]>("reorder_categories", { request }),
    deleteCategory: (request) =>
      invokeTyped<DeleteCategoryResultDto>("delete_category", { request }),
  };
}

export const smartSpaceClient = createSmartSpaceClient();
