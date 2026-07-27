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

describe("SmartSpaceClient create task command", () => {
  it("sends the exact request and returns the complete task DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return tasks[0] as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = {
      title: "  Keep backend normalization  ",
      categoryId: categories[0].id,
    };

    await expect(client.createTask(input)).resolves.toEqual(tasks[0]);
    expect(calls).toEqual([
      {
        command: "create_task",
        args: {
          request: {
            title: "  Keep backend normalization  ",
            categoryId: categories[0].id,
          },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "title cannot be blank" },
    {
      code: "category_not_found",
      message: "category does not exist",
    },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .createTask({ title: "Task", categoryId: categories[0].id })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient set task status command", () => {
  it("sends the exact readonly request and returns the complete task DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const reopenedTask: TaskDto = { ...tasks[0], status: "open" };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return reopenedTask as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({
      taskId: tasks[0].id,
      status: "open" as const,
    });

    await expect(client.setTaskStatus(input)).resolves.toEqual(reopenedTask);
    expect(input).toEqual({ taskId: tasks[0].id, status: "open" });
    expect(calls).toEqual([
      {
        command: "set_task_status",
        args: {
          request: { taskId: tasks[0].id, status: "open" },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "status is invalid" },
    { code: "task_not_found", message: "task does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .setTaskStatus({ taskId: tasks[0].id, status: "completed" })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient rename task command", () => {
  it("sends the exact readonly request and returns the complete task DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const renamedTask: TaskDto = {
      ...tasks[0],
      title: "Renamed task",
      updatedAt: "2026-07-28T09:05:00.000000003Z",
    };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return renamedTask as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({
      taskId: tasks[0].id,
      title: "  Keep backend normalization  ",
    });

    await expect(client.renameTask(input)).resolves.toEqual(renamedTask);
    expect(input).toEqual({
      taskId: tasks[0].id,
      title: "  Keep backend normalization  ",
    });
    expect(calls).toEqual([
      {
        command: "rename_task",
        args: {
          request: {
            taskId: tasks[0].id,
            title: "  Keep backend normalization  ",
          },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "title cannot be blank" },
    { code: "task_not_found", message: "task does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .renameTask({ taskId: tasks[0].id, title: "Renamed task" })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient set task due date command", () => {
  it("sends an exact readonly date request and returns the complete task DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const datedTask: TaskDto = {
      ...tasks[0],
      dueDate: "2026-08-01",
      updatedAt: "2026-07-28T09:06:00.000000004Z",
    };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return datedTask as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({
      taskId: tasks[0].id,
      dueDate: "2026-08-01",
    });

    await expect(client.setTaskDueDate(input)).resolves.toEqual(datedTask);
    expect(input).toEqual({
      taskId: tasks[0].id,
      dueDate: "2026-08-01",
    });
    expect(calls).toEqual([
      {
        command: "set_task_due_date",
        args: {
          request: {
            taskId: tasks[0].id,
            dueDate: "2026-08-01",
          },
        },
      },
    ]);
  });

  it("passes null explicitly when clearing the due date", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const clearedTask: TaskDto = { ...tasks[0], dueDate: null };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return clearedTask as T;
    };
    const client = createSmartSpaceClient(invokeCommand);

    await expect(
      client.setTaskDueDate({ taskId: tasks[0].id, dueDate: null }),
    ).resolves.toEqual(clearedTask);
    expect(calls).toEqual([
      {
        command: "set_task_due_date",
        args: {
          request: { taskId: tasks[0].id, dueDate: null },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "due date is invalid" },
    { code: "task_not_found", message: "task does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .setTaskDueDate({ taskId: tasks[0].id, dueDate: "2026-08-01" })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient move task command", () => {
  it("sends the exact readonly request and returns the complete task DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const targetCategoryId = "00000000-0000-0000-0000-000000000002";
    const movedTask: TaskDto = {
      ...tasks[0],
      categoryId: targetCategoryId,
      position: 3,
      updatedAt: "2026-07-28T09:07:00.000000005Z",
    };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return movedTask as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({
      taskId: tasks[0].id,
      categoryId: targetCategoryId,
    });

    await expect(client.moveTask(input)).resolves.toEqual(movedTask);
    expect(input).toEqual({
      taskId: tasks[0].id,
      categoryId: targetCategoryId,
    });
    expect(calls).toEqual([
      {
        command: "move_task",
        args: {
          request: {
            taskId: tasks[0].id,
            categoryId: targetCategoryId,
          },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "task id is invalid" },
    { code: "task_not_found", message: "task does not exist" },
    { code: "category_not_found", message: "category does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .moveTask({ taskId: tasks[0].id, categoryId: categories[0].id })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});
