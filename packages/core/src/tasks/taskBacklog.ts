import type { CreateTaskInput } from "./taskTypes.ts";

export const HOTFIX_TITLE = "Patch session token leak in password-reset flow";
export const MIGRATION_TITLE = "Migrate legacy billing cron to event-driven pipeline";
export const MEMORY_LEAK_TITLE = "Fix memory leak in the image-processing worker";
export const EXPORT_TITLE = "Add CSV and Parquet export for usage reports";

export const TASK_BACKLOG: readonly CreateTaskInput[] = [
  {
    title: HOTFIX_TITLE,
    description: "The reset email link carries a reusable session token that ends up in referrer headers. Make reset tokens single-use and short-lived.",
    priority: "critical",
    script: { qaFailsOn: [1], reviewChangesOn: [2] },
  },
  {
    title: MIGRATION_TITLE,
    description: "Replace the nightly billing cron with consumers on the payments event stream so invoices update within seconds.",
    priority: "high",
    script: { qaFailsOn: [1, 2, 3] },
  },
  {
    title: MEMORY_LEAK_TITLE,
    description: "Worker RSS grows about 40 MB per hour until the pod is OOM-killed. Find the retaining reference and add a regression benchmark.",
    priority: "critical",
  },
  {
    title: EXPORT_TITLE,
    description: "Customers want to download monthly usage as CSV or Parquet. Large accounts have millions of rows.",
    priority: "low",
  },
  {
    title: "Add Stripe proration for mid-cycle plan changes",
    description: "Upgrades and downgrades should charge or credit the difference immediately instead of at renewal.",
    priority: "high",
  },
  {
    title: "Ship full-text search for the help center",
    description: "Index articles with typo tolerance and title boosts; results must update within a minute of publishing.",
    priority: "medium",
  },
  {
    title: "Show live presence avatars in shared documents",
    description: "Display who is viewing a document in real time over WebSocket, with graceful reconnect on flaky networks.",
    priority: "medium",
  },
  {
    title: "Send a weekly digest email of unread notifications",
    description: "Batch low-priority notifications into one email per week and honour unsubscribe and quiet hours.",
    priority: "low",
  },
  {
    title: "Roll out canary deploys on Kubernetes",
    description: "Route 5% of traffic to new pods with automated analysis and rollback on SLO breach.",
    priority: "high",
  },
  {
    title: "Offline sync for the field-inspection mobile app",
    description: "Inspectors work without signal; queue edits locally and sync with conflict handling when back online.",
    priority: "medium",
  },
  {
    title: "Localise the onboarding flow into German and Arabic",
    description: "Extract strings, add ICU plurals and support right-to-left layout for Arabic.",
    priority: "medium",
  },
  {
    title: "Summarise long support tickets with an LLM",
    description: "Give agents a three-line summary at the top of tickets over 2,000 words, with caching and a fallback.",
    priority: "medium",
  },
  {
    title: "Add per-tenant rate limiting to the public API",
    description: "Protect the platform from noisy tenants with sliding-window limits and standard headers.",
    priority: "high",
  },
  {
    title: "Enterprise SSO with OIDC and group-to-role mapping",
    description: "Let enterprise admins sign in through their IdP and map directory groups to workspace roles.",
    priority: "high",
  },
  {
    title: "CRUD endpoints for project webhooks",
    description: "Customers can register, list, update and delete webhook endpoints per project with validation.",
    priority: "medium",
  },
  {
    title: "Redesign the analytics dashboard cards",
    description: "New dashboard components with loading, empty and error states, keyboard support and responsive layout.",
    priority: "low",
  },
  {
    title: "Reduce p95 latency of the feed endpoint",
    description: "The feed endpoint p95 is 1.8 s under peak load; bring it under 400 ms.",
    priority: "high",
  },
  {
    title: "Backfill the orders table into the new schema",
    description: "Move historic orders into the partitioned schema with an expand/contract migration and no downtime.",
    priority: "medium",
  },
];

const SPRINT_TITLES = [
  HOTFIX_TITLE,
  MEMORY_LEAK_TITLE,
  MIGRATION_TITLE,
  "Add Stripe proration for mid-cycle plan changes",
  "Add per-tenant rate limiting to the public API",
  "Ship full-text search for the help center",
  "Show live presence avatars in shared documents",
  EXPORT_TITLE,
];

/** An 8-task sprint: both scripted tasks, two criticals, and one low-priority export that visibly waits. */
export const SPRINT_TASKS: readonly CreateTaskInput[] = SPRINT_TITLES.map((title) => {
  const task = TASK_BACKLOG.find((t) => t.title === title);
  if (!task) throw new Error(`Sprint task missing from backlog: ${title}`);
  return task;
});
