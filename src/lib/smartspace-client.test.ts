import { describe, expect, it } from "vitest";
import {
  createSmartSpaceClient,
  SmartSpaceCommandError,
  type CategoryDto,
  type InvokeCommand,
  type TaskDto,
} from "./smartspace-client";

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
    title: "Ship IPC client",
    status: "completed",
    dueDate: "2026-07-30",
    categoryId: "00000000-0000-0000-0000-000000000001",
    position: 0,
    createdAt: "2026-07-28T09:00:00.000000001Z",
    updatedAt: "2026-07-28T09:00:01.000000002Z",
  },
];

describe("SmartSpaceClient read commands", () => {
  it("invokes the exact category and task commands without arguments", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return (command === "list_categories" ? categories : tasks) as T;
    };
    const client = createSmartSpaceClient(invokeCommand);

    await expect(client.listCategories()).resolves.toEqual(categories);
    await expect(client.listTasks()).resolves.toEqual(tasks);
    expect(calls).toEqual([
      { command: "list_categories", args: undefined },
      { command: "list_tasks", args: undefined },
    ]);
  });

  it("preserves known structured command errors", async () => {
    const client = createSmartSpaceClient(async () => {
      throw {
        code: "data_corrupt",
        message: "task storage invariant violated",
      };
    });

    const error = await client.listTasks().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SmartSpaceCommandError);
    expect(error).toMatchObject({
      code: "data_corrupt",
      message: "task storage invariant violated",
    });
  });

  it("normalizes unknown rejection shapes to an unknown command error", async () => {
    const client = createSmartSpaceClient(async () => {
      throw { code: "future_error", message: "not yet supported" };
    });

    const error = await client
      .listCategories()
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SmartSpaceCommandError);
    expect(error).toMatchObject({
      code: "unknown",
      message: "SmartSpace command failed unexpectedly.",
    });
  });
});
