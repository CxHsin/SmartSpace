import { describe, expect, it, vi } from "vitest";
import type {
  CategoryDto,
  SmartSpaceClient,
  TaskDto,
} from "../../lib/smartspace-client";
import { loadTaskWorkspace } from "./workspace-loader";

const categories: readonly CategoryDto[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Inbox",
    position: 0,
    kind: "inbox",
  },
];

const tasks: readonly TaskDto[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    title: "Connect the task workspace",
    status: "open",
    dueDate: null,
    categoryId: categories[0].id,
    position: 0,
    createdAt: "2026-07-28T09:00:00.000000001Z",
    updatedAt: "2026-07-28T09:00:00.000000001Z",
  },
];

describe("loadTaskWorkspace", () => {
  it("starts independent category and task reads together", async () => {
    let resolveCategories:
      ((value: readonly CategoryDto[]) => void) | undefined;
    let resolveTasks: ((value: readonly TaskDto[]) => void) | undefined;
    const listCategories = vi.fn(
      () =>
        new Promise<readonly CategoryDto[]>((resolve) => {
          resolveCategories = resolve;
        }),
    );
    const listTasks = vi.fn(
      () =>
        new Promise<readonly TaskDto[]>((resolve) => {
          resolveTasks = resolve;
        }),
    );
    const client: SmartSpaceClient = {
      listCategories,
      listTasks,
      createTask: vi.fn(async () => {
        throw new Error("Workspace loader called createTask unexpectedly.");
      }),
      setTaskStatus: vi.fn(async () => {
        throw new Error("Workspace loader called setTaskStatus unexpectedly.");
      }),
      renameTask: vi.fn(async () => {
        throw new Error("Workspace loader called renameTask unexpectedly.");
      }),
      setTaskDueDate: vi.fn(async () => {
        throw new Error("Workspace loader called setTaskDueDate unexpectedly.");
      }),
      moveTask: vi.fn(async () => {
        throw new Error("Workspace loader called moveTask unexpectedly.");
      }),
      reorderTasks: vi.fn(async () => {
        throw new Error("Workspace loader called reorderTasks unexpectedly.");
      }),
      deleteTask: vi.fn(async () => {
        throw new Error("Workspace loader called deleteTask unexpectedly.");
      }),
      createCategory: vi.fn(async () => {
        throw new Error("Workspace loader called createCategory unexpectedly.");
      }),
      renameCategory: vi.fn(async () => {
        throw new Error("Workspace loader called renameCategory unexpectedly.");
      }),
    };

    const loading = loadTaskWorkspace(client);

    expect(listCategories).toHaveBeenCalledOnce();
    expect(listTasks).toHaveBeenCalledOnce();
    resolveCategories?.(categories);
    resolveTasks?.(tasks);

    await expect(loading).resolves.toEqual({ categories, tasks });
  });
});
