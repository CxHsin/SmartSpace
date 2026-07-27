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
import { SmartSpaceCommandError } from "./lib/smartspace-client";
import type {
  CategoryDto,
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

const unexpectedSetTaskStatus: SmartSpaceClient["setTaskStatus"] = async () => {
  throw new Error("Workspace test called setTaskStatus unexpectedly.");
};

function createClient(
  taskResult: readonly TaskDto[] = [],
  createTask: SmartSpaceClient["createTask"] = async () => {
    throw new Error("Read-only workspace test called createTask unexpectedly.");
  },
): SmartSpaceClient {
  return {
    listCategories: vi.fn(async () => categories),
    listTasks: vi.fn(async () => taskResult),
    createTask,
    setTaskStatus: unexpectedSetTaskStatus,
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
      listCategories: () => staleCategories.promise,
      listTasks: () => staleTasks.promise,
      createTask: async () => {
        throw new Error(
          "Read-only workspace test called createTask unexpectedly.",
        );
      },
      setTaskStatus: unexpectedSetTaskStatus,
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
    };
    const pendingBCategories = createDeferred<readonly CategoryDto[]>();
    const pendingBTasks = createDeferred<readonly TaskDto[]>();
    const clientB: SmartSpaceClient = {
      listCategories: () => pendingBCategories.promise,
      listTasks: () => pendingBTasks.promise,
      createTask: vi.fn(async () => {
        throw new Error("Loading session exposed createTask unexpectedly.");
      }),
      setTaskStatus: unexpectedSetTaskStatus,
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
      listCategories: vi.fn(async () => categories),
      listTasks,
      createTask: vi.fn(async () => {
        throw new Error(
          "Read-only workspace test called createTask unexpectedly.",
        );
      }),
      setTaskStatus: unexpectedSetTaskStatus,
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

  it("renders the empty state after a successful read", async () => {
    render(createElement(App, { client: createClient() }));

    expect(await screen.findByText("No tasks yet")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Inbox 0" })).not.toBeNull();
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
});
