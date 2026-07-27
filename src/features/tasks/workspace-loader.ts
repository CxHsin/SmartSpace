import type {
  CategoryDto,
  SmartSpaceClient,
  TaskDto,
} from "../../lib/smartspace-client";

export interface TaskWorkspaceData {
  readonly categories: readonly CategoryDto[];
  readonly tasks: readonly TaskDto[];
}

export async function loadTaskWorkspace(
  client: SmartSpaceClient,
): Promise<TaskWorkspaceData> {
  const [categories, tasks] = await Promise.all([
    client.listCategories(),
    client.listTasks(),
  ]);

  return { categories, tasks };
}
