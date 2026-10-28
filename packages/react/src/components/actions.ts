import { DEMO_TASK, SPRINT_TASKS, type CreateTaskInput } from "@agent-world/core";
import { commands } from "../state/backendClient";
import { useWorldStore } from "../state/useWorldStore";

/** UI-level flows shared by buttons and keyboard shortcuts. */

export async function runDemo(): Promise<void> {
  await commands.ensureRunning();
  const task = await commands.submitTask(DEMO_TASK);
  if (task) {
    const s = useWorldStore.getState();
    s.select({ kind: "task", id: task.id });
    s.setTab("tasks");
    s.requestCamera({ preset: "overview" });
  }
}

export async function loadSprint(): Promise<void> {
  await commands.ensureRunning();
  const s = useWorldStore.getState();
  s.setTab("tasks");
  s.requestCamera({ preset: "overview" });
  await commands.submitTasks(SPRINT_TASKS);
}

export async function submitFromDialog(input: CreateTaskInput): Promise<void> {
  const s = useWorldStore.getState();
  s.closeDialog();
  await commands.ensureRunning();
  const task = await commands.submitTask(input);
  if (task) {
    useWorldStore.getState().select({ kind: "task", id: task.id });
    useWorldStore.getState().setTab("tasks");
    useWorldStore.getState().requestCamera({ preset: "collaboration" });
  }
}

export async function togglePlay(): Promise<void> {
  const status = useWorldStore.getState().simStatus;
  if (status === "running") await commands.pause();
  else if (status === "paused") await commands.resume();
  else await commands.start();
}
