// Workflow persistence utilities for strategy-specific workflows
// Storage keys:
// - legacy: strategy-workflows-v1 (kept for backward compatibility)
// - new: code_workflows (required structure)

export interface PersistedWorkflow {
  strategy_id: string;
  strategy_name: string;
  segment?: string;
  aging_bucket?: string;
  last_modified: string; // ISO string
  workflow_json: {
    nodes: Array<any>;
    connections: Array<{ from: string; to: string }>;
  };
}

// ===== NEW STORE (requested contract) =====
export interface StoredWorkflow {
  nodes: any[];
  edges: Array<{ from: string; to: string }>;
  metadata: {
    name: string;
    segment: string;
    aging: string;
    lastModified: string; // ISO
  };
}

const CODE_STORAGE_KEY = "code_workflows";

function readCodeAll(): Record<string, StoredWorkflow> {
  try {
    const raw = localStorage.getItem(CODE_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeCodeAll(map: Record<string, StoredWorkflow>) {
  localStorage.setItem(CODE_STORAGE_KEY, JSON.stringify(map));
}

export function getWorkflow(strategyId: string): StoredWorkflow | undefined {
  const map = readCodeAll();
  return map[strategyId];
}

export function saveWorkflow(strategyId: string, workflow: StoredWorkflow) {
  const map = readCodeAll();
  // Ensure lastModified exists
  const lastModified = workflow?.metadata?.lastModified || new Date().toISOString();
  map[strategyId] = {
    nodes: workflow.nodes || [],
    edges: workflow.edges || [],
    metadata: {
      name: workflow.metadata?.name || "Unnamed Strategy",
      segment: workflow.metadata?.segment || "",
      aging: workflow.metadata?.aging || "",
      lastModified,
    },
  };
  writeCodeAll(map);
}

export function hasSavedWorkflow(strategyId: string): boolean {
  return !!getWorkflow(strategyId);
}

export function deleteWorkflow(strategyId: string) {
  const map = readCodeAll();
  if (strategyId in map) {
    delete map[strategyId];
    writeCodeAll(map);
  }
}

// ===== LEGACY STORE (kept to avoid breaking imports) =====
const LEGACY_STORAGE_KEY = "strategy-workflows-v1";

function readLegacyAll(): Record<string, PersistedWorkflow> {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeLegacyAll(map: Record<string, PersistedWorkflow>) {
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(map));
}

export function getSavedWorkflow(strategyId: string): PersistedWorkflow | undefined {
  const map = readLegacyAll();
  return map[strategyId];
}

// Keep legacy API but encourage migration to the new API by mirroring writes into the new store
export function saveLegacyWorkflow(entry: PersistedWorkflow) {
  const map = readLegacyAll();
  map[entry.strategy_id] = entry;
  writeLegacyAll(map);

  // Mirror to new format
  saveWorkflow(entry.strategy_id, {
    nodes: entry.workflow_json.nodes,
    edges: entry.workflow_json.connections,
    metadata: {
      name: entry.strategy_name,
      segment: entry.segment || "",
      aging: entry.aging_bucket || "",
      lastModified: entry.last_modified,
    },
  });
}

export function getAllWorkflows(): PersistedWorkflow[] {
  const map = readLegacyAll();
  return Object.values(map);
}
