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

function createClient(taskResult: readonly TaskDto[] = []): SmartSpaceClient {
  return {
    listCategories: vi.fn(async () => categories),
    listTasks: vi.fn(async () => taskResult),
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
});
