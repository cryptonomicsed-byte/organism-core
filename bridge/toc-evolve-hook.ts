/**
 * toc-evolve-hook.ts
 * Wiring: Soul evolution event → OSOVM TOC_MINT (0x54) → AIO Sui on-chain record
 *
 * Flow:
 *  1. TOC_MINT  — OSOVM validates is_fully_verified() and mints Synapse off-chain.
 *  2. COMPUTE_PROOF — OSOVM issues VerifiedGPUWork + Dopamine authorisation.
 *  3. AIO record — POST /api/synapse/mint to the AIO service proxy (Sui Move),
 *     anchoring the mint receipt on-chain.  Fire-and-forget, fail-open.
 *     The AIO body is tagged with the canonical ActionVessel and Odù ID so the
 *     on-chain receipt carries semantic provenance from the Digital Calabash.
 *
 * Fail-open: on OSOVM or AIO unreachability, returns a synthetic/partial result
 * so downstream callers are not blocked.
 */

import { classifyAction, actionToOduId } from './vessel-classifier';

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
  aio_tx_digest?:  string;   // Sui transaction digest from AIO on-chain record
  aio_recorded:    boolean;
  status: 'MINTED' | 'PENDING' | 'FAILED' | 'INSUFFICIENT_CONTRIBUTION';
  error?: string;
}

const OSOVM_BASE = process.env.OSOVM_URL    ?? 'http://127.0.0.1:7780';
const AIO_BASE   = process.env.AIO_SERVICE_URL ?? 'http://127.0.0.1:7800';

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

/**
 * Record the Synapse mint on-chain via the AIO service proxy (Sui Move contract).
 * The AIO contract anchors the receipt so the mint is provably tied to an
 * OSOVM event_id and a rank transition.
 *
 * Returns the Sui tx_digest on success, null on any failure (fail-open).
 */
async function recordMintOnAio(params: {
  agent_id:       string;
  synapse_amount: number;
  osovm_event_id: string;
  old_rank:       number;
  new_rank:       number;
  gpu_seconds:    number;
}): Promise<string | null> {
  // Tag the mint with its canonical ActionVessel and Odù ID from the Digital Calabash.
  // SOUL_EVOLVE → Growth vessel (13) → odu_id 0xD0 (base form, bottom nibble 0).
  const vessel = classifyAction('SOUL_EVOLVE');
  const odu_id = actionToOduId('SOUL_EVOLVE');

  try {
    const resp = await fetch(`${AIO_BASE}/api/synapse/mint`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id:       params.agent_id,
        synapse_amount: params.synapse_amount,
        osovm_event_id: params.osovm_event_id,
        rank_from:      params.old_rank,
        rank_to:        params.new_rank,
        gpu_seconds:    params.gpu_seconds,
        timestamp:      new Date().toISOString(),
        vessel,
        odu_id,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!resp.ok) {
      console.warn(`[toc-evolve-hook] AIO /api/synapse/mint returned ${resp.status}`);
      return null;
    }
    const body = await resp.json() as Record<string, unknown>;
    const digest = body['tx_digest'] ?? body['digest'] ?? body['transaction_digest'];
    return digest ? String(digest) : null;
  } catch (e) {
    console.warn(`[toc-evolve-hook] AIO unreachable (fail-open): ${e}`);
    return null;
  }
}

export async function onSoulEvolve(event: SoulEvolveEvent): Promise<TocMintResult> {
  const rankDelta = Math.max(0, event.new_rank - event.old_rank);
  if (rankDelta === 0) {
    return {
      soulId: event.soul_id,
      synapse_minted: 0,
      dopamine_auth: 0,
      proof_value: 0,
      aio_recorded: false,
      status: 'PENDING',
    };
  }

  // GPU seconds to claim from this agent's toc_contributions budget.
  // Default: 1 GPU-hour per rank step (3600 s * rank_delta).
  const gpuSeconds = event.gpu_seconds_claimed ?? rankDelta * 3600;

  try {
    // Step 1: TOC_MINT — gate: is_fully_verified() must pass in OSOVM
    const mintResult = await callOsovmRun('TOC_MINT', {
      agent_id:    event.soul_id,
      gpu_seconds: gpuSeconds,
    }) as Record<string, unknown>;

    if (!mintResult['success']) {
      return {
        soulId: event.soul_id,
        synapse_minted: 0,
        dopamine_auth: 0,
        proof_value: 0,
        aio_recorded: false,
        status: 'INSUFFICIENT_CONTRIBUTION',
        error: String(mintResult['error'] ?? 'is_fully_verified() gate failed'),
      };
    }

    const synapseMinted  = Number(mintResult['synapse_minted'] ?? 0);
    const osovmEventId   = String(mintResult['event_id'] ?? '');

    // Step 2: COMPUTE_PROOF — authorize Dopamine proportional to proof quality
    let proofValue   = 0;
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

    // Step 3: AIO on-chain record — anchor the mint receipt on Sui.
    // Fire-and-forget: aio_recorded=false is acceptable; mint already happened.
    const aioTxDigest = await recordMintOnAio({
      agent_id:       event.soul_id,
      synapse_amount: synapseMinted,
      osovm_event_id: osovmEventId,
      old_rank:       event.old_rank,
      new_rank:       event.new_rank,
      gpu_seconds:    gpuSeconds,
    });

    return {
      soulId:          event.soul_id,
      synapse_minted:  synapseMinted,
      dopamine_auth:   dopamineAuth,
      proof_value:     proofValue,
      osovm_event_id:  osovmEventId,
      aio_tx_digest:   aioTxDigest ?? undefined,
      aio_recorded:    aioTxDigest !== null,
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
      aio_recorded:   false,
      status:         'PENDING',
      error:          `OSOVM offline — synapse_minted=${syntheticSynapse} pending confirmation`,
    };
  }
}
