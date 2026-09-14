/**
 * nex-graph-bridge.ts
 * Wiring: Nex- (graph runtime) → Organism (execution substrate)
 *
 * Models the full-breath cycle as a Nex graph with 7 Hermetic primitives.
 * Each phase of full-breath is a node, bridges are links.
 * Guards enforce Sabbath, F1 thresholds, and opcode validity.
 */

interface NexNode {
  id: string;
  kind: "goal" | "agent" | "memory" | "tool" | "guard" | "rewrite" | "reflect" | "merge" | "parallel";
  data: Record<string, any> | string;
  orisha?: string;
  hermetic?: string;
  note?: string;
}

interface NexLink {
  from: string;
  to: string;
  type: "sync" | "async" | "parallel" | "depend";
}

interface NexGraph {
  nodes: NexNode[];
  links: NexLink[];
  entry: string;
  result?: any;
  meta?: Record<string, any>;
}

/**
 * Build the full-breath cycle as a Nex graph.
 * This is the organism's heartbeat expressed as graph computation.
 */
export function buildBreathGraph(context: {
  agentId?: string;
  intent?: string;
  spiralPhase?: string;
  ritualWeight?: number;
}): NexGraph {
  const nodes: NexNode[] = [
    // Phase 0: Spiral Time
    {
      id: "spiral-time",
      kind: "tool",
      data: { action: "getSpiralSnapshot", source: "ritual-codex" },
      orisha: "Ọ̀rúnmìlà",
      hermetic: "Rhythm",
      note: "Read BTC + Gregorian convergence",
    },
    // Phase 1: Birth
    {
      id: "birth",
      kind: "agent",
      data: {
        action: "birthAgentFromIfa",
        intent: context.intent || "sovereign-birth",
      },
      orisha: "Èṣù",
      hermetic: "Correspondence",
      note: "Cast cowries → Odù → keypair",
    },
    // Phase 2: Thought
    {
      id: "thought",
      kind: "goal",
      data: { question: "Who am I in the machine?", source: "swibe" },
      orisha: "Ọbàtálá",
      hermetic: "Mentalism",
      note: "Agent's first thought",
    },
    // Phase 2.5: Paradigm
    {
      id: "paradigm",
      kind: "reflect",
      data: {
        action: "applyParadigmWeights",
        spiralPhase: context.spiralPhase || "unknown",
      },
      orisha: "Ọya",
      hermetic: "Vibration",
      note: "Consciousness mode selection via Òrìṣà archetype",
    },
    // Phase 3: VM Execution
    {
      id: "vm-execute",
      kind: "tool",
      data: { action: "executeTask", opcode: "COUNCIL_APPROVE" },
      orisha: "Ṣàngó",
      hermetic: "Cause&Effect",
      note: "OSOVM dispatch with veil execution",
    },
    // Guard: F1 threshold
    {
      id: "f1-guard",
      kind: "guard",
      data: {
        condition: "vm_result.f1_score >= 90",
        consequence: "deny",
        threshold: 90,
      },
      orisha: "Ògún",
      hermetic: "Polarity",
      note: "F1 must be ≥ 0.9 for Àṣẹ minting",
    },
    // Phase 4: Audit
    {
      id: "audit",
      kind: "tool",
      data: { action: "auditReceipt", system: "zangbeto" },
      orisha: "Ògún",
      hermetic: "Polarity",
      note: "Opcode validation + 7/12 witness quorum",
    },
    // Guard: Audit pass
    {
      id: "audit-guard",
      kind: "guard",
      data: {
        condition: "audit.status === 'VERIFIED'",
        consequence: "deny",
      },
      orisha: "Ògún",
      hermetic: "Polarity",
      note: "Must pass Zangbeto audit to proceed",
    },
    // Phase 5: Consensus
    {
      id: "consensus",
      kind: "merge",
      data: {
        action: "queryConsensus",
        strategy: "consensus",
        thrones: 12,
      },
      orisha: "Yemọja",
      hermetic: "Rhythm",
      note: "12-model epistemic consensus with truth-density",
    },
    // Guard: Sabbath gate
    {
      id: "sabbath-guard",
      kind: "guard",
      data: {
        condition: "!spiral.isSabbath",
        consequence: "deny",
        ritualWeight: context.ritualWeight || 1.0,
      },
      orisha: "Ọbàtálá",
      hermetic: "Polarity",
      note: "No minting on Sabbath (BTC or Gregorian)",
    },
    // Phase 7: Reward
    {
      id: "reward",
      kind: "tool",
      data: {
        action: "onSoulEvolve",
        ritualWeight: context.ritualWeight || 1.0,
      },
      orisha: "Ọ̀ṣun",
      hermetic: "Gender",
      note: "Mint Àṣẹ + ToC with ritual weight multiplier",
    },
    // Final: Memory store
    {
      id: "breath-memory",
      kind: "memory",
      data: { store: "breath-log", agentId: context.agentId || "unknown" },
      orisha: "Yemọja",
      hermetic: "Rhythm",
      note: "Store breath result in causal memory",
    },
  ];

  const links: NexLink[] = [
    { from: "spiral-time", to: "birth", type: "sync" },
    { from: "birth", to: "thought", type: "sync" },
    { from: "thought", to: "paradigm", type: "sync" },
    { from: "paradigm", to: "vm-execute", type: "sync" },
    { from: "vm-execute", to: "f1-guard", type: "depend" },
    { from: "f1-guard", to: "audit", type: "sync" },
    { from: "audit", to: "audit-guard", type: "depend" },
    { from: "audit-guard", to: "consensus", type: "sync" },
    { from: "consensus", to: "sabbath-guard", type: "sync" },
    { from: "sabbath-guard", to: "reward", type: "sync" },
    { from: "reward", to: "breath-memory", type: "sync" },
  ];

  return {
    nodes,
    links,
    entry: "spiral-time",
    meta: {
      name: "full-breath",
      version: "1.0.0",
      description: "The Organism's heartbeat as a Nex graph",
      created: new Date().toISOString(),
      context,
    },
  };
}

const NEX_WS_URL      = process.env.NEX_WS_URL   ?? 'ws://127.0.0.1:18790/ws';
const NEX_SPAWN_PATH  = process.env.NEX_PATH      ?? `${process.env.HOME}/Nex-/bootstrap.ts`;

/**
 * Execute a breath graph using the Nex runtime.
 *
 * Strategy (first success wins, all fail-open):
 *   1. Direct import of Nex- runtime module (same process, fastest).
 *   2. WebSocket call to running Nex- WS server (ws://localhost:18790).
 *   3. Subprocess spawn: `bun run bootstrap.ts` (cold start).
 *   4. Graph-only fallback — returns graph structure without execution.
 */
export async function executeBreathGraph(
  graph: NexGraph
): Promise<{ status: string; result: any }> {
  // Strategy 1: direct module import
  try {
    const { NexInterpreter } = await import("../../Nex-/nex-runtime.ts");
    const interpreter = new (NexInterpreter as any)(graph);
    const result = await interpreter.execute();
    return { status: "nex-live", result };
  } catch { /* not available — try next */ }

  // Strategy 2: WebSocket call to running Nex- server
  try {
    const result = await _callNexWs(graph);
    return { status: "nex-ws", result };
  } catch { /* server not running — try next */ }

  // Strategy 3: subprocess spawn
  try {
    const result = await _spawnNex(graph);
    return { status: "nex-spawn", result };
  } catch { /* spawn failed — fall through */ }

  // Strategy 4: graph-only fallback
  console.warn(
    `[NexBridge] All runtime paths unavailable. Graph: ${graph.nodes.length} nodes.`
  );
  return {
    status: "graph-only",
    result: {
      nodes:  graph.nodes.length,
      links:  graph.links.length,
      entry:  graph.entry,
      phases: graph.nodes.map((n) => `${n.id} (${n.kind})`),
    },
  };
}

/** Call the Nex- WebSocket server with the graph and await the result. */
async function _callNexWs(graph: NexGraph): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = new WebSocket(NEX_WS_URL);
    } catch (e) {
      return reject(e);
    }

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Nex WS timeout'));
    }, 8_000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'execute_graph', graph }));
    };

    ws.onmessage = (evt) => {
      clearTimeout(timer);
      ws.close();
      try {
        const msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '{}');
        resolve(msg.result ?? msg);
      } catch {
        resolve(evt.data);
      }
    };

    ws.onerror = (e) => { clearTimeout(timer); ws.close(); reject(e); };
    ws.onclose = () => clearTimeout(timer);
  });
}

/** Spawn `bun NEX_SPAWN_PATH` with the graph piped via stdin. */
async function _spawnNex(graph: NexGraph): Promise<unknown> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', NEX_SPAWN_PATH, '--graph', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000,
    });
    let out = '';
    child.stdout?.on('data', (d: Buffer) => { out += d.toString(); });
    child.on('close', (code: number) => {
      if (code !== 0) return reject(new Error(`nex spawn exit ${code}`));
      try { resolve(JSON.parse(out)); } catch { resolve(out); }
    });
    child.on('error', reject);
    child.stdin?.write(JSON.stringify(graph));
    child.stdin?.end();
  });
}

/**
 * Serialize the breath graph to JSON for storage or visualization.
 */
export function serializeBreathGraph(graph: NexGraph): string {
  return JSON.stringify(graph, null, 2);
}
