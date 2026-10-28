/**
 * Canned work output. Nothing here is generated: templates are chosen by matching
 * `title + " " + description` against `match`; the first match wins.
 * Hosts can pass their own list to the engine (`workTemplates`) to fit their domain.
 */
export interface WorkTemplate {
  id: string;
  match: RegExp;
  subtasks: string[];
  findings: string[];
  tests: string[];
  reviewNotes: string[];
}

export const WORK_TEMPLATES: WorkTemplate[] = [
  {
    id: "auth",
    match: /\b(auth|authentication|jwt|login|session|token|oauth|password)\b/i,
    subtasks: [
      "Define user + refresh-token schema with hashed secrets",
      "Implement register/login with argon2id password hashing",
      "Issue 15-minute access tokens and rotating refresh tokens",
      "Add auth middleware that verifies signature, exp and audience",
      "Revoke the whole token family on refresh-token reuse",
      "Document the auth endpoints and error codes",
    ],
    findings: [
      "Refresh-token rotation with reuse detection stops replay of stolen tokens (OWASP ASVS 3.5)",
      "Pin the JWT algorithm server-side; never trust the `alg` header",
      "Keep access tokens short-lived and stateless; keep refresh tokens server-side and revocable",
    ],
    tests: ["rejects expired access token", "rotates refresh token on use", "revokes token family on reuse"],
    reviewNotes: ["Move the signing key to the secrets manager instead of an env default", "Use constant-time comparison for the refresh-token hash"],
  },
  {
    id: "payments",
    match: /\b(payment|payments|billing|stripe|invoice|subscription|checkout|refund)\b/i,
    subtasks: [
      "Model invoices and payment intents with idempotency keys",
      "Wire the Stripe webhook endpoint with signature verification",
      "Handle proration when a plan changes mid-cycle",
      "Persist ledger entries in a single transaction",
      "Add a dunning flow for failed renewals",
    ],
    findings: [
      "Webhooks arrive out of order and more than once; process them idempotently by event id",
      "Store money as integer minor units, never floats",
      "Stripe recommends confirming state via the API rather than trusting webhook payloads alone",
    ],
    tests: ["ignores duplicate webhook delivery", "prorates mid-cycle upgrade", "rejects webhook with bad signature"],
    reviewNotes: ["Ledger write and status update must share one transaction", "Log the idempotency key on every retry"],
  },
  {
    id: "search",
    match: /\b(search|index|indexing|full-text|elasticsearch|typeahead|ranking)\b/i,
    subtasks: [
      "Define the search document shape and analyzers",
      "Backfill the index from the primary store in batches",
      "Stream updates into the index via change events",
      "Add typo-tolerant query with field boosts",
      "Expose a paginated search endpoint with cursors",
    ],
    findings: [
      "Dual-write drifts; index from the change stream instead",
      "Use an alias so the index can be rebuilt with zero downtime",
      "Cursor pagination stays stable under concurrent writes; offset does not",
    ],
    tests: ["finds document after update event", "tolerates single-character typo", "cursor pagination has no duplicates"],
    reviewNotes: ["Cap query length to protect the cluster", "Add a timeout and a degraded fallback for the search call"],
  },
  {
    id: "realtime",
    match: /\b(realtime|real-time|websocket|websockets|presence|live cursor|pub\/?sub|collaborat\w*)\b/i,
    subtasks: [
      "Add a WebSocket gateway with token auth on connect",
      "Implement presence with heartbeats and TTL",
      "Fan out room messages through pub/sub",
      "Handle reconnect with resume from last sequence number",
      "Apply per-connection backpressure limits",
    ],
    findings: [
      "Presence needs heartbeats; TCP close is not reliably delivered on mobile networks",
      "Sequence numbers let clients resume without a full resync",
      "Horizontal scale requires a shared pub/sub layer between gateway nodes",
    ],
    tests: ["marks user offline after missed heartbeats", "resumes stream after reconnect", "drops slow consumer over buffer limit"],
    reviewNotes: ["Re-validate the token on resume, not only on first connect", "Bound the room fan-out to avoid a hot-room meltdown"],
  },
  {
    id: "migration",
    match: /\b(migrat\w*|pipeline|database|schema|cron|etl|backfill|event-driven)\b/i,
    subtasks: [
      "Inventory the jobs and data the legacy path touches",
      "Write an expand/contract schema migration",
      "Build the event-driven consumer with retries and a dead-letter queue",
      "Run old and new paths in shadow mode and diff outputs",
      "Cut over behind a flag and decommission the cron",
    ],
    findings: [
      "Expand/contract migrations keep old and new code compatible during deploys",
      "Shadow runs catch semantic drift before cut-over",
      "Consumers must be idempotent because the broker delivers at least once",
    ],
    tests: ["consumer is idempotent on redelivery", "shadow diff reports zero mismatches", "poison message lands in dead-letter queue"],
    reviewNotes: ["Add an explicit rollback step to the runbook", "Batch the backfill to avoid long table locks"],
  },
  {
    id: "notifications",
    match: /\b(notification|notifications|email|digest|push|sms|inbox)\b/i,
    subtasks: [
      "Define notification types and per-user preferences",
      "Queue sends through an outbox table",
      "Render email templates with plain-text fallbacks",
      "Batch low-priority items into a daily digest",
      "Respect unsubscribe and quiet hours",
    ],
    findings: [
      "The transactional outbox pattern prevents lost or duplicate sends",
      "Digest batching cuts email volume and complaint rates",
      "One-click unsubscribe headers are required by major inbox providers",
    ],
    tests: ["skips user who unsubscribed", "groups items into one digest", "defers send during quiet hours"],
    reviewNotes: ["Add a per-user rate limit on transactional mail", "Escape user content in templates"],
  },
  {
    id: "performance",
    match: /\b(performance|latency|memory leak|leak|slow|p95|p99|throughput|cpu)\b/i,
    subtasks: [
      "Reproduce the issue with a load script",
      "Capture heap snapshots and flame graphs",
      "Fix the retaining reference / hot path",
      "Add a regression benchmark to CI",
      "Add a dashboard and alert for the metric",
    ],
    findings: [
      "Heap snapshots before and after a load run isolate retained objects",
      "Unbounded caches and listeners that are never removed cause most leaks",
      "Track p95/p99, not averages; tail latency is what users feel",
    ],
    tests: ["heap stays flat over 10k jobs", "p95 latency under budget", "worker releases buffers after job"],
    reviewNotes: ["Bound the cache with an LRU and a size cap", "Make the benchmark threshold explicit in CI config"],
  },
  {
    id: "deploy",
    match: /\b(deploy|deployment|kubernetes|k8s|canary|ci|cd|helm|rollout|infrastructure)\b/i,
    subtasks: [
      "Containerise the service with a minimal base image",
      "Write the Helm chart with readiness and liveness probes",
      "Add a canary stage with automated analysis",
      "Wire rollback on SLO breach",
      "Document the release runbook",
    ],
    findings: [
      "Readiness probes gate traffic; liveness probes restart; mixing them up causes outages",
      "Canary analysis on error rate and latency catches regressions early",
      "Pin image digests so deploys are reproducible",
    ],
    tests: ["canary aborts on error spike", "pod becomes ready only after migrations", "rollback restores previous digest"],
    reviewNotes: ["Set resource requests and limits explicitly", "Do not run the container as root"],
  },
  {
    id: "mobile",
    match: /\b(mobile|offline|sync|ios|android|react native)\b/i,
    subtasks: [
      "Add a local store for offline reads",
      "Queue mutations while offline",
      "Sync with server using version vectors",
      "Resolve conflicts with a clear rule",
      "Show sync status in the UI",
    ],
    findings: [
      "Last-write-wins loses data silently; surface conflicts or merge per field",
      "Idempotent mutation ids make replay after reconnect safe",
      "Background sync must respect battery and metered networks",
    ],
    tests: ["replays queued mutations after reconnect", "resolves concurrent edit per field", "shows pending badge while offline"],
    reviewNotes: ["Encrypt the local store at rest", "Cap the offline queue size"],
  },
  {
    id: "export",
    match: /\b(export|csv|parquet|report|reports|download)\b/i,
    subtasks: [
      "Define the export schema and column order",
      "Stream rows instead of buffering the full result",
      "Write CSV and Parquet encoders",
      "Run large exports as background jobs",
      "Deliver a signed, expiring download link",
    ],
    findings: [
      "Streaming keeps memory flat for million-row exports",
      "CSV needs formula-injection escaping for spreadsheet safety",
      "Parquet with column statistics is far cheaper for analytics consumers",
    ],
    tests: ["escapes formula injection in csv", "streams 1M rows under memory cap", "download link expires"],
    reviewNotes: ["Check authorization per row, not only per request", "Add a job timeout and cleanup"],
  },
  {
    id: "i18n",
    match: /\b(i18n|internationali[sz]ation|locali[sz]ation|locale|translation|translations|rtl)\b/i,
    subtasks: [
      "Extract UI strings into message catalogs",
      "Add ICU plural and gender formatting",
      "Format dates, numbers and currency per locale",
      "Support right-to-left layouts",
      "Add a pseudo-locale for QA",
    ],
    findings: [
      "ICU MessageFormat handles plurals that simple interpolation gets wrong",
      "Pseudo-localisation exposes truncation and hard-coded strings early",
      "CSS logical properties make RTL support mostly free",
    ],
    tests: ["pluralises correctly in polish", "renders rtl layout mirrored", "no untranslated keys in catalog"],
    reviewNotes: ["Do not concatenate translated fragments", "Lazy-load catalogs per locale"],
  },
  {
    id: "ai",
    match: /\b(ai|llm|summari[sz]e|summary|summaries|embedding|embeddings|rag|gpt|claude)\b/i,
    subtasks: [
      "Define the summarisation prompt and output schema",
      "Chunk long inputs and merge partial summaries",
      "Add caching keyed by content hash",
      "Validate structured output and retry on schema errors",
      "Add an evaluation set and quality metric",
    ],
    findings: [
      "Structured output with validation beats free-text parsing",
      "Content-hash caching removes most repeat inference cost",
      "A small labelled eval set catches prompt regressions before release",
    ],
    tests: ["falls back when model times out", "returns valid json schema", "cache hit skips inference"],
    reviewNotes: ["Strip PII before sending content to the model", "Set a token budget per request"],
  },
  {
    id: "security",
    match: /\b(rate.?limit\w*|security|sso|saml|oidc|csrf|xss|permissions|rbac|abuse)\b/i,
    subtasks: [
      "Add a sliding-window rate limiter backed by Redis",
      "Return standard rate-limit headers",
      "Integrate SSO via OIDC with PKCE",
      "Map IdP groups to roles",
      "Add audit logging for privileged actions",
    ],
    findings: [
      "Sliding-window limits avoid the burst problem of fixed windows",
      "PKCE is required for public clients and recommended for all",
      "Audit logs must be append-only and include the actor",
    ],
    tests: ["blocks after limit exceeded", "rejects sso callback with bad state", "logs role change to audit trail"],
    reviewNotes: ["Rate-limit by user and by IP", "Validate the id_token nonce"],
  },
  {
    id: "api",
    match: /\b(api|endpoint|endpoints|crud|rest|graphql|webhook)\b/i,
    subtasks: [
      "Design resource shapes and error format",
      "Implement CRUD handlers with validation",
      "Add pagination, filtering and sorting",
      "Version the API and document it with OpenAPI",
      "Add contract tests",
    ],
    findings: [
      "A single problem+json error format simplifies every client",
      "Validate at the edge with a schema shared with docs",
      "Cursor pagination scales better than offset",
    ],
    tests: ["returns 422 on invalid payload", "paginates with stable cursor", "respects If-Match on update"],
    reviewNotes: ["Do not leak internal ids in error messages", "Add ETags for optimistic concurrency"],
  },
  {
    id: "ui",
    match: /\b(ui|dashboard|component|components|frontend|design system|chart|charts|page)\b/i,
    subtasks: [
      "Sketch the layout and states (loading, empty, error)",
      "Build accessible components with keyboard support",
      "Fetch data with caching and optimistic updates",
      "Add responsive breakpoints",
      "Write visual and interaction tests",
    ],
    findings: [
      "Design empty and error states first; they are most of real usage",
      "Keyboard and screen-reader support are cheaper built in than retrofitted",
      "Skeletons reduce perceived latency more than spinners",
    ],
    tests: ["renders empty state", "is navigable by keyboard", "shows error with retry"],
    reviewNotes: ["Add aria labels to icon-only buttons", "Memoise the expensive chart transform"],
  },
];

export const GENERIC_TEMPLATE: WorkTemplate = {
  id: "generic",
  match: /.*/,
  subtasks: [
    "Clarify acceptance criteria",
    "Break the change into small commits",
    "Implement the core change",
    "Add tests for the main path and edge cases",
    "Update docs and changelog",
  ],
  findings: [
    "Similar features in the codebase follow an existing pattern worth reusing",
    "The riskiest assumption should be validated first",
    "Small, reversible steps reduce rollout risk",
  ],
  tests: ["handles main path", "rejects invalid input", "is idempotent on retry"],
  reviewNotes: ["Add a test for the edge case discussed in planning", "Tighten naming in the new module"],
};

export function matchWorkTemplate(title: string, description = "", templates: readonly WorkTemplate[] = WORK_TEMPLATES): WorkTemplate {
  const text = `${title} ${description}`;
  return templates.find((t) => t.match.test(text)) ?? GENERIC_TEMPLATE;
}

export function shortTitle(title: string, max = 42): string {
  return title.length <= max ? title : `${title.slice(0, max - 1).trimEnd()}…`;
}
