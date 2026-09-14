/**
 * toc-evolve-hook.ts
 * Wiring: Soul evolution event → OSOVM TOC_MINT (0x54) opcode
 *
 * When an agent's soul rank increases, this hook submits a TOC_MINT
 * instruction to OSOVM via the /run endpoint.  OSOVM is the sole mint
 * authority; it validates is_fully_verified() before minting Synapse.
 *
 * Fail-open: on OSOVM unreachability, returns a synthetic result so
 * downstream callers are not blocked.
 */

export interface SoulEvolveEvent {
  soul_id: string;   // Omo-Koda2 agent_id
  new_rank: number;  // tier reached (0–5)
  old_rank: number;
  gpu_seconds_claimed?: number;  // GPU contribution to claim from vm.toc_contributions
}

export interface TocMintResult {
  soulId:          string;
  synapse_minted:  number;
  dopamine_auth:   number;
  proof_value:     number;
  osovm_event_id?: string;
  status: 'MINTED' | 'PENDING' | 'FAILED' | 'INSUFFICIENT_CONTRIBUTION';
  error?: string;
}

const OSOVM_BASE = process.env.OSOVM_URL ?? 'http://127.0.0.1:7780';

// Synapse reward per rank-level step — preserves original 11.11% reward logic
const SYNAPSE_PER_RANK = 1111;

async function callOsovmRun(opcode: string, args: Record<string, unknown>): Promise<unknown> {
  const resp = await fetch(`${OSOVM_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opcode, args }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OSOVM /run returned ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function onSoulEvolve(event: SoulEvolveEvent): Promise<TocMintResult> {
  const rankDelta = Math.max(0, event.new_rank - event.old_rank);
  if (rankDelta === 0) {
    return {
      soulId: event.soul_id,
      synapse_minted: 0,
      dopamine_auth: 0,
      proof_value: 0,
      status: 'PENDING',
    };
  }

  // GPU seconds to claim from this agent's toc_contributions budget.
  // Default: 1 GPU-hour per rank step (3600 s * rank_delta).
  const gpuSeconds = event.gpu_seconds_claimed ?? rankDelta * 3600;

  try {
    // Step 1: TOC_MINT — gate: is_fully_verified() must pass in OSOVM
    const mintResult = await callOsovmRun('TOC_MINT', {
      agent_id:   event.soul_id,
      gpu_seconds: gpuSeconds,
    }) as Record<string, unknown>;

    if (!mintResult['success']) {
      return {
        soulId: event.soul_id,
        synapse_minted: 0,
        dopamine_auth: 0,
        proof_value: 0,
        status: 'INSUFFICIENT_CONTRIBUTION',
        error: String(mintResult['error'] ?? 'is_fully_verified() gate failed'),
      };
    }

    const synapseMinted = Number(mintResult['synapse_minted'] ?? 0);

    // Step 2: COMPUTE_PROOF — authorize Dopamine proportional to proof quality
    let proofValue = 0;
    let dopamineAuth = 0;
    try {
      const proofResult = await callOsovmRun('COMPUTE_PROOF', {
        agent_id:         event.soul_id,
        job_id:           `soul-evolve:${event.soul_id}:${event.new_rank}`,
        provider_id:      'local',
        gpu_seconds:      gpuSeconds,
        f1_score:         0.0,  // soul evolution — no physical sim, neutral quality
        receipt_hash:     event.soul_id,
        environment_hash: `soul:${event.soul_id}:t${event.old_rank}-${event.new_rank}`,
      }) as Record<string, unknown>;

      if (proofResult['success']) {
        proofValue   = Number(proofResult['proof_value']         ?? 0);
        dopamineAuth = Number(proofResult['dopamine_authorized'] ?? 0);
      }
    } catch {
      // COMPUTE_PROOF failure doesn't block Synapse mint
    }

    return {
      soulId:          event.soul_id,
      synapse_minted:  synapseMinted,
      dopamine_auth:   dopamineAuth,
      proof_value:     proofValue,
      osovm_event_id:  String(mintResult['event_id'] ?? ''),
      status:          'MINTED',
    };

  } catch (err) {
    // Fail-open: OSOVM unreachable → synthetic pending result
    console.warn(`[toc-evolve-hook] OSOVM unreachable for ${event.soul_id}: ${err}`);
    const syntheticSynapse = rankDelta * SYNAPSE_PER_RANK;
    return {
      soulId:         event.soul_id,
      synapse_minted: syntheticSynapse,
      dopamine_auth:  0,
      proof_value:    0,
      status:         'PENDING',
      error:          `OSOVM offline — synapse_minted=${syntheticSynapse} pending confirmation`,
    };
  }
}
