"use client";

import { AppShell } from "@agent-world/react";
import { useState } from "react";
import { createBackendFromEnv } from "@/lib/backend";

export function AgentWorld() {
  const [backend] = useState(createBackendFromEnv);
  return <AppShell backend={backend} />;
}
