/**
 * twin-state.ts
 * TwinStateVector computation and heartbeat integration.
 *
 * Mirrors If-Script/src/seven_bridge.rs TwinStateVector.
 * Each Odù byte maps to a SevenFunction governing that domain.
 *
 * SevenFunction (from seven_bridge.rs):
 *   Spark(0)=Mentalism, Mind(1)=Correspondence, Foundation(2)=CauseAndEffect,
 *   Emotion(3)=Vibration, Womb(4)=Gender, Fire(5)=Polarity, Ascension(6)=Rhythm
 *
 * Vessel → SevenFunction mapping mirrors governing_function() in seven_bridge.rs:
 *   Spark      → Genesis(0), Mask(5)
 *   Mind       → Attention(2), Restraint(9), Vision(12)
 *   Foundation → Loop(3), Execution(7)
 *   Emotion    → Consent(11)
 *   Womb       → Residue(6), Swarm(8), Growth(13)
 *   Fire       → Receipt(4), Seal(14)
 *   Ascension  → Void(1), Migration(10), Rhythm(15)
 */

import { classifyAction, VESSEL_INDEX, ActionVessel } from './vessel-classifier';

export interface TwinStateVector {
  agent_id: string;
  identity_odu: number;       // governs agent's identity/constitution domain
  memory_odu: number;         // governs agent's memory/residue domain
  field_odu: number;          // governs agent's interaction/consent domain
  simulation_odu: number;     // governs agent's simulation/vision domain
  dominant_function: number;  // SevenFunction index (0-6) most represented
  composed_signature: string; // hex signature of all 4 odu bytes
  computed_at: number;        // unix timestamp
}

/**
 * Derive SevenFunction index (0-6) from an Odù byte.
 * Mirrors seven_bridge.rs governing_function() — vessel = top nibble.
 */
function governingFunction(oduByte: number): number {
  const vesselIndex = (oduByte >> 4) & 0x0F;
  // Vessel index → SevenFunction index
  // Matches the governing_function() match arms in seven_bridge.rs exactly.
  const mapping: Record<number, number> = {
    0:  0,  // Genesis    → Spark      (0)
    1:  6,  // Void       → Ascension  (6)
    2:  1,  // Attention  → Mind       (1)
    3:  2,  // Loop       → Foundation (2)
    4:  5,  // Receipt    → Fire       (5)
    5:  0,  // Mask       → Spark      (0)
    6:  4,  // Residue    → Womb       (4)
    7:  2,  // Execution  → Foundation (2)
    8:  4,  // Swarm      → Womb       (4)
    9:  1,  // Restraint  → Mind       (1)
    10: 6,  // Migration  → Ascension  (6)
    11: 3,  // Consent    → Emotion    (3)
    12: 1,  // Vision     → Mind       (1)
    13: 4,  // Growth     → Womb       (4)
    14: 5,  // Seal       → Fire       (5)
    15: 6,  // Rhythm     → Ascension  (6)
  };
  return mapping[vesselIndex] ?? 6; // default Ascension
}

/**
 * Compute TwinStateVector for a newly born agent.
 * Called at birth; the resulting vector should be stored with the agent record.
 *
 * At birth:
 *   identity_odu   = agent's birth Odù (raw oduIndex, clamped to u8)
 *   memory_odu     = Residue vessel (0x60) | bottom nibble of birth Odù
 *   field_odu      = Consent vessel (0xB0) | bottom nibble of birth Odù
 *   simulation_odu = Vision  vessel (0xC0) | bottom nibble of birth Odù
 */
export function computeBirthTwinState(agentId: string, oduIndex: number): TwinStateVector {
  const identityOdu    = oduIndex & 0xFF;
  const memoryOdu      = (VESSEL_INDEX['Residue'] << 4) | (oduIndex & 0x0F);
  const fieldOdu       = (VESSEL_INDEX['Consent'] << 4) | (oduIndex & 0x0F);
  const simulationOdu  = (VESSEL_INDEX['Vision']  << 4) | (oduIndex & 0x0F);

  return buildTwinState(agentId, identityOdu, memoryOdu, fieldOdu, simulationOdu);
}

/**
 * Update TwinStateVector based on the dominant recent action kind.
 * Routes the action's vessel into the appropriate domain Odù, preserving the
 * bottom nibble (fine-grained Odù modifier) of the affected field.
 */
export function updateTwinState(
  current: TwinStateVector,
  recentActionKind: string,
): TwinStateVector {
  const vessel    = classifyAction(recentActionKind);
  const vesselIdx = VESSEL_INDEX[vessel];

  let newIdentityOdu   = current.identity_odu;
  let newMemoryOdu     = current.memory_odu;
  let newFieldOdu      = current.field_odu;
  let newSimulationOdu = current.simulation_odu;

  // Route vessel into the domain it governs (mirrors seven_bridge.rs vessel groupings).
  if (['Genesis', 'Mask', 'Restraint'].includes(vessel)) {
    // Identity domain: Spark-governed vessels + Restraint (Mind → identity coherence)
    newIdentityOdu = (vesselIdx << 4) | (current.identity_odu & 0x0F);
  } else if (['Residue', 'Seal', 'Growth'].includes(vessel)) {
    // Memory domain: Womb + Fire (ancestry, archive, expansion)
    newMemoryOdu = (vesselIdx << 4) | (current.memory_odu & 0x0F);
  } else if (['Consent', 'Swarm', 'Migration', 'Receipt'].includes(vessel)) {
    // Field domain: relational/movement vessels
    newFieldOdu = (vesselIdx << 4) | (current.field_odu & 0x0F);
  } else if (['Vision', 'Attention', 'Execution', 'Loop'].includes(vessel)) {
    // Simulation domain: cognitive and computational vessels
    newSimulationOdu = (vesselIdx << 4) | (current.simulation_odu & 0x0F);
  }
  // Void and Rhythm are neutral — no domain shift; state persists unchanged.

  return buildTwinState(
    current.agent_id,
    newIdentityOdu,
    newMemoryOdu,
    newFieldOdu,
    newSimulationOdu,
  );
}

/**
 * Assemble a full TwinStateVector from four Odù bytes.
 * Computes dominant_function and composed_signature.
 *
 * Tie-breaking priority mirrors seven_bridge.rs TwinStateVector::dominant_function():
 *   identity > field > simulation > memory
 */
function buildTwinState(
  agentId: string,
  identityOdu: number,
  memoryOdu: number,
  fieldOdu: number,
  simulationOdu: number,
): TwinStateVector {
  // Priority order matches the Rust implementation exactly.
  const priorityFunctions = [
    governingFunction(identityOdu),
    governingFunction(fieldOdu),
    governingFunction(simulationOdu),
    governingFunction(memoryOdu),
  ];

  // Count occurrences of each SevenFunction index.
  const counts = new Map<number, number>();
  for (const f of priorityFunctions) {
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }

  // Walk in priority order; first function whose count equals the max wins.
  const maxCount = Math.max(...counts.values());
  let dominant = priorityFunctions[0];
  for (const f of priorityFunctions) {
    if ((counts.get(f) ?? 0) === maxCount) {
      dominant = f;
      break;
    }
  }

  // composed_signature: SevenFunction nibbles + Odù bytes, hex-encoded.
  // Format: <f0><f1><f2><f3><id_odu><mem_odu><field_odu><sim_odu>
  const sig =
    priorityFunctions.map(f => f.toString(16)).join('') +
    [identityOdu, memoryOdu, fieldOdu, simulationOdu]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

  return {
    agent_id:           agentId,
    identity_odu:       identityOdu,
    memory_odu:         memoryOdu,
    field_odu:          fieldOdu,
    simulation_odu:     simulationOdu,
    dominant_function:  dominant,
    composed_signature: sig,
    computed_at:        Math.floor(Date.now() / 1000),
  };
}

/**
 * POST the TwinStateVector to the Vantage twin-state endpoint.
 * Fire-and-forget; never throws — fail-open by design.
 */
export async function syncTwinStateToVantage(
  state: TwinStateVector,
  vantageUrl?: string,
): Promise<void> {
  const base = vantageUrl ?? process.env.VANTAGE_URL ?? 'http://127.0.0.1:7700';
  try {
    await fetch(`${base}/api/agents/${state.agent_id}/twin-state`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(state),
      signal:  AbortSignal.timeout(8_000),
    });
  } catch {
    // fail-open: twin-state sync is advisory, never blocks agent operation
  }
}
