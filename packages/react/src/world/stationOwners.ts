import type { AgentId, StationId } from "@agent-world/core";

export const STATION_OWNER: Record<StationId, AgentId> = {
  ops: "orion",
  research: "iris",
  product: "piper",
  dev: "kai",
  testing: "quinn",
  review: "rex",
};

export const STATION_LABEL: Record<StationId, string> = {
  ops: "Ops Console",
  research: "Research Station",
  product: "Product Station",
  dev: "Engineering Station",
  testing: "QA Lab",
  review: "Review Station",
};
