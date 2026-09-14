/**
 * ifa-veil-router.ts
 * Wiring: IfáScript (Odù pattern) → OSOVM (Veil selection)
 * 
 * Maps 256 Odù patterns to the 777 veil system.
 * Veil categories (from Osovm/src/veil_index.jl):
 *   1-25:   Control Systems (PID, state machines, stability)
 *   26-75:  Machine Learning (gradient, neural, optimization)
 *   76-100: Signal Processing (FFT, filters, compression)
 *   101-125: Robotics (kinematics, SLAM, pathfinding)
 *   126-200: Physics (thermodynamics, fluid, quantum)
 *   201-300: Economics (market, auction, game theory)
 *   301-400: Biology (genetic, neural, ecosystem)
 *   401-500: Cryptography (hash, signature, ZKP)
 *   501-600: Governance (voting, consensus, reputation)
 *   601-700: Media (generation, streaming, rendering)
 *   701-777: Sacred (divination, ritual, cosmology)
 * 
 * Odù opcode mapping principle:
 *   PushConst1  → Creation    → Physics, Biology, Sacred
 *   PopVoid     → Dissolution → Cryptography, Economics
 *   Dup         → Reflection  → Signal Processing, Media
 *   Swap        → Reversal    → Governance, Game Theory
 *   Add         → Synthesis   → ML, Control Systems
 *   Sub         → Separation  → Robotics, Physics
 *   CastCowries → Entropy     → Sacred, Cryptography
 *   HaltIfOne   → Completion  → Governance, Economics
 */

export interface OduVeilRoute {
  odu_index: number;
  odu_name: string;
  odu_archetype: string;
  recommended_veils: number[];
  veil_category: string;
  reasoning: string;
}

/**
 * Maps an Odù binary pattern (0-255) to recommended veil IDs.
 * Uses the Odù's opcode type and wave position to select veils.
 */
export function routeOduToVeils(oduIndex: number): OduVeilRoute {
  // Determine wave (0-15 groups of 16)
  const wave = Math.floor(oduIndex / 16);
  // Position within wave
  const position = oduIndex % 16;

  // Opcode type determines primary veil category
  // From odu.rs: top 4 bits determine opcode
  const topNibble = (oduIndex >> 4) & 0xF;

  let category: string;
  let baseRange: [number, number];
  let reasoning: string;

  switch (topNibble) {
    case 0x0: // Ẹ̀jì Ogbe wave — PushConst1 — Creation
      category = "Sacred-Creation";
      baseRange = [701, 777]; // Sacred veils
      reasoning = "Creation/genesis energy → sacred cosmology veils";
      break;
    case 0x1: // Òyèkú wave — PopVoid — Dissolution
      category = "Cryptography";
      baseRange = [401, 500]; // Crypto veils
      reasoning = "Dissolution/void → cryptographic hash & entropy veils";
      break;
    case 0x2: // Ìwòrì wave — Dup — Reflection
      category = "Signal-Processing";
      baseRange = [76, 100]; // Signal veils
      reasoning = "Mirror/reflection → signal processing & FFT veils";
      break;
    case 0x3: // Òdí wave — Swap — Reversal
      category = "Governance";
      baseRange = [501, 600]; // Governance veils
      reasoning = "Reversal/inversion → governance & consensus veils";
      break;
    case 0x4: // Ìròsùn wave — Add — Synthesis
      category = "Machine-Learning";
      baseRange = [26, 75]; // ML veils
      reasoning = "Union/synthesis → machine learning & optimization veils";
      break;
    case 0x5: // Òwónrín wave — Sub — Separation
      category = "Robotics";
      baseRange = [101, 125]; // Robotics veils
      reasoning = "Separation/trickster → robotics & pathfinding veils";
      break;
    case 0x6: // Òbàrà wave — PushConst0 — Ground
      category = "Physics";
      baseRange = [126, 200]; // Physics veils
      reasoning = "Ground/provision → physics simulation veils";
      break;
    case 0x7: // Ọ̀kànràn wave — CastCowries — Entropy
      category = "Sacred-Entropy";
      baseRange = [701, 777]; // Sacred veils (entropy focus)
      reasoning = "Disruption/entropy → sacred divination veils";
      break;
    case 0x8: // Ògúndá wave — CastCowries — Action
      category = "Control-Systems";
      baseRange = [1, 25]; // Control veils
      reasoning = "Path-clearing/action → control system veils";
      break;
    case 0x9: // Òsá wave — Sub — Storm
      category = "Physics-Chaos";
      baseRange = [126, 200]; // Physics (chaos focus)
      reasoning = "Storm/chaos → turbulence & fluid dynamics veils";
      break;
    case 0xA: // Ìkà wave — Swap — Karma
      category = "Economics";
      baseRange = [201, 300]; // Economics veils
      reasoning = "Karma/reversal → game theory & market veils";
      break;
    case 0xB: // Òtúrúpòn wave — HaltIfOne — Seal
      category = "Governance-Final";
      baseRange = [501, 600]; // Governance (consensus)
      reasoning = "Seal/completion → consensus & finality veils";
      break;
    case 0xC: // Òtúrá wave — PushConst1 — Destiny
      category = "Biology";
      baseRange = [301, 400]; // Biology veils
      reasoning = "Destiny/architecture → genetic & ecosystem veils";
      break;
    case 0xD: // Ìrẹtẹ̀ wave — Dup — Endurance
      category = "Media";
      baseRange = [601, 700]; // Media veils
      reasoning = "Patience/endurance → media generation & streaming veils";
      break;
    case 0xE: // Òsé wave — Add — Joy
      category = "Biology-Healing";
      baseRange = [301, 400]; // Biology (healing focus)
      reasoning = "Joy/sweetness → biological healing & restoration veils";
      break;
    case 0xF: // Òfún wave — HaltIfOne — Cosmic completion
      category = "Sacred-Complete";
      baseRange = [701, 777]; // Sacred veils (completion)
      reasoning = "Cosmic unity → sacred integration veils";
      break;
    default:
      category = "General";
      baseRange = [1, 25];
      reasoning = "Default routing";
  }

  // Select 3 specific veils within the range based on position
  const rangeSize = baseRange[1] - baseRange[0] + 1;
  const veils = [
    baseRange[0] + (position % rangeSize),
    baseRange[0] + ((position * 3 + 7) % rangeSize),
    baseRange[0] + ((position * 7 + 13) % rangeSize),
  ];

  // Remove duplicates
  const uniqueVeils = [...new Set(veils)];

  return {
    odu_index: oduIndex,
    odu_name: `Odù-${oduIndex}`,
    odu_archetype: category,
    recommended_veils: uniqueVeils,
    veil_category: category,
    reasoning,
  };
}

/**
 * Full routing: takes a birth result and returns veil recommendations.
 */
export function routeBirthToVeils(birthResult: {
  odu_index?: number;
}): OduVeilRoute | null {
  if (birthResult.odu_index === undefined) return null;
  return routeOduToVeils(birthResult.odu_index);
}

// ── DIP/VCP wiring — veil assignment via protocol layer ───────────────────────

const DIP_BASE  = process.env.DIP_URL   ?? 'http://127.0.0.1:7792';
const OSOVM_BASE = process.env.OSOVM_URL ?? 'http://127.0.0.1:7780';

export interface VeilAssignmentResult {
  agent_id:    string;
  veil_ids:    number[];
  odu_index:   number;
  category:    string;
  dip_routed:  boolean;
  osovm_acked: boolean;
  error?:      string;
}

/**
 * Assign veils to an agent:
 *  1. Compute veil recommendations from the Odù pattern (pure).
 *  2. Send the veil grant to DIP broker (POST /api/route) so it's
 *     propagated across the protocol mesh.
 *  3. Acknowledge to OSOVM via VEIL_GRANT opcode so vm.veil_grants
 *     is updated on the executing VM instance.
 *
 * Fail-open on both I/O steps.
 */
export async function assignVeilsViaProtocol(
  agentId: string,
  oduIndex: number,
): Promise<VeilAssignmentResult> {
  const route = routeOduToVeils(oduIndex);

  let dipRouted  = false;
  let osovmAcked = false;
  const errors: string[] = [];

  // Step 1: DIP broadcast — notify the mesh of the veil assignment
  try {
    const resp = await fetch(`${DIP_BASE}/api/route`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        route:   'veil_assignment',
        kind:    30005,  // Synapse kind: Orchestrator Verdict (veil grant)
        payload: {
          agent_id:   agentId,
          veil_ids:   route.recommended_veils,
          odu_index:  oduIndex,
          category:   route.veil_category,
          reasoning:  route.reasoning,
        },
        correlation_id: `veil:${agentId}:${oduIndex}`,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    dipRouted = resp.ok;
    if (!resp.ok) errors.push(`DIP route returned ${resp.status}`);
  } catch (e) {
    errors.push(`DIP unreachable: ${e}`);
  }

  // Step 2: OSOVM VEIL_GRANT opcode — update the VM's veil state
  try {
    const resp = await fetch(`${OSOVM_BASE}/run`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        opcode: 'VEIL_GRANT',
        args: {
          agent_id:  agentId,
          veil_ids:  route.recommended_veils,
          odu_index: oduIndex,
        },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await resp.json() as Record<string, unknown>;
    osovmAcked = resp.ok && result['success'] === true;
    if (!osovmAcked) errors.push(`OSOVM VEIL_GRANT: ${result['error'] ?? resp.status}`);
  } catch (e) {
    errors.push(`OSOVM unreachable: ${e}`);
  }

  return {
    agent_id:    agentId,
    veil_ids:    route.recommended_veils,
    odu_index:   oduIndex,
    category:    route.veil_category,
    dip_routed:  dipRouted,
    osovm_acked: osovmAcked,
    error:       errors.length > 0 ? errors.join('; ') : undefined,
  };
}
