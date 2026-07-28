// @vitest-environment jsdom

import { StrictMode, createElement } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { TaskWorkspace } from "./features/tasks/TaskWorkspace";
import { SmartSpaceCommandError } from "./lib/smartspace-client";
import type {
  CategoryDto,
  DeleteCategoryResultDto,
  SmartSpaceClient,
  TaskDto,
} from "./lib/smartspace-client";

const inboxId = "00000000-0000-0000-0000-000000000001";
const workId = "00000000-0000-0000-0000-000000000002";
const personalId = "00000000-0000-0000-0000-000000000003";

const categories: readonly CategoryDto[] = [
  { id: inboxId, name: "Inbox", position: 0, kind: "inbox" },
  { id: workId, name: "Work", position: 1, kind: "user" },
  { id: personalId, name: "Personal", position: 2, kind: "user" },
];

function createTask(
  id: string,
  title: string,
  categoryId: string,
  position = 0,
): TaskDto {
  return {
    id,
    title,
    status: "open",
    dueDate: null,
    categoryId,
    position,
    createdAt: "2026-07-28T09:00:00.000000001Z",
    updatedAt: "2026-07-28T09:00:00.000000001Z",
  };
}

function getLocalTodayForTest() {
  const date = new Date();
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const unexpectedSetTaskStatus: SmartSpaceClient["setTaskStatus"] = async () => {
  throw new Error("Workspace test called setTaskStatus unexpectedly.");
};

const unexpectedPickApplicationExecutable: SmartSpaceClient["pickApplicationExecutable"] =
  async () => {
    throw new Error(
      "Workspace test called pickApplicationExecutable unexpectedly.",
    );
  };

const unexpectedRenameTask: SmartSpaceClient["renameTask"] = async () => {
  throw new Error("Workspace test called renameTask unexpectedly.");
};

const unexpectedSetTaskDueDate: SmartSpaceClient["setTaskDueDate"] =
  async () => {
    throw new Error("Workspace test called setTaskDueDate unexpectedly.");
  };

const unexpectedMoveTask: SmartSpaceClient["moveTask"] = async () => {
  throw new Error("Workspace test called moveTask unexpectedly.");
};

const unexpectedReorderTasks: SmartSpaceClient["reorderTasks"] = async () => {
  throw new Error("Workspace test called reorderTasks unexpectedly.");
};

const unexpectedDeleteTask: SmartSpaceClient["deleteTask"] = async () => {
  throw new Error("Workspace test called deleteTask unexpectedly.");
};

const unexpectedCreateCategory: SmartSpaceClient["createCategory"] =
  async () => {
    throw new Error("Workspace test called createCategory unexpectedly.");
  };

const unexpectedRenameCategory: SmartSpaceClient["renameCategory"] =
  async () => {
    throw new Error("Workspace test called renameCategory unexpectedly.");
  };

const unexpectedReorderCategories: SmartSpaceClient["reorderCategories"] =
  async () => {
    throw new Error("Workspace test called reorderCategories unexpectedly.");
  };

const unexpectedDeleteCategory: SmartSpaceClient["deleteCategory"] =
  async () => {
    throw new Error("Workspace test called deleteCategory unexpectedly.");
  };

function createClient(
  taskResult: readonly TaskDto[] = [],
  createTask: SmartSpaceClient["createTask"] = async () => {
    throw new Error("Read-only workspace test called createTask unexpectedly.");
  },
  setTaskStatus: SmartSpaceClient["setTaskStatus"] = unexpectedSetTaskStatus,
  createCategory: SmartSpaceClient["createCategory"] = unexpectedCreateCategory,
  setTaskDueDate: SmartSpaceClient["setTaskDueDate"] = unexpectedSetTaskDueDate,
  moveTask: SmartSpaceClient["moveTask"] = unexpectedMoveTask,
  renameTask: SmartSpaceClient["renameTask"] = unexpectedRenameTask,
  renameCategory: SmartSpaceClient["renameCategory"] = unexpectedRenameCategory,
  reorderCategories: SmartSpaceClient["reorderCategories"] = unexpectedReorderCategories,
  deleteCategory: SmartSpaceClient["deleteCategory"] = unexpectedDeleteCategory,
  categoryResult: readonly CategoryDto[] = categories,
): SmartSpaceClient {
  return {
    pickApplicationExecutable: unexpectedPickApplicationExecutable,
    listCategories: vi.fn(async () => categoryResult),
    listTasks: vi.fn(async () => taskResult),
    createTask,
    setTaskStatus,
    renameTask,
    setTaskDueDate,
    moveTask,
    reorderTasks: unexpectedReorderTasks,
    deleteTask: unexpectedDeleteTask,
    createCategory,
    renameCategory,
    reorderCategories,
    deleteCategory,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
});

describe("App task workspace lifecycle", () => {
  it("loads through the injected client under StrictMode", async () => {
    const client = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000001",
        "Loaded from IPC",
        inboxId,
      ),
    ]);

    render(createElement(StrictMode, null, createElement(App, { client })));

    expect(await screen.findByText("Loaded from IPC")).not.toBeNull();
    expect(client.listCategories).toHaveBeenCalledTimes(2);
    expect(client.listTasks).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale request after the injected client changes", async () => {
    const staleCategories = createDeferred<readonly CategoryDto[]>();
    const staleTasks = createDeferred<readonly TaskDto[]>();
    const staleClient: SmartSpaceClient = {
      pickApplicationExecutable: unexpectedPickApplicationExecutable,
      listCategories: () => staleCategories.promise,
      listTasks: () => staleTasks.promise,
      createTask: async () => {
        throw new Error(
          "Read-only workspace test called createTask unexpectedly.",
        );
      },
      setTaskStatus: unexpectedSetTaskStatus,
      renameTask: unexpectedRenameTask,
      setTaskDueDate: unexpectedSetTaskDueDate,
      moveTask: unexpectedMoveTask,
      reorderTasks: unexpectedReorderTasks,
      deleteTask: unexpectedDeleteTask,
      createCategory: unexpectedCreateCategory,
      renameCategory: unexpectedRenameCategory,
      reorderCategories: unexpectedReorderCategories,
      deleteCategory: unexpectedDeleteCategory,
    };
    const currentClient = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000002",
        "Current workspace",
        workId,
      ),
    ]);
    const rendered = render(createElement(App, { client: staleClient }));

    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current workspace")).not.toBeNull();

    await act(async () => {
      staleCategories.resolve(categories);
      staleTasks.resolve([
        createTask(
          "10000000-0000-0000-0000-000000000003",
          "Stale workspace",
          personalId,
        ),
      ]);
      await Promise.all([staleCategories.promise, staleTasks.promise]);
    });

    expect(screen.queryByText("Stale workspace")).toBeNull();
    expect(screen.getByText("Current workspace")).not.toBeNull();
  });

  it("does not merge a pending create after the injected client changes", async () => {
    const pendingCreate = createDeferred<TaskDto>();
    const staleCreateTask = vi.fn(() => pendingCreate.promise);
    const staleClient = createClient([], staleCreateTask);
    const currentClient = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000009",
        "Current client task",
        inboxId,
      ),
    ]);
    const rendered = render(createElement(App, { client: staleClient }));

    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Stale created task" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add task" }));
    expect(staleCreateTask).toHaveBeenCalledTimes(1);

    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current client task")).not.toBeNull();

    await act(async () => {
      pendingCreate.resolve(
        createTask(
          "10000000-0000-0000-0000-000000000010",
          "Stale created task",
          inboxId,
          1,
        ),
      );
      await pendingCreate.promise;
    });

    expect(screen.queryByText("Stale created task")).toBeNull();
    expect(screen.getByRole("button", { name: "All tasks 1" })).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("starts a fresh loading session when switching from A to B and back", async () => {
    const freshATasks = createDeferred<readonly TaskDto[]>();
    const clientA: SmartSpaceClient = {
      pickApplicationExecutable: unexpectedPickApplicationExecutable,
      listCategories: vi.fn(async () => categories),
      listTasks: vi
        .fn<SmartSpaceClient["listTasks"]>()
        .mockResolvedValueOnce([
          createTask(
            "10000000-0000-0000-0000-000000000011",
            "Old A snapshot",
            inboxId,
          ),
        ])
        .mockImplementationOnce(() => freshATasks.promise),
      createTask: vi.fn(async () => {
        throw new Error("Loading session exposed createTask unexpectedly.");
      }),
      setTaskStatus: unexpectedSetTaskStatus,
      renameTask: unexpectedRenameTask,
      setTaskDueDate: unexpectedSetTaskDueDate,
      moveTask: unexpectedMoveTask,
      reorderTasks: unexpectedReorderTasks,
      deleteTask: unexpectedDeleteTask,
      createCategory: unexpectedCreateCategory,
      renameCategory: unexpectedRenameCategory,
      reorderCategories: unexpectedReorderCategories,
      deleteCategory: unexpectedDeleteCategory,
    };
    const pendingBCategories = createDeferred<readonly CategoryDto[]>();
    const pendingBTasks = createDeferred<readonly TaskDto[]>();
    const clientB: SmartSpaceClient = {
      pickApplicationExecutable: unexpectedPickApplicationExecutable,
      listCategories: () => pendingBCategories.promise,
      listTasks: () => pendingBTasks.promise,
      createTask: vi.fn(async () => {
        throw new Error("Loading session exposed createTask unexpectedly.");
      }),
      setTaskStatus: unexpectedSetTaskStatus,
      renameTask: unexpectedRenameTask,
      setTaskDueDate: unexpectedSetTaskDueDate,
      moveTask: unexpectedMoveTask,
      reorderTasks: unexpectedReorderTasks,
      deleteTask: unexpectedDeleteTask,
      createCategory: unexpectedCreateCategory,
      renameCategory: unexpectedRenameCategory,
      reorderCategories: unexpectedReorderCategories,
      deleteCategory: unexpectedDeleteCategory,
    };
    const rendered = render(createElement(App, { client: clientA }));

    expect(await screen.findByText("Old A snapshot")).not.toBeNull();
    rendered.rerender(createElement(App, { client: clientB }));
    expect(
      screen.getByRole("status", { name: "Loading tasks" }),
    ).not.toBeNull();
    expect(screen.queryByRole("form", { name: "Add task" })).toBeNull();

    rendered.rerender(createElement(App, { client: clientA }));
    expect(
      screen.getByRole("status", { name: "Loading tasks" }),
    ).not.toBeNull();
    expect(screen.queryByText("Old A snapshot")).toBeNull();
    expect(screen.queryByRole("form", { name: "Add task" })).toBeNull();

    await act(async () => {
      freshATasks.resolve([
        createTask(
          "10000000-0000-0000-0000-000000000012",
          "Fresh A snapshot",
          inboxId,
        ),
      ]);
      await freshATasks.promise;
    });

    expect(await screen.findByText("Fresh A snapshot")).not.toBeNull();
    expect(screen.queryByText("Old A snapshot")).toBeNull();
    expect(clientA.listTasks).toHaveBeenCalledTimes(2);
  });

  it("announces a failure, focuses loading on retry, and reloads", async () => {
    const firstTasks = createDeferred<readonly TaskDto[]>();
    const listTasks = vi
      .fn<SmartSpaceClient["listTasks"]>()
      .mockImplementationOnce(() => firstTasks.promise)
      .mockResolvedValueOnce([
        createTask(
          "10000000-0000-0000-0000-000000000004",
          "Recovered workspace",
          inboxId,
        ),
      ]);
    const client: SmartSpaceClient = {
      pickApplicationExecutable: unexpectedPickApplicationExecutable,
      listCategories: vi.fn(async () => categories),
      listTasks,
      createTask: vi.fn(async () => {
        throw new Error(
          "Read-only workspace test called createTask unexpectedly.",
        );
      }),
      setTaskStatus: unexpectedSetTaskStatus,
      renameTask: unexpectedRenameTask,
      setTaskDueDate: unexpectedSetTaskDueDate,
      moveTask: unexpectedMoveTask,
      reorderTasks: unexpectedReorderTasks,
      deleteTask: unexpectedDeleteTask,
      createCategory: unexpectedCreateCategory,
      renameCategory: unexpectedRenameCategory,
      reorderCategories: unexpectedReorderCategories,
      deleteCategory: unexpectedDeleteCategory,
    };

    render(createElement(App, { client }));
    await act(async () => {
      firstTasks.reject(new Error("IPC unavailable"));
      await firstTasks.promise.catch(() => undefined);
    });

    const alert = await screen.findByRole("alert", {
      name: "Task loading error",
    });
    expect(alert.textContent).toContain("Tasks unavailable");
    const retryButton = screen.getByRole("button", { name: "Try again" });
    retryButton.focus();
    fireEvent.click(retryButton);

    const loadingStatus = screen.getByRole("status", {
      name: "Loading tasks",
    });
    expect(document.activeElement).toBe(loadingStatus);
    expect(await screen.findByText("Recovered workspace")).not.toBeNull();
    expect(listTasks).toHaveBeenCalledTimes(2);
  });

  it("filters the rendered list when a category is selected", async () => {
    const client = createClient([
      createTask("10000000-0000-0000-0000-000000000005", "Work task", workId),
      createTask(
        "10000000-0000-0000-0000-000000000006",
        "Personal task",
        personalId,
      ),
    ]);

    render(createElement(App, { client }));
    expect(await screen.findByText("Work task")).not.toBeNull();
    expect(screen.getByText("Personal task")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Work 1" }));

    await waitFor(() => {
      expect(screen.queryByText("Personal task")).toBeNull();
    });
    expect(screen.getByText("Work task")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Work", level: 2 }),
    ).not.toBeNull();
  });

  it("filters completed tasks while preserving all-task and category views", async () => {
    const openWorkTask = createTask(
      "10000000-0000-0000-0000-000000000019",
      "Open work task",
      workId,
    );
    const completedWorkTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000020",
        "Completed work task",
        workId,
        1,
      ),
      status: "completed",
    };
    const completedPersonalTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000021",
        "Completed personal task",
        personalId,
      ),
      status: "completed",
    };

    render(
      createElement(App, {
        client: createClient([
          openWorkTask,
          completedWorkTask,
          completedPersonalTask,
        ]),
      }),
    );

    expect(await screen.findByText("Open work task")).not.toBeNull();
    expect(screen.getByRole("button", { name: "All tasks 3" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Work 2" })).not.toBeNull();
    const completedViewButton = screen.getByRole("button", {
      name: "Completed 2",
    });

    fireEvent.click(completedViewButton);

    await waitFor(() => {
      expect(screen.queryByText("Open work task")).toBeNull();
    });
    expect(screen.getByText("Completed work task")).not.toBeNull();
    expect(screen.getByText("Completed personal task")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Completed", level: 2 }),
    ).not.toBeNull();
    expect(completedViewButton.getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "All tasks 3" }));
    expect(await screen.findByText("Open work task")).not.toBeNull();
    expect(screen.getByText("Completed personal task")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Work 2" }));
    await waitFor(() => {
      expect(screen.queryByText("Completed personal task")).toBeNull();
    });
    expect(screen.getByText("Open work task")).not.toBeNull();
    expect(screen.getByText("Completed work task")).not.toBeNull();
  });

  it("filters tasks due on the local calendar day in stable storage order", async () => {
    const localToday = getLocalTodayForTest();
    const openTodayTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000030",
        "Open today task",
        workId,
      ),
      dueDate: localToday,
    };
    const completedTodayTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000031",
        "Completed today task",
        personalId,
      ),
      dueDate: localToday,
      status: "completed",
    };
    const overdueTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000032",
        "Older due task",
        inboxId,
      ),
      dueDate: "2000-01-01",
    };
    const futureTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000033",
        "Later due task",
        inboxId,
        1,
      ),
      dueDate: "2999-12-31",
    };
    const noDateTask = createTask(
      "10000000-0000-0000-0000-000000000034",
      "Undated task",
      inboxId,
      2,
    );

    render(
      createElement(App, {
        client: createClient([
          openTodayTask,
          completedTodayTask,
          overdueTask,
          futureTask,
          noDateTask,
        ]),
      }),
    );

    const todayButton = await screen.findByRole("button", { name: "Today 2" });
    fireEvent.click(todayButton);

    expect(
      screen.getByRole("heading", { name: "Today", level: 2 }),
    ).not.toBeNull();
    expect(todayButton.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Open today task")).not.toBeNull();
    expect(screen.getByText("Completed today task")).not.toBeNull();
    expect(screen.queryByText("Older due task")).toBeNull();
    expect(screen.queryByText("Later due task")).toBeNull();
    expect(screen.queryByText("Undated task")).toBeNull();
    const taskListText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(taskListText?.indexOf("Open today task")).toBeLessThan(
      taskListText?.indexOf("Completed today task") ?? -1,
    );
  });

  it("removes a reopened task from the completed view and updates its count", async () => {
    const completedTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000022",
        "Archived task",
        inboxId,
      ),
      status: "completed",
    };
    const reopenedTask: TaskDto = {
      ...completedTask,
      status: "open",
      updatedAt: "2026-07-28T11:00:00.000000001Z",
    };
    const setTaskStatus = vi.fn(async () => reopenedTask);

    render(
      createElement(App, {
        client: createClient([completedTask], undefined, setTaskStatus),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Completed 1" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reopen task: Archived task" }),
    );

    expect(await screen.findByText("No completed tasks")).not.toBeNull();
    expect(
      screen.getByText("Completed tasks will appear here."),
    ).not.toBeNull();
    expect(setTaskStatus).toHaveBeenCalledWith({
      taskId: completedTask.id,
      status: "open",
    });
    expect(screen.getByRole("button", { name: "Completed 0" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "All tasks 1" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "All tasks 1" }));
    expect(
      await screen.findByRole("button", {
        name: "Complete task: Archived task",
      }),
    ).not.toBeNull();
  });

  it("renders the empty state after a successful read", async () => {
    render(createElement(App, { client: createClient() }));

    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Inbox 0" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Today 0" }));
    expect(await screen.findByText("No tasks due today")).not.toBeNull();
    expect(
      screen.getByText("Tasks due today will appear here."),
    ).not.toBeNull();
  });

  it("marks only open tasks due before the local calendar day as overdue", async () => {
    const localToday = getLocalTodayForTest();
    const overdueTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000024",
        "Overdue open task",
        inboxId,
        0,
      ),
      dueDate: "2000-01-01",
    };
    const dueTodayTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000025",
        "Due today task",
        inboxId,
        1,
      ),
      dueDate: localToday,
    };
    const futureTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000026",
        "Future task",
        inboxId,
        2,
      ),
      dueDate: "2999-12-31",
    };
    const noDateTask = createTask(
      "10000000-0000-0000-0000-000000000027",
      "No date task",
      inboxId,
      3,
    );
    const completedPastTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000028",
        "Completed past task",
        inboxId,
        4,
      ),
      dueDate: "2000-01-02",
      status: "completed",
    };

    render(
      createElement(App, {
        client: createClient([
          overdueTask,
          dueTodayTask,
          futureTask,
          noDateTask,
          completedPastTask,
        ]),
      }),
    );

    expect(await screen.findByText("Overdue open task")).not.toBeNull();
    expect(screen.getAllByText("Overdue")).toHaveLength(1);
    expect(
      screen.getByText("Overdue open task").closest("li")?.textContent,
    ).toContain("Overdue");
    expect(
      screen.getByText("Due today task").closest("li")?.textContent,
    ).not.toContain("Overdue");
    expect(
      screen.getByText("Future task").closest("li")?.textContent,
    ).not.toContain("Overdue");
    expect(
      screen.getByText("No date task").closest("li")?.textContent,
    ).not.toContain("Overdue");
    expect(
      screen.getByText("Completed past task").closest("li")?.textContent,
    ).not.toContain("Overdue");
    expect(screen.getByText("Due 2000-01-01").className).toContain(
      "status-danger",
    );
    expect(screen.getByText(`Due ${localToday}`).className).not.toContain(
      "status-danger",
    );
  });

  it("refreshes overdue state at local midnight and cleans up its timer", () => {
    vi.useFakeTimers();
    const beforeMidnight = new Date(2026, 6, 28, 23, 59, 59, 900);
    vi.setSystemTime(beforeMidnight);
    const dueTodayTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000029",
        "Becomes overdue at midnight",
        inboxId,
      ),
      dueDate: "2026-07-28",
    };
    const rendered = render(
      createElement(
        StrictMode,
        null,
        createElement(TaskWorkspace, {
          data: { categories, tasks: [dueTodayTask] },
        }),
      ),
    );

    try {
      expect(screen.queryByText("Overdue")).toBeNull();
      expect(vi.getTimerCount()).toBe(1);
      const todayButton = screen.getByRole("button", { name: "Today 1" });
      fireEvent.click(todayButton);
      expect(screen.getByText("Becomes overdue at midnight")).not.toBeNull();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole("button", { name: "Today 0" })).not.toBeNull();
      expect(screen.getByText("No tasks due today")).not.toBeNull();
      expect(vi.getTimerCount()).toBe(1);
      fireEvent.click(screen.getByRole("button", { name: "All tasks 1" }));
      expect(screen.getByText("Overdue")).not.toBeNull();

      rendered.unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      rendered.unmount();
      vi.useRealTimers();
    }
  });

  it("creates once, preserves raw input, and inserts in storage order", async () => {
    const pendingCreate = createDeferred<TaskDto>();
    const createTaskCommand = vi.fn(() => pendingCreate.promise);
    const personalTask = createTask(
      "10000000-0000-0000-0000-000000000007",
      "Personal task",
      personalId,
    );
    const client = createClient([personalTask], createTaskCommand);

    render(createElement(App, { client }));
    expect(await screen.findByText("Personal task")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "  New work task  " },
    });
    fireEvent.change(screen.getByLabelText("Task category"), {
      target: { value: workId },
    });
    const form = screen.getByRole("form", { name: "Add task" });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createTaskCommand).toHaveBeenCalledTimes(1);
    expect(createTaskCommand).toHaveBeenCalledWith({
      title: "  New work task  ",
      categoryId: workId,
    });
    expect(
      (screen.getByRole("button", { name: "Adding..." }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      pendingCreate.resolve(
        createTask(
          "10000000-0000-0000-0000-000000000008",
          "New work task",
          workId,
        ),
      );
      await pendingCreate.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Task added.",
    );
    expect(
      (screen.getByLabelText("Task title") as HTMLInputElement).value,
    ).toBe("");
    expect(document.activeElement).toBe(screen.getByLabelText("Task title"));
    expect(screen.getByRole("button", { name: "All tasks 2" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Work 1" })).not.toBeNull();
    const taskListText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(taskListText?.indexOf("New work task")).toBeLessThan(
      taskListText?.indexOf("Personal task") ?? -1,
    );
  });

  it("defaults to the active category and retains a failed draft", async () => {
    const createTaskCommand = vi.fn(async () => {
      throw new SmartSpaceCommandError("invalid_input", "invalid title");
    });
    const client = createClient([], createTaskCommand);

    render(createElement(App, { client }));
    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Personal 0" }));
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Draft task" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add task" }));

    expect(await screen.findByRole("alert")).not.toBeNull();
    expect(createTaskCommand).toHaveBeenCalledWith({
      title: "Draft task",
      categoryId: personalId,
    });
    expect(
      (screen.getByLabelText("Task title") as HTMLInputElement).value,
    ).toBe("Draft task");
    expect(
      (screen.getByRole("button", { name: "Add task" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("does not submit a blank task title", async () => {
    const createTaskCommand = vi.fn<SmartSpaceClient["createTask"]>();
    render(createElement(App, { client: createClient([], createTaskCommand) }));
    expect(await screen.findByText("No tasks yet")).not.toBeNull();

    fireEvent.submit(screen.getByRole("form", { name: "Add task" }));

    expect(createTaskCommand).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).not.toBeNull();
  });

  it("opens and cancels the category form with keyboard or button", async () => {
    render(createElement(App, { client: createClient() }));
    expect(await screen.findByText("No tasks yet")).not.toBeNull();

    const trigger = screen.getByRole("button", { name: "Add category" });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Category name");
    expect(document.activeElement).toBe(input);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.change(input, { target: { value: "Discarded by Escape" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByLabelText("Category name")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "Discarded by button" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Category name")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("creates a category once and exposes the returned DTO in storage order", async () => {
    const pendingCreate = createDeferred<CategoryDto>();
    const createCategory = vi.fn(() => pendingCreate.promise);
    const client = createClient([], undefined, undefined, createCategory);

    render(createElement(App, { client }));
    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    const trigger = screen.getByRole("button", { name: "Add category" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "  New category  " },
    });
    const form = screen.getByRole("form", { name: "Add category" });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createCategory).toHaveBeenCalledWith({ name: "  New category  " });
    expect(
      (screen.getByRole("button", { name: "Adding..." }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Sort" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Rename category: Inbox",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    const createdCategory: CategoryDto = {
      id: "00000000-0000-0000-0000-000000000004",
      name: "New category",
      position: 1,
      kind: "user",
    };
    await act(async () => {
      pendingCreate.resolve(createdCategory);
      await pendingCreate.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Category added.",
    );
    expect(screen.queryByLabelText("Category name")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    const categoryNames = Array.from(
      (screen.getByLabelText("Task category") as HTMLSelectElement).options,
      (option) => option.text,
    );
    expect(categoryNames).toEqual([
      "Inbox",
      "New category",
      "Work",
      "Personal",
    ]);
    const navigationText = screen.getByRole("navigation", {
      name: "Task categories",
    }).textContent;
    expect(navigationText?.indexOf("New category")).toBeLessThan(
      navigationText?.indexOf("Work") ?? -1,
    );
    expect(
      screen.getByRole("button", { name: "New category 0" }),
    ).not.toBeNull();
  });

  it.each([
    [
      "invalid_input",
      "Enter a valid category name.",
      new SmartSpaceCommandError("invalid_input", "invalid category"),
    ],
    [
      "duplicate category",
      "A category with this name already exists.",
      new SmartSpaceCommandError(
        "duplicate_category_name",
        "duplicate category",
      ),
    ],
    [
      "unknown failure",
      "Category could not be added. Try again.",
      new Error("offline"),
    ],
  ])(
    "retains the category draft after a %s error",
    async (_case, message, error) => {
      const createCategory = vi.fn(async () => {
        throw error;
      });
      render(
        createElement(App, {
          client: createClient([], undefined, undefined, createCategory),
        }),
      );
      expect(await screen.findByText("No tasks yet")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Add category" }));
      fireEvent.change(screen.getByLabelText("Category name"), {
        target: { value: "Retained draft" },
      });
      fireEvent.submit(screen.getByRole("form", { name: "Add category" }));

      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect(
        (screen.getByLabelText("Category name") as HTMLInputElement).value,
      ).toBe("Retained draft");
      expect(
        (screen.getByRole("button", { name: "Add" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    },
  );

  it("rejects a blank category without calling the client", async () => {
    const createCategory = vi.fn<SmartSpaceClient["createCategory"]>();
    render(
      createElement(App, {
        client: createClient([], undefined, undefined, createCategory),
      }),
    );
    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    fireEvent.submit(screen.getByRole("form", { name: "Add category" }));

    expect(createCategory).not.toHaveBeenCalled();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Enter a category name.",
    );
  });

  it("ignores a pending category create after the client session changes", async () => {
    const pendingCreate = createDeferred<CategoryDto>();
    const staleCreateCategory = vi.fn(() => pendingCreate.promise);
    const staleClient = createClient(
      [],
      undefined,
      undefined,
      staleCreateCategory,
    );
    const currentClient = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000023",
        "Current category session",
        inboxId,
      ),
    ]);
    const rendered = render(createElement(App, { client: staleClient }));

    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add category" }));
    fireEvent.change(screen.getByLabelText("Category name"), {
      target: { value: "Stale category" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add category" }));
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current category session")).not.toBeNull();

    await act(async () => {
      pendingCreate.resolve({
        id: "00000000-0000-0000-0000-000000000005",
        name: "Stale category",
        position: 3,
        kind: "user",
      });
      await pendingCreate.promise;
    });

    expect(screen.queryByText("Stale category")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      Array.from(
        (screen.getByLabelText("Task category") as HTMLSelectElement).options,
        (option) => option.text,
      ),
    ).toEqual(["Inbox", "Work", "Personal"]);
  });

  it("renames a category once from the backend DTO and updates its consumers", async () => {
    const pendingRename = createDeferred<CategoryDto>();
    const renameCategory = vi.fn(() => pendingRename.promise);
    const task = createTask(
      "10000000-0000-0000-0000-000000000052",
      "Categorized task",
      workId,
    );
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          renameCategory,
        ),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Work 1" }));
    const trigger = screen.getByRole("button", {
      name: "Rename category: Work",
    });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Name for Work") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Work".length);
    const saveButton = screen.getByRole("button", {
      name: "Save category name: Work",
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  Work  " } });
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  Backend Work  " } });
    expect(saveButton.disabled).toBe(false);
    const form = screen.getByRole("form", { name: "Rename category: Work" });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(renameCategory).toHaveBeenCalledTimes(1);
    expect(renameCategory).toHaveBeenCalledWith({
      categoryId: workId,
      name: "  Backend Work  ",
    });
    expect(saveButton.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Work 1" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Sort" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Add category",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      pendingRename.resolve({
        ...categories[1],
        name: "Backend Work",
      });
      await pendingRename.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Category renamed.",
    );
    expect(
      screen.getByRole("heading", { name: "Backend Work" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Backend Work 1" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Edit category for task: Categorized task",
      }).textContent,
    ).toBe("Backend Work");
    expect(
      Array.from(
        (screen.getByLabelText("Task category") as HTMLSelectElement).options,
        (option) => option.text,
      ),
    ).toEqual(["Inbox", "Backend Work", "Personal"]);
    const renamedTrigger = screen.getByRole("button", {
      name: "Rename category: Backend Work",
    });
    expect(document.activeElement).toBe(renamedTrigger);
  });

  it("cancels a category rename with Escape or Cancel and restores focus", async () => {
    const renameCategory = vi.fn<SmartSpaceClient["renameCategory"]>();
    render(
      createElement(App, {
        client: createClient(
          [],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          renameCategory,
        ),
      }),
    );
    expect(await screen.findByText("No tasks yet")).not.toBeNull();

    const trigger = screen.getByRole("button", {
      name: "Rename category: Inbox",
    });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Name for Inbox") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Inbox".length);
    const saveButton = screen.getByRole("button", {
      name: "Save category name: Inbox",
    }) as HTMLButtonElement;
    fireEvent.change(input, { target: { value: "   " } });
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Discard with Escape" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByLabelText("Name for Inbox")).toBeNull();
    expect(renameCategory).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const reopenedInput = screen.getByLabelText(
      "Name for Inbox",
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe("Inbox");
    fireEvent.change(reopenedInput, {
      target: { value: "Discard with Cancel" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel category rename: Inbox" }),
    );

    expect(screen.queryByLabelText("Name for Inbox")).toBeNull();
    expect(renameCategory).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it.each([
    [
      "invalid input",
      new SmartSpaceCommandError("invalid_input", "invalid category"),
      "Enter a valid category name.",
    ],
    [
      "duplicate category",
      new SmartSpaceCommandError(
        "duplicate_category_name",
        "duplicate category",
      ),
      "A category with this name already exists.",
    ],
    [
      "missing category",
      new SmartSpaceCommandError("category_not_found", "missing category"),
      "This category is no longer available.",
    ],
    [
      "unknown failure",
      new Error("offline"),
      "Category name could not be updated. Try again.",
    ],
  ])(
    "retains the category rename draft after %s",
    async (_case, error, message) => {
      const renameCategory = vi.fn(async () => {
        throw error;
      });
      render(
        createElement(App, {
          client: createClient(
            [],
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            renameCategory,
          ),
        }),
      );
      expect(await screen.findByText("No tasks yet")).not.toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Rename category: Work" }),
      );
      const input = screen.getByLabelText("Name for Work");
      fireEvent.change(input, { target: { value: "Retained rename" } });
      fireEvent.submit(
        screen.getByRole("form", { name: "Rename category: Work" }),
      );

      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect((input as HTMLInputElement).value).toBe("Retained rename");
      expect(
        (
          screen.getByRole("button", {
            name: "Save category name: Work",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    },
  );

  it("ignores a pending category rename after the client session changes", async () => {
    const pendingRename = createDeferred<CategoryDto>();
    const staleRenameCategory = vi.fn(() => pendingRename.promise);
    const staleClient = createClient(
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      staleRenameCategory,
    );
    const currentClient = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000053",
        "Current rename category session",
        workId,
      ),
    ]);
    const rendered = render(createElement(App, { client: staleClient }));

    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Rename category: Work" }),
    );
    fireEvent.change(screen.getByLabelText("Name for Work"), {
      target: { value: "Stale Work" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save category name: Work" }),
    );
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(
      await screen.findByText("Current rename category session"),
    ).not.toBeNull();

    await act(async () => {
      pendingRename.resolve({ ...categories[1], name: "Stale Work" });
      await pendingRename.promise;
    });

    expect(screen.queryByText("Stale Work")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Rename category: Work" }),
    ).not.toBeNull();
  });

  it("enters and exits category sorting with boundary controls", async () => {
    const reorderCategories = vi.fn<SmartSpaceClient["reorderCategories"]>();
    render(
      createElement(App, {
        client: createClient(
          [],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          reorderCategories,
        ),
      }),
    );
    expect(await screen.findByText("No tasks yet")).not.toBeNull();

    const sortButton = screen.getByRole("button", { name: "Sort" });
    fireEvent.click(sortButton);

    const doneButton = screen.getByRole("button", { name: "Done" });
    expect(doneButton).toBe(sortButton);
    expect(doneButton.getAttribute("aria-pressed")).toBe("true");
    expect(
      (
        screen.getByRole("button", {
          name: "Add category",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Move category earlier: Inbox",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Move category later: Inbox",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Move category earlier: Work",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(
      (
        screen.getByRole("button", {
          name: "Move category later: Personal",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Rename category: Work" }),
    ).toBeNull();

    fireEvent.click(doneButton);

    expect(screen.getByRole("button", { name: "Sort" })).toBe(sortButton);
    expect(
      screen.queryByRole("button", {
        name: "Move category earlier: Work",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Rename category: Work" }),
    ).not.toBeNull();
    expect(reorderCategories).not.toHaveBeenCalled();
  });

  it("persists a complete category order and rebuilds dependent storage order", async () => {
    const pendingReorder = createDeferred<readonly CategoryDto[]>();
    const reorderCategories = vi.fn(() => pendingReorder.promise);
    const inboxTask = createTask(
      "10000000-0000-0000-0000-000000000054",
      "Inbox ordered task",
      inboxId,
    );
    const workTask = createTask(
      "10000000-0000-0000-0000-000000000055",
      "Work ordered task",
      workId,
    );
    const personalTask = createTask(
      "10000000-0000-0000-0000-000000000056",
      "Personal ordered task",
      personalId,
    );
    render(
      createElement(App, {
        client: createClient(
          [inboxTask, workTask, personalTask],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          reorderCategories,
        ),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Work 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sort" }));
    const moveEarlier = screen.getByRole("button", {
      name: "Move category earlier: Personal",
    });
    fireEvent.click(moveEarlier);
    fireEvent.click(moveEarlier);

    expect(reorderCategories).toHaveBeenCalledTimes(1);
    expect(reorderCategories).toHaveBeenCalledWith({
      orderedCategoryIds: [inboxId, personalId, workId],
    });
    expect(
      (screen.getByRole("button", { name: "Done" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Move category later: Inbox",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Add category",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      pendingReorder.resolve([
        { ...categories[0], position: 0 },
        { ...categories[2], position: 1 },
        { ...categories[1], position: 2 },
      ]);
      await pendingReorder.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Personal moved earlier.",
    );
    const movedControl = screen.getByRole("button", {
      name: "Move category earlier: Personal",
    });
    expect(document.activeElement).toBe(movedControl);
    expect(
      screen
        .getByRole("button", { name: "Work 1" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      Array.from(
        (screen.getByLabelText("Task category") as HTMLSelectElement).options,
        (option) => option.text,
      ),
    ).toEqual(["Inbox", "Personal", "Work"]);

    fireEvent.click(screen.getByRole("button", { name: "All tasks 3" }));
    const taskListText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(taskListText?.indexOf("Inbox ordered task")).toBeLessThan(
      taskListText?.indexOf("Personal ordered task") ?? -1,
    );
    expect(taskListText?.indexOf("Personal ordered task")).toBeLessThan(
      taskListText?.indexOf("Work ordered task") ?? -1,
    );
  });

  it.each([
    [
      "invalid input",
      new SmartSpaceCommandError("invalid_input", "stale category order"),
      "Category order changed. Try again.",
    ],
    [
      "unknown failure",
      new Error("offline"),
      "Categories could not be reordered. Try again.",
    ],
  ])(
    "keeps the category order after a %s reorder failure",
    async (_case, error, message) => {
      const reorderCategories = vi.fn(async () => {
        throw error;
      });
      render(
        createElement(App, {
          client: createClient(
            [],
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            reorderCategories,
          ),
        }),
      );
      expect(await screen.findByText("No tasks yet")).not.toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Sort" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Move category later: Inbox" }),
      );

      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect(reorderCategories).toHaveBeenCalledWith({
        orderedCategoryIds: [workId, inboxId, personalId],
      });
      expect(
        Array.from(
          (screen.getByLabelText("Task category") as HTMLSelectElement).options,
          (option) => option.text,
        ),
      ).toEqual(["Inbox", "Work", "Personal"]);
      expect(
        (
          screen.getByRole("button", {
            name: "Move category later: Inbox",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    },
  );

  it("ignores a pending category reorder after the client session changes", async () => {
    const pendingReorder = createDeferred<readonly CategoryDto[]>();
    const staleReorderCategories = vi.fn(() => pendingReorder.promise);
    const staleClient = createClient(
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      staleReorderCategories,
    );
    const currentClient = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000057",
        "Current reorder session",
        inboxId,
      ),
    ]);
    const rendered = render(createElement(App, { client: staleClient }));

    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sort" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Move category later: Inbox" }),
    );
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current reorder session")).not.toBeNull();

    await act(async () => {
      pendingReorder.resolve([
        { ...categories[1], position: 0 },
        { ...categories[0], position: 1 },
        { ...categories[2], position: 2 },
      ]);
      await pendingReorder.promise;
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Sort" })).not.toBeNull();
    expect(
      Array.from(
        (screen.getByLabelText("Task category") as HTMLSelectElement).options,
        (option) => option.text,
      ),
    ).toEqual(["Inbox", "Work", "Personal"]);
  });

  it("confirms category deletion and restores focus after cancel or Escape", async () => {
    const deleteCategory = vi.fn<SmartSpaceClient["deleteCategory"]>();
    render(
      createElement(App, {
        client: createClient(
          [],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          deleteCategory,
        ),
      }),
    );
    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: "Delete category: Inbox" }),
    ).toBeNull();

    const workDeleteTrigger = screen.getByRole("button", {
      name: "Delete category: Work",
    });
    fireEvent.click(workDeleteTrigger);
    const workDeleteForm = screen.getByRole("form", {
      name: "Delete category: Work",
    });
    expect(workDeleteForm.textContent).toContain(
      "Delete Work? 0 tasks will move to Inbox.",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Cancel" }),
    );
    fireEvent.keyDown(workDeleteForm, { key: "Escape" });
    expect(screen.queryByText("Delete Work?")).toBeNull();
    expect(document.activeElement).toBe(workDeleteTrigger);

    const personalDeleteTrigger = screen.getByRole("button", {
      name: "Delete category: Personal",
    });
    fireEvent.click(personalDeleteTrigger);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(personalDeleteTrigger);
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("deletes the current category and rebuilds migrated task storage order", async () => {
    const pendingDelete = createDeferred<DeleteCategoryResultDto>();
    const deleteCategory = vi.fn(() => pendingDelete.promise);
    const inboxTask = createTask(
      "10000000-0000-0000-0000-000000000058",
      "Inbox before migration",
      inboxId,
    );
    const firstWorkTask = createTask(
      "10000000-0000-0000-0000-000000000059",
      "First migrated task",
      workId,
      0,
    );
    const secondWorkTask = createTask(
      "10000000-0000-0000-0000-000000000060",
      "Second migrated task",
      workId,
      1,
    );
    const personalTask = createTask(
      "10000000-0000-0000-0000-000000000061",
      "Personal after migration",
      personalId,
    );
    render(
      createElement(App, {
        client: createClient(
          [inboxTask, firstWorkTask, secondWorkTask, personalTask],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          deleteCategory,
        ),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Work 2" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Work" }),
    );
    const deleteButton = screen.getByRole("button", { name: /^Delete$/ });
    fireEvent.click(deleteButton);
    fireEvent.click(deleteButton);

    expect(deleteCategory).toHaveBeenCalledTimes(1);
    expect(deleteCategory).toHaveBeenCalledWith({ categoryId: workId });
    expect(
      (screen.getByRole("button", { name: "Sort" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Add category",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Rename category: Personal",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Delete category: Personal",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      pendingDelete.resolve({
        categoryId: workId,
        migratedTaskCount: 2,
        categories: [categories[0], { ...categories[2], position: 1 }],
        tasks: [
          inboxTask,
          {
            ...firstWorkTask,
            categoryId: inboxId,
            position: 1,
            updatedAt: "2026-07-28T09:00:02.000000003Z",
          },
          {
            ...secondWorkTask,
            categoryId: inboxId,
            position: 2,
            updatedAt: "2026-07-28T09:00:02.000000003Z",
          },
          personalTask,
        ],
      });
      await pendingDelete.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Work deleted. 2 tasks moved to Inbox.",
    );
    expect(screen.queryByRole("button", { name: "Work 2" })).toBeNull();
    const inboxButton = screen.getByRole("button", { name: "Inbox 3" });
    expect(inboxButton.getAttribute("aria-current")).toBe("page");
    const inboxHeading = screen.getByRole("heading", { name: "Inbox" });
    expect(document.activeElement).toBe(inboxHeading);
    expect(
      Array.from(
        (screen.getByLabelText("Task category") as HTMLSelectElement).options,
        (option) => option.text,
      ),
    ).toEqual(["Inbox", "Personal"]);
    expect(
      screen.getByRole("button", {
        name: "Edit category for task: First migrated task",
      }).textContent,
    ).toBe("Inbox");
    expect(
      screen.getByRole("button", {
        name: "Edit category for task: Second migrated task",
      }).textContent,
    ).toBe("Inbox");

    fireEvent.click(screen.getByRole("button", { name: "All tasks 4" }));
    const taskListText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(taskListText?.indexOf("Inbox before migration")).toBeLessThan(
      taskListText?.indexOf("First migrated task") ?? -1,
    );
    expect(taskListText?.indexOf("First migrated task")).toBeLessThan(
      taskListText?.indexOf("Second migrated task") ?? -1,
    );
    expect(taskListText?.indexOf("Second migrated task")).toBeLessThan(
      taskListText?.indexOf("Personal after migration") ?? -1,
    );
  });

  it("focuses the neighboring category after deleting an inactive category", async () => {
    const deleteCategory = vi.fn(async () => ({
      categoryId: personalId,
      migratedTaskCount: 0,
      categories: categories.slice(0, 2),
      tasks: [],
    }));
    render(
      createElement(App, {
        client: createClient(
          [],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          deleteCategory,
        ),
      }),
    );
    expect(await screen.findByText("No tasks yet")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Personal" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    const workButton = await screen.findByRole("button", { name: "Work 0" });
    await waitFor(() => expect(document.activeElement).toBe(workButton));
    expect(
      screen
        .getByRole("button", { name: "All tasks 0" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("uses the command-returned category id for deletion feedback and focus", async () => {
    const projectsId = "00000000-0000-0000-0000-000000000004";
    const extendedCategories: readonly CategoryDto[] = [
      ...categories,
      { id: projectsId, name: "Projects", position: 3, kind: "user" },
    ];
    const deleteCategory = vi.fn(async () => ({
      categoryId: workId,
      migratedTaskCount: 0,
      categories: [
        extendedCategories[0],
        { ...extendedCategories[2], position: 1 },
        { ...extendedCategories[3], position: 2 },
      ],
      tasks: [],
    }));
    render(
      createElement(App, {
        client: createClient(
          [],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          deleteCategory,
          extendedCategories,
        ),
      }),
    );
    expect(await screen.findByText("No tasks yet")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Projects" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    expect((await screen.findByRole("status")).textContent).toContain(
      "Work deleted. 0 tasks moved to Inbox.",
    );
    expect(screen.queryByRole("button", { name: "Work 0" })).toBeNull();
    expect(
      screen.queryByRole("form", { name: "Delete category: Projects" }),
    ).toBeNull();
    const personalButton = screen.getByRole("button", { name: "Personal 0" });
    expect(document.activeElement).toBe(personalButton);
  });

  it.each([
    [
      "missing category",
      new SmartSpaceCommandError("category_not_found", "missing"),
      "This category is no longer available.",
    ],
    [
      "unknown failure",
      new Error("offline"),
      "Category could not be deleted. Try again.",
    ],
  ])(
    "keeps the confirmation open after a %s deletion failure",
    async (_case, error, message) => {
      const deleteCategory = vi.fn(async () => {
        throw error;
      });
      render(
        createElement(App, {
          client: createClient(
            [],
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            deleteCategory,
          ),
        }),
      );
      expect(await screen.findByText("No tasks yet")).not.toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Delete category: Work" }),
      );
      fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect(
        screen.getByRole("form", { name: "Delete category: Work" }),
      ).not.toBeNull();
      expect(
        (screen.getByRole("button", { name: /^Delete$/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      expect(screen.getByRole("button", { name: "Work 0" })).not.toBeNull();
    },
  );

  it("ignores a pending category deletion after the client session changes", async () => {
    const pendingDelete = createDeferred<DeleteCategoryResultDto>();
    const staleDeleteCategory = vi.fn(() => pendingDelete.promise);
    const staleClient = createClient(
      [],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      staleDeleteCategory,
    );
    const currentClient = createClient([
      createTask(
        "10000000-0000-0000-0000-000000000062",
        "Current deletion session",
        workId,
      ),
    ]);
    const rendered = render(createElement(App, { client: staleClient }));
    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Work" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));

    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current deletion session")).not.toBeNull();
    await act(async () => {
      pendingDelete.resolve({
        categoryId: workId,
        migratedTaskCount: 0,
        categories: [categories[0], { ...categories[2], position: 1 }],
        tasks: [],
      });
      await pendingDelete.promise;
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Work 1" })).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete category: Work" }),
    ).not.toBeNull();
  });

  it("waits for pending task creation before deleting its category", async () => {
    const pendingCreate = createDeferred<TaskDto>();
    const pendingDelete = createDeferred<DeleteCategoryResultDto>();
    const createTaskCommand = vi.fn(() => pendingCreate.promise);
    const deleteCategory = vi.fn(() => pendingDelete.promise);
    const createdTask = createTask(
      "10000000-0000-0000-0000-000000000063",
      "Created before category deletion",
      workId,
    );
    const migratedTask = {
      ...createdTask,
      categoryId: inboxId,
      updatedAt: "2026-07-28T09:00:03.000000004Z",
    };
    render(
      createElement(App, {
        client: createClient(
          [],
          createTaskCommand,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          deleteCategory,
        ),
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Work 0" }));
    fireEvent.change(screen.getByLabelText("Task title"), {
      target: { value: "Created before category deletion" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Add task" }));
    expect(createTaskCommand).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Work" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(deleteCategory).not.toHaveBeenCalled();

    await act(async () => {
      pendingCreate.resolve(createdTask);
      await pendingCreate.promise;
    });
    await waitFor(() => expect(deleteCategory).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingDelete.resolve({
        categoryId: workId,
        migratedTaskCount: 1,
        categories: [categories[0], { ...categories[2], position: 1 }],
        tasks: [migratedTask],
      });
      await pendingDelete.promise;
    });

    expect(screen.queryByRole("button", { name: "Work 1" })).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Edit category for task: Created before category deletion",
      }).textContent,
    ).toBe("Inbox");
  });

  it("waits for a pending task rename before applying the deletion snapshot", async () => {
    const pendingRename = createDeferred<TaskDto>();
    const pendingDelete = createDeferred<DeleteCategoryResultDto>();
    const renameTask = vi.fn(() => pendingRename.promise);
    const deleteCategory = vi.fn(() => pendingDelete.promise);
    const task = createTask(
      "10000000-0000-0000-0000-000000000064",
      "Rename before deletion",
      workId,
    );
    const renamedTask = {
      ...task,
      title: "Renamed before deletion",
      updatedAt: "2026-07-28T09:00:02.000000003Z",
    };
    const migratedTask = {
      ...renamedTask,
      categoryId: inboxId,
      updatedAt: "2026-07-28T09:00:03.000000004Z",
    };
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          renameTask,
          undefined,
          undefined,
          deleteCategory,
        ),
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit title for task: Rename before deletion",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Title for Rename before deletion"),
      {
        target: { value: "Renamed before deletion" },
      },
    );
    fireEvent.submit(
      screen.getByRole("form", {
        name: "Edit title for task: Rename before deletion",
      }),
    );
    expect(renameTask).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Work" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(deleteCategory).not.toHaveBeenCalled();

    await act(async () => {
      pendingRename.resolve(renamedTask);
      await pendingRename.promise;
    });
    await waitFor(() => expect(deleteCategory).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingDelete.resolve({
        categoryId: workId,
        migratedTaskCount: 1,
        categories: [categories[0], { ...categories[2], position: 1 }],
        tasks: [migratedTask],
      });
      await pendingDelete.promise;
    });

    expect(
      screen.getByRole("button", {
        name: "Edit category for task: Renamed before deletion",
      }).textContent,
    ).toBe("Inbox");
  });

  it("waits for a pending task move before deleting its target category", async () => {
    const pendingMove = createDeferred<TaskDto>();
    const pendingDelete = createDeferred<DeleteCategoryResultDto>();
    const moveTask = vi.fn(() => pendingMove.promise);
    const deleteCategory = vi.fn(() => pendingDelete.promise);
    const task = createTask(
      "10000000-0000-0000-0000-000000000065",
      "Move before deletion",
      workId,
    );
    const movedTask = {
      ...task,
      categoryId: personalId,
      updatedAt: "2026-07-28T09:00:02.000000003Z",
    };
    const migratedTask = {
      ...movedTask,
      categoryId: inboxId,
      updatedAt: "2026-07-28T09:00:03.000000004Z",
    };
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          moveTask,
          undefined,
          undefined,
          undefined,
          deleteCategory,
        ),
      }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit category for task: Move before deletion",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Category for Move before deletion"),
      {
        target: { value: personalId },
      },
    );
    fireEvent.submit(
      screen.getByRole("form", {
        name: "Edit category for task: Move before deletion",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete category: Personal" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(deleteCategory).not.toHaveBeenCalled();

    await act(async () => {
      pendingMove.resolve(movedTask);
      await pendingMove.promise;
    });
    await waitFor(() => expect(deleteCategory).toHaveBeenCalledTimes(1));
    await act(async () => {
      pendingDelete.resolve({
        categoryId: personalId,
        migratedTaskCount: 1,
        categories: categories.slice(0, 2),
        tasks: [migratedTask],
      });
      await pendingDelete.promise;
    });

    expect(
      screen.getByRole("button", {
        name: "Edit category for task: Move before deletion",
      }).textContent,
    ).toBe("Inbox");
  });

  it("completes once, then reopens the same task from returned DTOs", async () => {
    const pendingCompletion = createDeferred<TaskDto>();
    const openTask = createTask(
      "10000000-0000-0000-0000-000000000013",
      "Toggle task",
      workId,
    );
    const completedTask: TaskDto = {
      ...openTask,
      status: "completed",
      updatedAt: "2026-07-28T10:00:00.000000001Z",
    };
    const reopenedTask: TaskDto = {
      ...completedTask,
      status: "open",
      updatedAt: "2026-07-28T10:01:00.000000001Z",
    };
    const setTaskStatus = vi
      .fn<SmartSpaceClient["setTaskStatus"]>()
      .mockImplementationOnce(() => pendingCompletion.promise)
      .mockResolvedValueOnce(reopenedTask);
    const client = createClient([openTask], undefined, setTaskStatus);

    render(createElement(App, { client }));
    expect(await screen.findByText("Toggle task")).not.toBeNull();
    const completeButton = screen.getByRole("button", {
      name: "Complete task: Toggle task",
    });
    fireEvent.click(completeButton);
    fireEvent.click(completeButton);

    expect(setTaskStatus).toHaveBeenCalledTimes(1);
    expect(setTaskStatus).toHaveBeenCalledWith({
      taskId: openTask.id,
      status: "completed",
    });
    const updatingButton = screen.getByRole("button", {
      name: "Updating task: Toggle task",
    }) as HTMLButtonElement;
    expect(updatingButton.disabled).toBe(true);
    expect(updatingButton.closest("li")?.getAttribute("aria-busy")).toBe(
      "true",
    );

    await act(async () => {
      pendingCompletion.resolve(completedTask);
      await pendingCompletion.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Task completed.",
    );
    const reopenButton = screen.getByRole("button", {
      name: "Reopen task: Toggle task",
    });
    expect(reopenButton.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Toggle task").className).toContain("line-through");
    expect(screen.getByRole("button", { name: "All tasks 1" })).not.toBeNull();

    fireEvent.click(reopenButton);
    expect(setTaskStatus).toHaveBeenNthCalledWith(2, {
      taskId: openTask.id,
      status: "open",
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Task reopened.",
    );
    expect(
      screen.getByRole("button", { name: "Complete task: Toggle task" }),
    ).not.toBeNull();
    expect(screen.getByText("Toggle task").className).not.toContain(
      "line-through",
    );
  });

  it("keeps the task unchanged and retryable after a status failure", async () => {
    const openTask = createTask(
      "10000000-0000-0000-0000-000000000014",
      "Retry status task",
      inboxId,
    );
    const setTaskStatus = vi.fn(async () => {
      throw new SmartSpaceCommandError("task_not_found", "missing task");
    });
    const client = createClient([openTask], undefined, setTaskStatus);

    render(createElement(App, { client }));
    const button = await screen.findByRole("button", {
      name: "Complete task: Retry status task",
    });
    fireEvent.click(button);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "This task is no longer available.",
    );
    const retryButton = screen.getByRole("button", {
      name: "Complete task: Retry status task",
    }) as HTMLButtonElement;
    expect(retryButton.disabled).toBe(false);
    expect(retryButton.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Retry status task").className).not.toContain(
      "line-through",
    );

    fireEvent.click(retryButton);
    await waitFor(() => expect(setTaskStatus).toHaveBeenCalledTimes(2));
  });

  it("updates different tasks independently when responses finish out of order", async () => {
    const firstUpdate = createDeferred<TaskDto>();
    const secondUpdate = createDeferred<TaskDto>();
    const firstTask = createTask(
      "10000000-0000-0000-0000-000000000017",
      "First concurrent task",
      workId,
    );
    const secondTask = createTask(
      "10000000-0000-0000-0000-000000000018",
      "Second concurrent task",
      personalId,
    );
    const setTaskStatus = vi
      .fn<SmartSpaceClient["setTaskStatus"]>()
      .mockImplementationOnce(() => firstUpdate.promise)
      .mockImplementationOnce(() => secondUpdate.promise);
    const client = createClient(
      [firstTask, secondTask],
      undefined,
      setTaskStatus,
    );

    render(createElement(App, { client }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Complete task: First concurrent task",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Complete task: Second concurrent task",
      }),
    );

    expect(setTaskStatus).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", {
        name: "Updating task: First concurrent task",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Updating task: Second concurrent task",
      }),
    ).not.toBeNull();

    await act(async () => {
      secondUpdate.resolve({ ...secondTask, status: "completed" });
      await secondUpdate.promise;
    });

    expect(
      screen.getByRole("button", {
        name: "Updating task: First concurrent task",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Reopen task: Second concurrent task",
      }),
    ).not.toBeNull();

    await act(async () => {
      firstUpdate.resolve({ ...firstTask, status: "completed" });
      await firstUpdate.promise;
    });

    expect(
      screen.getByRole("button", {
        name: "Reopen task: First concurrent task",
      }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Reopen task: Second concurrent task",
      }),
    ).not.toBeNull();
  });

  it("ignores a pending status result after the client session changes", async () => {
    const pendingStatus = createDeferred<TaskDto>();
    const staleTask = createTask(
      "10000000-0000-0000-0000-000000000015",
      "Stale status task",
      inboxId,
    );
    const staleSetTaskStatus = vi.fn(() => pendingStatus.promise);
    const staleClient = createClient(
      [staleTask],
      undefined,
      staleSetTaskStatus,
    );
    const currentTask = createTask(
      "10000000-0000-0000-0000-000000000016",
      "Current status task",
      inboxId,
    );
    const currentClient = createClient([currentTask]);
    const rendered = render(createElement(App, { client: staleClient }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Complete task: Stale status task",
      }),
    );
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current status task")).not.toBeNull();

    await act(async () => {
      pendingStatus.resolve({ ...staleTask, status: "completed" });
      await pendingStatus.promise;
    });

    expect(screen.queryByText("Stale status task")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Complete task: Current status task",
      }),
    ).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("sets and clears a due date using returned task DTOs", async () => {
    const pendingUpdate = createDeferred<TaskDto>();
    const originalTask: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000024",
        "Schedule task",
        workId,
      ),
      dueDate: "2026-08-01",
    };
    const datedTask: TaskDto = {
      ...originalTask,
      dueDate: "2026-08-03",
      updatedAt: "2026-07-28T11:00:00.000000001Z",
    };
    const clearedTask: TaskDto = {
      ...datedTask,
      dueDate: null,
      updatedAt: "2026-07-28T11:01:00.000000001Z",
    };
    const setTaskDueDate = vi
      .fn<SmartSpaceClient["setTaskDueDate"]>()
      .mockImplementationOnce(() => pendingUpdate.promise)
      .mockResolvedValueOnce(clearedTask);
    render(
      createElement(App, {
        client: createClient(
          [originalTask],
          undefined,
          undefined,
          undefined,
          setTaskDueDate,
        ),
      }),
    );

    const trigger = await screen.findByRole("button", {
      name: "Edit due date for task: Schedule task",
    });
    expect(trigger.textContent).toBe("Due 2026-08-01");
    fireEvent.click(trigger);
    const input = screen.getByLabelText(
      "Due date for Schedule task",
    ) as HTMLInputElement;
    expect(input.value).toBe("2026-08-01");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "2026-08-03" } });
    const form = screen.getByRole("form", {
      name: "Edit due date for task: Schedule task",
    });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(setTaskDueDate).toHaveBeenCalledTimes(1);
    expect(setTaskDueDate).toHaveBeenCalledWith({
      taskId: originalTask.id,
      dueDate: "2026-08-03",
    });
    expect(
      (screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Updating task: Schedule task",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      pendingUpdate.resolve(datedTask);
      await pendingUpdate.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Due date updated.",
    );
    const updatedTrigger = screen.getByRole("button", {
      name: "Edit due date for task: Schedule task",
    });
    expect(updatedTrigger.textContent).toBe("Due 2026-08-03");
    expect(document.activeElement).toBe(updatedTrigger);

    fireEvent.click(updatedTrigger);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(setTaskDueDate).toHaveBeenNthCalledWith(2, {
      taskId: originalTask.id,
      dueDate: null,
    });
    expect((await screen.findByRole("status")).textContent).toContain(
      "Due date cleared.",
    );
    expect(
      screen.getByRole("button", {
        name: "Edit due date for task: Schedule task",
      }).textContent,
    ).toBe("Add due date");
  });

  it("cancels a due date draft with Escape and restores focus", async () => {
    const task: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000025",
        "Keep original date",
        inboxId,
      ),
      dueDate: "2026-08-04",
    };
    const setTaskDueDate = vi.fn<SmartSpaceClient["setTaskDueDate"]>();
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          setTaskDueDate,
        ),
      }),
    );

    const trigger = await screen.findByRole("button", {
      name: "Edit due date for task: Keep original date",
    });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Due date for Keep original date");
    fireEvent.change(input, { target: { value: "2026-08-09" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(
      screen.queryByLabelText("Due date for Keep original date"),
    ).toBeNull();
    expect(setTaskDueDate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(
      (
        screen.getByLabelText(
          "Due date for Keep original date",
        ) as HTMLInputElement
      ).value,
    ).toBe("2026-08-04");
  });

  it.each([
    [
      "invalid input",
      new SmartSpaceCommandError("invalid_input", "invalid date"),
      "Enter a valid due date.",
    ],
    [
      "missing task",
      new SmartSpaceCommandError("task_not_found", "missing task"),
      "This task is no longer available.",
    ],
    [
      "unknown failure",
      new Error("offline"),
      "Due date could not be updated. Try again.",
    ],
  ])("retains the due date draft after %s", async (_case, error, message) => {
    const task = createTask(
      "10000000-0000-0000-0000-000000000026",
      "Retry date task",
      inboxId,
    );
    const setTaskDueDate = vi.fn(async () => {
      throw error;
    });
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          setTaskDueDate,
        ),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit due date for task: Retry date task",
      }),
    );
    const input = screen.getByLabelText("Due date for Retry date task");
    fireEvent.change(input, { target: { value: "2026-08-05" } });
    fireEvent.submit(
      screen.getByRole("form", {
        name: "Edit due date for task: Retry date task",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect((input as HTMLInputElement).value).toBe("2026-08-05");
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("updates Today and overdue state after setting a due date", async () => {
    const today = getLocalTodayForTest();
    const task = createTask(
      "10000000-0000-0000-0000-000000000027",
      "Date-derived task",
      personalId,
    );
    const setTaskDueDate = vi
      .fn<SmartSpaceClient["setTaskDueDate"]>()
      .mockResolvedValue({ ...task, dueDate: today });
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          setTaskDueDate,
        ),
      }),
    );

    expect(
      await screen.findByRole("button", { name: "Today 0" }),
    ).not.toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit due date for task: Date-derived task",
      }),
    );
    fireEvent.change(screen.getByLabelText("Due date for Date-derived task"), {
      target: { value: today },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const todayButton = await screen.findByRole("button", { name: "Today 1" });
    fireEvent.click(todayButton);
    expect(screen.getByText("Date-derived task")).not.toBeNull();
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it("focuses the Today heading when clearing a date removes the edited task", async () => {
    const today = getLocalTodayForTest();
    const task: TaskDto = {
      ...createTask(
        "10000000-0000-0000-0000-000000000030",
        "Leave Today after clearing",
        inboxId,
      ),
      dueDate: today,
    };
    const setTaskDueDate = vi
      .fn<SmartSpaceClient["setTaskDueDate"]>()
      .mockResolvedValue({ ...task, dueDate: null });
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          setTaskDueDate,
        ),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Today 1" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit due date for task: Leave Today after clearing",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(await screen.findByText("No tasks due today")).not.toBeNull();
    expect(setTaskDueDate).toHaveBeenCalledWith({
      taskId: task.id,
      dueDate: null,
    });
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Today", level: 2 }),
    );
  });

  it("ignores a pending due date result after the client session changes", async () => {
    const pendingDueDate = createDeferred<TaskDto>();
    const staleTask = createTask(
      "10000000-0000-0000-0000-000000000028",
      "Stale due date task",
      inboxId,
    );
    const staleSetTaskDueDate = vi.fn(() => pendingDueDate.promise);
    const staleClient = createClient(
      [staleTask],
      undefined,
      undefined,
      undefined,
      staleSetTaskDueDate,
    );
    const currentTask = createTask(
      "10000000-0000-0000-0000-000000000029",
      "Current due date task",
      inboxId,
    );
    const currentClient = createClient([currentTask]);
    const rendered = render(createElement(App, { client: staleClient }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit due date for task: Stale due date task",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Due date for Stale due date task"),
      {
        target: { value: "2026-08-06" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current due date task")).not.toBeNull();

    await act(async () => {
      pendingDueDate.resolve({ ...staleTask, dueDate: "2026-08-06" });
      await pendingDueDate.promise;
    });

    expect(screen.queryByText("Stale due date task")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Edit due date for task: Current due date task",
      }).textContent,
    ).toBe("Add due date");
  });

  it("moves a task once and rebuilds counts and storage order", async () => {
    const pendingMove = createDeferred<TaskDto>();
    const inboxTask = createTask(
      "10000000-0000-0000-0000-000000000031",
      "Inbox before moved task",
      inboxId,
    );
    const taskToMove = createTask(
      "10000000-0000-0000-0000-000000000032",
      "Move between categories",
      workId,
    );
    const personalTask = createTask(
      "10000000-0000-0000-0000-000000000033",
      "Personal before moved task",
      personalId,
    );
    const movedTask: TaskDto = {
      ...taskToMove,
      categoryId: personalId,
      position: 1,
      updatedAt: "2026-07-28T12:00:00.000000001Z",
    };
    const moveTask = vi.fn(() => pendingMove.promise);
    render(
      createElement(App, {
        client: createClient(
          [inboxTask, taskToMove, personalTask],
          undefined,
          undefined,
          undefined,
          undefined,
          moveTask,
        ),
      }),
    );

    const trigger = await screen.findByRole("button", {
      name: "Edit category for task: Move between categories",
    });
    expect(trigger.textContent).toBe("Work");
    fireEvent.click(trigger);
    const select = screen.getByLabelText(
      "Category for Move between categories",
    ) as HTMLSelectElement;
    expect(select.value).toBe(workId);
    expect(document.activeElement).toBe(select);
    expect(
      (
        screen.getByRole("button", {
          name: "Move task: Move between categories",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(select, { target: { value: personalId } });
    const form = screen.getByRole("form", {
      name: "Edit category for task: Move between categories",
    });
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(moveTask).toHaveBeenCalledTimes(1);
    });
    expect(moveTask).toHaveBeenCalledWith({
      taskId: taskToMove.id,
      categoryId: personalId,
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Move task: Move between categories",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Updating task: Move between categories",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Edit due date for task: Move between categories",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      pendingMove.resolve(movedTask);
      await pendingMove.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Task moved to Personal.",
    );
    const movedTrigger = screen.getByRole("button", {
      name: "Edit category for task: Move between categories",
    });
    expect(movedTrigger.textContent).toBe("Personal");
    expect(document.activeElement).toBe(movedTrigger);
    expect(screen.getByRole("button", { name: "Work 0" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Personal 2" })).not.toBeNull();
    const listText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(listText?.indexOf("Inbox before moved task")).toBeLessThan(
      listText?.indexOf("Personal before moved task") ?? -1,
    );
    expect(listText?.indexOf("Personal before moved task")).toBeLessThan(
      listText?.indexOf("Move between categories") ?? -1,
    );
  });

  it("keeps persisted order after consecutive cross-category moves", async () => {
    const inboxTask = createTask(
      "10000000-0000-0000-0000-000000000039",
      "Move from inbox second",
      inboxId,
    );
    const workFirst = createTask(
      "10000000-0000-0000-0000-000000000040",
      "Work first",
      workId,
      0,
    );
    const workMiddle = createTask(
      "10000000-0000-0000-0000-000000000041",
      "Move work middle first",
      workId,
      1,
    );
    const workLast = createTask(
      "10000000-0000-0000-0000-000000000042",
      "Work last",
      workId,
      2,
    );
    const moveTask = vi
      .fn<SmartSpaceClient["moveTask"]>()
      .mockResolvedValueOnce({
        ...workMiddle,
        categoryId: personalId,
        position: 0,
      })
      .mockResolvedValueOnce({
        ...inboxTask,
        categoryId: workId,
        position: 2,
      });
    render(
      createElement(App, {
        client: createClient(
          [inboxTask, workFirst, workMiddle, workLast],
          undefined,
          undefined,
          undefined,
          undefined,
          moveTask,
        ),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit category for task: Move work middle first",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Category for Move work middle first"),
      { target: { value: personalId } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Move task: Move work middle first",
      }),
    );
    await screen.findByText("Task moved to Personal.");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit category for task: Move from inbox second",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Category for Move from inbox second"),
      { target: { value: workId } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Move task: Move from inbox second",
      }),
    );
    await screen.findByText("Task moved to Work.");

    expect(moveTask).toHaveBeenCalledTimes(2);
    const listText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(listText?.indexOf("Work first")).toBeLessThan(
      listText?.indexOf("Work last") ?? -1,
    );
    expect(listText?.indexOf("Work last")).toBeLessThan(
      listText?.indexOf("Move from inbox second") ?? -1,
    );
    expect(listText?.indexOf("Move from inbox second")).toBeLessThan(
      listText?.indexOf("Move work middle first") ?? -1,
    );
  });

  it("serializes moves across task rows to preserve commit order", async () => {
    const firstMove = createDeferred<TaskDto>();
    const secondMove = createDeferred<TaskDto>();
    const workFirst = createTask(
      "10000000-0000-0000-0000-000000000043",
      "Move out first",
      workId,
      0,
    );
    const workSecond = createTask(
      "10000000-0000-0000-0000-000000000044",
      "Work remains first",
      workId,
      1,
    );
    const workThird = createTask(
      "10000000-0000-0000-0000-000000000045",
      "Work remains second",
      workId,
      2,
    );
    const personalTask = createTask(
      "10000000-0000-0000-0000-000000000046",
      "Move in second",
      personalId,
      0,
    );
    const moveTask = vi
      .fn<SmartSpaceClient["moveTask"]>()
      .mockImplementationOnce(() => firstMove.promise)
      .mockImplementationOnce(() => secondMove.promise);
    render(
      createElement(App, {
        client: createClient(
          [workFirst, workSecond, workThird, personalTask],
          undefined,
          undefined,
          undefined,
          undefined,
          moveTask,
        ),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit category for task: Move out first",
      }),
    );
    fireEvent.change(screen.getByLabelText("Category for Move out first"), {
      target: { value: personalId },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Move task: Move out first" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit category for task: Move in second",
      }),
    );
    fireEvent.change(screen.getByLabelText("Category for Move in second"), {
      target: { value: workId },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Move task: Move in second" }),
    );

    await waitFor(() => {
      expect(moveTask).toHaveBeenCalledTimes(1);
    });
    expect(moveTask).toHaveBeenNthCalledWith(1, {
      taskId: workFirst.id,
      categoryId: personalId,
    });

    await act(async () => {
      firstMove.resolve({
        ...workFirst,
        categoryId: personalId,
        position: 1,
      });
      await firstMove.promise;
    });
    await waitFor(() => {
      expect(moveTask).toHaveBeenCalledTimes(2);
    });
    expect(moveTask).toHaveBeenNthCalledWith(2, {
      taskId: personalTask.id,
      categoryId: workId,
    });

    await act(async () => {
      secondMove.resolve({
        ...personalTask,
        categoryId: workId,
        position: 2,
      });
      await secondMove.promise;
    });

    await screen.findByText("Task moved to Work.");
    const listText = screen.getByRole("list", {
      name: "Task list",
    }).textContent;
    expect(listText?.indexOf("Work remains first")).toBeLessThan(
      listText?.indexOf("Work remains second") ?? -1,
    );
    expect(listText?.indexOf("Work remains second")).toBeLessThan(
      listText?.indexOf("Move in second") ?? -1,
    );
    expect(listText?.indexOf("Move in second")).toBeLessThan(
      listText?.indexOf("Move out first") ?? -1,
    );
  });

  it("cancels a category draft with Escape and restores focus", async () => {
    const task = createTask(
      "10000000-0000-0000-0000-000000000034",
      "Keep original category",
      workId,
    );
    const moveTask = vi.fn<SmartSpaceClient["moveTask"]>();
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          moveTask,
        ),
      }),
    );

    const trigger = await screen.findByRole("button", {
      name: "Edit category for task: Keep original category",
    });
    fireEvent.click(trigger);
    const select = screen.getByLabelText("Category for Keep original category");
    fireEvent.change(select, { target: { value: personalId } });
    fireEvent.keyDown(select, { key: "Escape" });

    expect(
      screen.queryByLabelText("Category for Keep original category"),
    ).toBeNull();
    expect(moveTask).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    expect(
      (
        screen.getByLabelText(
          "Category for Keep original category",
        ) as HTMLSelectElement
      ).value,
    ).toBe(workId);
  });

  it.each([
    [
      "invalid input",
      new SmartSpaceCommandError("invalid_input", "invalid move"),
      "Task could not be moved.",
    ],
    [
      "missing task",
      new SmartSpaceCommandError("task_not_found", "missing task"),
      "This task is no longer available.",
    ],
    [
      "missing category",
      new SmartSpaceCommandError("category_not_found", "missing category"),
      "That category is no longer available.",
    ],
    [
      "unknown failure",
      new Error("offline"),
      "Task could not be moved. Try again.",
    ],
  ])(
    "retains the category selection after %s",
    async (_case, error, message) => {
      const task = createTask(
        "10000000-0000-0000-0000-000000000035",
        "Retry category move",
        workId,
      );
      const moveTask = vi.fn(async () => {
        throw error;
      });
      render(
        createElement(App, {
          client: createClient(
            [task],
            undefined,
            undefined,
            undefined,
            undefined,
            moveTask,
          ),
        }),
      );

      fireEvent.click(
        await screen.findByRole("button", {
          name: "Edit category for task: Retry category move",
        }),
      );
      const select = screen.getByLabelText("Category for Retry category move");
      fireEvent.change(select, { target: { value: personalId } });
      fireEvent.submit(
        screen.getByRole("form", {
          name: "Edit category for task: Retry category move",
        }),
      );

      expect((await screen.findByRole("alert")).textContent).toContain(message);
      expect((select as HTMLSelectElement).value).toBe(personalId);
      expect(
        (
          screen.getByRole("button", {
            name: "Move task: Retry category move",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    },
  );

  it("focuses the category heading when a moved task leaves its view", async () => {
    const task = createTask(
      "10000000-0000-0000-0000-000000000036",
      "Leave category after moving",
      workId,
    );
    const moveTask = vi
      .fn<SmartSpaceClient["moveTask"]>()
      .mockResolvedValue({ ...task, categoryId: personalId, position: 0 });
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          moveTask,
        ),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Work 1" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit category for task: Leave category after moving",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Category for Leave category after moving"),
      { target: { value: personalId } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Move task: Leave category after moving",
      }),
    );

    expect(await screen.findByText("No tasks in this category")).not.toBeNull();
    expect(moveTask).toHaveBeenCalledWith({
      taskId: task.id,
      categoryId: personalId,
    });
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Work", level: 2 }),
    );
    expect(screen.getByRole("button", { name: "Work 0" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Personal 1" })).not.toBeNull();
  });

  it("ignores a pending move result after the client session changes", async () => {
    const pendingMove = createDeferred<TaskDto>();
    const staleTask = createTask(
      "10000000-0000-0000-0000-000000000037",
      "Stale category move",
      workId,
    );
    const staleMoveTask = vi.fn(() => pendingMove.promise);
    const staleClient = createClient(
      [staleTask],
      undefined,
      undefined,
      undefined,
      undefined,
      staleMoveTask,
    );
    const currentTask = createTask(
      "10000000-0000-0000-0000-000000000038",
      "Current category session",
      inboxId,
    );
    const currentClient = createClient([currentTask]);
    const rendered = render(createElement(App, { client: staleClient }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit category for task: Stale category move",
      }),
    );
    fireEvent.change(
      screen.getByLabelText("Category for Stale category move"),
      {
        target: { value: personalId },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Move task: Stale category move" }),
    );
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current category session")).not.toBeNull();

    await act(async () => {
      pendingMove.resolve({
        ...staleTask,
        categoryId: personalId,
        position: 0,
      });
      await pendingMove.promise;
    });

    expect(screen.queryByText("Stale category move")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Edit category for task: Current category session",
      }).textContent,
    ).toBe("Inbox");
  });

  it("renames a task once from the backend DTO and locks row operations", async () => {
    const pendingRename = createDeferred<TaskDto>();
    const task = createTask(
      "10000000-0000-0000-0000-000000000047",
      "Original title",
      workId,
    );
    const renamedTask: TaskDto = {
      ...task,
      title: "Renamed by backend",
      updatedAt: "2026-07-28T13:00:00.000000001Z",
    };
    const renameTask = vi.fn(() => pendingRename.promise);
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          renameTask,
        ),
      }),
    );

    const trigger = await screen.findByRole("button", {
      name: "Edit title for task: Original title",
    });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Title for Original title");
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe(
      "Original title".length,
    );
    const saveButton = screen.getByRole("button", {
      name: "Save title for task: Original title",
    }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  Original title  " } });
    expect(saveButton.disabled).toBe(true);
    fireEvent.change(input, {
      target: { value: "  Renamed by backend  " },
    });
    expect(saveButton.disabled).toBe(false);
    const form = screen.getByRole("form", {
      name: "Edit title for task: Original title",
    });
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(renameTask).toHaveBeenCalledTimes(1);
    expect(renameTask).toHaveBeenCalledWith({
      taskId: task.id,
      title: "  Renamed by backend  ",
    });
    expect(saveButton.disabled).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Updating task: Original title",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Edit category for task: Original title",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Edit due date for task: Original title",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    await act(async () => {
      pendingRename.resolve(renamedTask);
      await pendingRename.promise;
    });

    expect((await screen.findByRole("status")).textContent).toContain(
      "Task renamed.",
    );
    const renamedTrigger = screen.getByRole("button", {
      name: "Edit title for task: Renamed by backend",
    });
    expect(renamedTrigger.textContent).toBe("Renamed by backend");
    expect(document.activeElement).toBe(renamedTrigger);
  });

  it("cancels a title draft with Escape or Cancel and restores focus", async () => {
    const task = createTask(
      "10000000-0000-0000-0000-000000000048",
      "Keep title",
      workId,
    );
    const renameTask = vi.fn<SmartSpaceClient["renameTask"]>();
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          renameTask,
        ),
      }),
    );

    const trigger = await screen.findByRole("button", {
      name: "Edit title for task: Keep title",
    });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Title for Keep title");
    fireEvent.change(input, { target: { value: "Discard with Escape" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByLabelText("Title for Keep title")).toBeNull();
    expect(renameTask).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const reopenedInput = screen.getByLabelText(
      "Title for Keep title",
    ) as HTMLInputElement;
    expect(reopenedInput.value).toBe("Keep title");
    fireEvent.change(reopenedInput, {
      target: { value: "Discard with Cancel" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancel title edit for task: Keep title",
      }),
    );

    expect(screen.queryByLabelText("Title for Keep title")).toBeNull();
    expect(renameTask).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it.each([
    [
      "invalid input",
      new SmartSpaceCommandError("invalid_input", "invalid title"),
      "Enter a valid task title.",
    ],
    [
      "missing task",
      new SmartSpaceCommandError("task_not_found", "missing task"),
      "This task is no longer available.",
    ],
    [
      "unknown failure",
      new Error("offline"),
      "Task title could not be updated. Try again.",
    ],
  ])("retains the title draft after %s", async (_case, error, message) => {
    const task = createTask(
      "10000000-0000-0000-0000-000000000049",
      "Retry rename",
      workId,
    );
    const renameTask = vi.fn(async () => {
      throw error;
    });
    render(
      createElement(App, {
        client: createClient(
          [task],
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          renameTask,
        ),
      }),
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit title for task: Retry rename",
      }),
    );
    const input = screen.getByLabelText("Title for Retry rename");
    fireEvent.change(input, { target: { value: "Retry this title" } });
    fireEvent.submit(
      screen.getByRole("form", {
        name: "Edit title for task: Retry rename",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect((input as HTMLInputElement).value).toBe("Retry this title");
    expect(
      (
        screen.getByRole("button", {
          name: "Save title for task: Retry rename",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("ignores a pending rename result after the client session changes", async () => {
    const pendingRename = createDeferred<TaskDto>();
    const staleTask = createTask(
      "10000000-0000-0000-0000-000000000050",
      "Stale rename",
      workId,
    );
    const staleRenameTask = vi.fn(() => pendingRename.promise);
    const staleClient = createClient(
      [staleTask],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      staleRenameTask,
    );
    const currentTask = createTask(
      "10000000-0000-0000-0000-000000000051",
      "Current rename session",
      inboxId,
    );
    const currentClient = createClient([currentTask]);
    const rendered = render(createElement(App, { client: staleClient }));

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Edit title for task: Stale rename",
      }),
    );
    fireEvent.change(screen.getByLabelText("Title for Stale rename"), {
      target: { value: "Stale result" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Save title for task: Stale rename",
      }),
    );
    rendered.rerender(createElement(App, { client: currentClient }));
    expect(await screen.findByText("Current rename session")).not.toBeNull();

    await act(async () => {
      pendingRename.resolve({ ...staleTask, title: "Stale result" });
      await pendingRename.promise;
    });

    expect(screen.queryByText("Stale result")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Edit title for task: Current rename session",
      }),
    ).not.toBeNull();
  });
});
