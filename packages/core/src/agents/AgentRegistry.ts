import type { AgentDefinition, AgentId, AgentRole } from "./agentTypes.ts";

export const AGENTS: readonly AgentDefinition[] = [
  { id: "orion", name: "Orion", role: "orchestrator", roleLabel: "Orchestrator", tagline: "Coordinates work and delegates tasks", color: "#E8B04A", home: "hub", seat: 0 },
  { id: "iris", name: "Iris", role: "researcher", roleLabel: "Researcher", tagline: "Researches technical topics and gathers information", color: "#5CC8D7", home: "research", seat: 1 },
  { id: "piper", name: "Piper", role: "product_manager", roleLabel: "Product Manager", tagline: "Converts requirements into actionable tasks", color: "#A78BFA", home: "product", seat: 2 },
  { id: "kai", name: "Kai", role: "engineer", roleLabel: "Software Engineer", tagline: "Implements software features", color: "#6C9EFF", home: "dev", seat: 3 },
  { id: "quinn", name: "Quinn", role: "qa", roleLabel: "QA Engineer", tagline: "Tests completed work", color: "#5FD39A", home: "testing", seat: 4 },
  { id: "rex", name: "Rex", role: "reviewer", roleLabel: "Code Reviewer", tagline: "Reviews implementation quality", color: "#F08A7E", home: "review", seat: 5 },
];

const BY_ID = new Map<AgentId, AgentDefinition>(AGENTS.map((a) => [a.id, a]));

export function getAgent(id: AgentId): AgentDefinition {
  const agent = BY_ID.get(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
}

export function agentName(id: AgentId | null | undefined): string {
  return id ? getAgent(id).name : "Unassigned";
}

export function agentByRole(role: AgentRole): AgentDefinition {
  const agent = AGENTS.find((a) => a.role === role);
  if (!agent) throw new Error(`No agent with role: ${role}`);
  return agent;
}

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && BY_ID.has(value as AgentId);
}
