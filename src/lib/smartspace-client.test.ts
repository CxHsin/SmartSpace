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

describe("SmartSpaceClient reorder tasks command", () => {
  it("sends the exact readonly order and returns complete task DTOs", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const secondTask: TaskDto = {
      ...tasks[0],
      id: "10000000-0000-0000-0000-000000000002",
      title: "Second task",
      position: 1,
    };
    const reorderedTasks: readonly TaskDto[] = [
      { ...secondTask, position: 0 },
      { ...tasks[0], position: 1 },
    ];
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return reorderedTasks as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const orderedTaskIds = Object.freeze([secondTask.id, tasks[0].id]);
    const input = Object.freeze({
      categoryId: categories[0].id,
      orderedTaskIds,
    });

    await expect(client.reorderTasks(input)).resolves.toEqual(reorderedTasks);
    expect(input).toEqual({
      categoryId: categories[0].id,
      orderedTaskIds: [secondTask.id, tasks[0].id],
    });
    expect(calls).toEqual([
      {
        command: "reorder_tasks",
        args: {
          request: {
            categoryId: categories[0].id,
            orderedTaskIds: [secondTask.id, tasks[0].id],
          },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "task order is incomplete" },
    { code: "category_not_found", message: "category does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .reorderTasks({
          categoryId: categories[0].id,
          orderedTaskIds: [tasks[0].id],
        })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient delete task command", () => {
  it("sends the exact readonly request and returns the complete deleted snapshot", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const deletedTask: TaskDto = { ...tasks[0] };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return deletedTask as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({ taskId: tasks[0].id });

    await expect(client.deleteTask(input)).resolves.toEqual(deletedTask);
    expect(input).toEqual({ taskId: tasks[0].id });
    expect(calls).toEqual([
      {
        command: "delete_task",
        args: { request: { taskId: tasks[0].id } },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "task id is invalid" },
    { code: "task_not_found", message: "task does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .deleteTask({ taskId: tasks[0].id })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient create category command", () => {
  it("sends the exact readonly request and returns the complete category DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const createdCategory: CategoryDto = {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Projects",
      position: 1,
      kind: "user",
    };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return createdCategory as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({ name: "  Projects  " });

    await expect(client.createCategory(input)).resolves.toEqual(
      createdCategory,
    );
    expect(input).toEqual({ name: "  Projects  " });
    expect(calls).toEqual([
      {
        command: "create_category",
        args: { request: { name: "  Projects  " } },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "category name cannot be blank" },
    {
      code: "duplicate_category_name",
      message: "category name already exists",
    },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .createCategory({ name: "Projects" })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient rename category command", () => {
  it("sends the exact readonly request and returns the complete category DTO", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const renamedCategory: CategoryDto = {
      ...categories[0],
      name: "Main inbox",
    };
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return renamedCategory as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const input = Object.freeze({
      categoryId: categories[0].id,
      name: "  Main inbox  ",
    });

    await expect(client.renameCategory(input)).resolves.toEqual(
      renamedCategory,
    );
    expect(input).toEqual({
      categoryId: categories[0].id,
      name: "  Main inbox  ",
    });
    expect(calls).toEqual([
      {
        command: "rename_category",
        args: {
          request: {
            categoryId: categories[0].id,
            name: "  Main inbox  ",
          },
        },
      },
    ]);
  });

  it.each([
    { code: "invalid_input", message: "category name cannot be blank" },
    {
      code: "duplicate_category_name",
      message: "category name already exists",
    },
    { code: "category_not_found", message: "category does not exist" },
  ] as const)(
    "preserves the structured $code error",
    async ({ code, message }) => {
      const client = createSmartSpaceClient(async () => {
        throw { code, message };
      });

      const error = await client
        .renameCategory({ categoryId: categories[0].id, name: "Main inbox" })
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(SmartSpaceCommandError);
      expect(error).toMatchObject({ code, message });
    },
  );
});

describe("SmartSpaceClient reorder categories command", () => {
  it("sends the exact readonly order and returns complete category DTOs", async () => {
    const calls: Array<{
      command: string;
      args: Record<string, unknown> | undefined;
    }> = [];
    const userCategory: CategoryDto = {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Projects",
      position: 1,
      kind: "user",
    };
    const reorderedCategories: readonly CategoryDto[] = [
      { ...userCategory, position: 0 },
      { ...categories[0], position: 1 },
    ];
    const invokeCommand: InvokeCommand = async <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      return reorderedCategories as T;
    };
    const client = createSmartSpaceClient(invokeCommand);
    const orderedCategoryIds = Object.freeze([
      userCategory.id,
      categories[0].id,
    ]);
    const input = Object.freeze({ orderedCategoryIds });

    await expect(client.reorderCategories(input)).resolves.toEqual(
      reorderedCategories,
    );
    expect(input).toEqual({
      orderedCategoryIds: [userCategory.id, categories[0].id],
    });
    expect(calls).toEqual([
      {
        command: "reorder_categories",
        args: {
          request: {
            orderedCategoryIds: [userCategory.id, categories[0].id],
          },
        },
      },
    ]);
  });

  it("preserves the structured invalid_input error", async () => {
    const client = createSmartSpaceClient(async () => {
      throw { code: "invalid_input", message: "category order is incomplete" };
    });

    const error = await client
      .reorderCategories({ orderedCategoryIds: [categories[0].id] })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SmartSpaceCommandError);
    expect(error).toMatchObject({
      code: "invalid_input",
      message: "category order is incomplete",
    });
  });
});
