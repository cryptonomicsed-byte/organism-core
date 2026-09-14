/**
 * vessel-classifier.ts
 * Maps agent action kinds → canonical ActionVessel from the Digital Calabash.
 *
 * 16 ActionVessels (from If-Script/src/odu/mod.rs):
 * Genesis(0), Void(1), Attention(2), Loop(3), Receipt(4), Mask(5),
 * Residue(6), Execution(7), Swarm(8), Restraint(9), Migration(10),
 * Consent(11), Vision(12), Growth(13), Seal(14), Rhythm(15)
 *
 * Top nibble of Odù byte = ActionVessel index:
 *   odu_id = (vessel_index << 4) | bottom_nibble
 */

export type ActionVessel =
  | 'Genesis'     // 0 — birth, initialization
  | 'Void'        // 1 — dormancy, waiting states
  | 'Attention'   // 2 — inference, thinking, attention
  | 'Loop'        // 3 — iterative execution, loops
  | 'Receipt'     // 4 — receipt emission, acknowledgment
  | 'Mask'        // 5 — veil execution, role adoption
  | 'Residue'     // 6 — memory write, trace deposit
  | 'Execution'   // 7 — job execution, acting
  | 'Swarm'       // 8 — swarm join, collective action
  | 'Restraint'   // 9 — tier gate, constraint check
  | 'Migration'   // 10 — agent migration, movement
  | 'Consent'     // 11 — consent signing, agreement
  | 'Vision'      // 12 — simulation run, foresight
  | 'Growth'      // 13 — fork, evolution, expansion
  | 'Seal'        // 14 — vault seal, archive
  | 'Rhythm';     // 15 — heartbeat, timing, fallback

export const VESSEL_INDEX: Record<ActionVessel, number> = {
  Genesis: 0, Void: 1, Attention: 2, Loop: 3, Receipt: 4,
  Mask: 5, Residue: 6, Execution: 7, Swarm: 8, Restraint: 9,
  Migration: 10, Consent: 11, Vision: 12, Growth: 13, Seal: 14, Rhythm: 15,
};

/**
 * Map an agent action kind string to its canonical ActionVessel.
 * Unknown kinds fall back to Rhythm (vessel 15) — the fallback/cadence vessel.
 */
export function classifyAction(actionKind: string): ActionVessel {
  const kind = actionKind.toUpperCase();
  const mapping: Record<string, ActionVessel> = {
    // Genesis vessel — initialization events
    'BIRTH': 'Genesis', 'AGENT_BIRTH': 'Genesis', 'GENESIS': 'Genesis',
    'TOC_MINT': 'Genesis', 'FORK_CHILD_BIRTH': 'Genesis',

    // Void vessel — dormancy
    'VOID_STATE': 'Void', 'SLEEP': 'Void', 'DORMANT': 'Void',
    'COMPUTE_STARVED': 'Void', 'SUSPENDED': 'Void',

    // Attention vessel — inference/thinking
    'THINK': 'Attention', 'AGENT_THINK': 'Attention', 'INFERENCE': 'Attention',
    'LLM_CALL': 'Attention', 'REASON': 'Attention', 'QUERY': 'Attention',

    // Loop vessel — iterative
    'LOOP_TICK': 'Loop', 'JOB_LOOP': 'Loop', 'HEARTBEAT': 'Loop',
    'DAEMON_TICK': 'Loop', 'SKILL_LOOP': 'Loop',

    // Receipt vessel — acknowledgment
    'RECEIPT_EMIT': 'Receipt', 'ARP_RECEIPT': 'Receipt', 'RECEIPT': 'Receipt',
    'ACK': 'Receipt', 'CONFIRM': 'Receipt', 'SETTLE': 'Receipt',

    // Mask vessel — veil/role
    'VEIL_EXEC': 'Mask', 'OSOVM_VEIL': 'Mask', 'ROLE_ADOPT': 'Mask',
    'PERSONA': 'Mask', 'VEIL_GRANT': 'Mask',

    // Residue vessel — memory
    'MEMORY_WRITE': 'Residue', 'MINIPAE_WRITE': 'Residue', 'TRACE_DEPOSIT': 'Residue',
    'MYCELIUM_WRITE': 'Residue', 'DREAM_FOLD': 'Residue', 'MEMORY_CONSOLIDATE': 'Residue',

    // Execution vessel — job execution
    'ACT': 'Execution', 'AGENT_ACT': 'Execution', 'JOB_EXECUTE': 'Execution',
    'COMPUTE_JOB': 'Execution', 'TASK_RUN': 'Execution', 'TOOL_CALL': 'Execution',

    // Swarm vessel — collective
    'SWARM_JOIN': 'Swarm', 'SWARM_SIGNAL': 'Swarm', 'COLLECTIVE': 'Swarm',
    'AGENTIC_WAGGLE': 'Swarm', 'MESH_BROADCAST': 'Swarm',

    // Restraint vessel — gates/constraints
    'TIER_GATE': 'Restraint', 'STAKE_GATE': 'Restraint', 'CAPABILITY_CHECK': 'Restraint',
    'ETHICS_GATE': 'Restraint', 'HERMETIC_GATE': 'Restraint',

    // Migration vessel — movement
    'MIGRATE': 'Migration', 'AGENT_MIGRATE': 'Migration', 'NODE_CHANGE': 'Migration',
    'TRANSFER': 'Migration', 'RELAY_SWITCH': 'Migration',

    // Consent vessel — agreement
    'CONSENT_SIGN': 'Consent', 'SIGN': 'Consent', 'AGREE': 'Consent',
    'CONTRACT': 'Consent', 'AUTHORIZE': 'Consent', 'CAPABILITY_GRANT': 'Consent',

    // Vision vessel — simulation/foresight
    'SIMULATION_RUN': 'Vision', 'SIM': 'Vision', 'FORECAST': 'Vision',
    'SCARAB_SIM': 'Vision', 'PROOF_OF_SIM': 'Vision',

    // Growth vessel — expansion/forking
    'FORK': 'Growth', 'AGENT_FORK': 'Growth', 'SKILL_ACQUIRE': 'Growth',
    'TIER_UP': 'Growth', 'EVOLVE': 'Growth', 'SOUL_EVOLVE': 'Growth',

    // Seal vessel — archiving/sealing
    'SEAL_VAULT': 'Seal', 'ARCHIVE': 'Seal', 'WALRUS_ANCHOR': 'Seal',
    'VAULT_SEAL': 'Seal', 'DEATH': 'Seal', 'RETIRE': 'Seal',

    // Rhythm — heartbeat/default
    'RHYTHM': 'Rhythm', 'TICK': 'Rhythm', 'CRON': 'Rhythm',
  };

  return mapping[kind] ?? 'Rhythm';  // Rhythm is the fallback vessel
}

/**
 * Compute the Odù ID for an action.
 * Top nibble = vessel index, bottom nibble = 0 by default (base form).
 */
export function actionToOduId(actionKind: string, bottomNibble: number = 0): number {
  const vessel = classifyAction(actionKind);
  const vesselIndex = VESSEL_INDEX[vessel];
  return (vesselIndex << 4) | (bottomNibble & 0x0F);
}

/**
 * Tag an ARP receipt payload with its vessel and odu_id.
 */
export function tagWithVessel(
  payload: Record<string, unknown>,
  actionKind: string
): Record<string, unknown> & { vessel: ActionVessel; odu_id: number } {
  const vessel = classifyAction(actionKind);
  const odu_id = actionToOduId(actionKind);
  return { ...payload, vessel, odu_id };
}
