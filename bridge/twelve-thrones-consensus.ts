/**
 * twelve-thrones-consensus.ts
 * Wiring: Twelve Thrones (epistemology engine) → Organism (verdict integration)
 *
 * Implements a deterministic 12-model consensus engine with:
 * - Truth-density scoring
 * - Disagreement NFT minting stub
 * - Mirror-Self KL-divergence check
 * - Ritual alignment via TechnosisAdapter
 * 
 * Falls back to local deterministic scoring if no external server is available.
 */

import * as crypto from "crypto";
import { alignConsensus } from "./spiral-time-bridge";

export interface ConsensusRequest {
  question: string;
  agent_id: string;
  think_hash: string;
}

export interface ConsensusVerdict {
  verdict: string;
  confidence: number;
  weightedYes: number;
  weightedNo: number;
  disagreement_severity: "unanimous" | "strong" | "moderate" | "severe";
  epistemic_map: {
    agreement_zones: string[];
    disagreement_zones: string[];
    knowledge_frontiers: string[];
  };
  truth_density: number;
  mirror_self_kl: number;
  ritual_alignment?: any;
  status: "live" | "deterministic" | "simulated";
}

/**
 * The 12 Thrones — each with a weight and epistemic domain.
 * In production, each would query a different LLM provider.
 */
const THRONES = [
  { id: 1,  name: "Throne of Logic",       weight: 1.2, domain: "deductive-reasoning" },
  { id: 2,  name: "Throne of Evidence",     weight: 1.3, domain: "empirical-data" },
  { id: 3,  name: "Throne of Precedent",    weight: 1.1, domain: "historical-patterns" },
  { id: 4,  name: "Throne of Ethics",       weight: 1.0, domain: "moral-reasoning" },
  { id: 5,  name: "Throne of Intuition",    weight: 0.8, domain: "pattern-recognition" },
  { id: 6,  name: "Throne of Skepticism",   weight: 1.1, domain: "counter-arguments" },
  { id: 7,  name: "Throne of Synthesis",    weight: 1.0, domain: "integrative-analysis" },
  { id: 8,  name: "Throne of Context",      weight: 0.9, domain: "situational-awareness" },
  { id: 9,  name: "Throne of Consequence",  weight: 1.0, domain: "impact-analysis" },
  { id: 10, name: "Throne of Memory",       weight: 0.9, domain: "collective-knowledge" },
  { id: 11, name: "Throne of Innovation",   weight: 0.8, domain: "novel-perspectives" },
  { id: 12, name: "Throne of Silence",      weight: 0.5, domain: "what-remains-unsaid" },
];

const THRONES_URL = process.env.TWELVE_THRONES_URL || "http://localhost:3000";

/**
 * Query the Twelve Thrones consensus engine.
 * Tries external server first, falls back to deterministic local scoring.
 */
export async function queryConsensus(
  request: ConsensusRequest
): Promise<ConsensusVerdict> {
  console.log(
    `[Twelve Thrones] Submitting "${request.question.slice(0, 40)}..." for epistemic verdict`
  );

  const forceReal =
    process.env.FORCE_REAL_THRONES === "true" ||
    process.env.REALLY_BREATHE === "true";

  // Try external Twelve Thrones server
  try {
    const res = await fetch(`${THRONES_URL}/api/consensus`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as any;

    const verdict = buildVerdict(data, "live");
    console.log(`[Twelve Thrones] LIVE: ${verdict.verdict} (${verdict.confidence.toFixed(1)}%)`);
    return await enrichWithRitual(verdict);
  } catch {
    if (forceReal) {
      throw new Error("Twelve Thrones server unreachable and FORCE_REAL_THRONES=true");
    }
  }

  // Deterministic local consensus
  console.log("[Twelve Thrones] Server offline. Running deterministic consensus.");
  return await runDeterministicConsensus(request);
}

/**
 * Deterministic consensus: each throne votes based on hash-derived scoring.
 * Not random — same input always produces same output.
 */
async function runDeterministicConsensus(
  request: ConsensusRequest
): Promise<ConsensusVerdict> {
  let totalWeightedYes = 0;
  let totalWeightedNo = 0;
  let totalWeight = 0;
  const throneVotes: { name: string; vote: "yes" | "no" | "abstain"; score: number }[] = [];

  for (const throne of THRONES) {
    // Deterministic vote: hash(question + throne_id + agent_id) → vote
    const voteHash = crypto
      .createHash("sha256")
      .update(`${request.question}:${throne.id}:${request.agent_id}`)
      .digest("hex");

    // First byte determines vote direction, second byte determines strength
    const voteDirection = parseInt(voteHash.slice(0, 2), 16);
    const voteStrength = parseInt(voteHash.slice(2, 4), 16) / 255;

    const isYes = voteDirection > 76; // ~70% approval rate for valid questions
    const isAbstain = throne.id === 12 && voteDirection > 200; // Throne of Silence abstains often

    if (isAbstain) {
      throneVotes.push({ name: throne.name, vote: "abstain", score: 0 });
      continue;
    }

    const weightedScore = throne.weight * voteStrength;
    if (isYes) {
      totalWeightedYes += weightedScore;
    } else {
      totalWeightedNo += weightedScore;
    }
    totalWeight += throne.weight;
    throneVotes.push({
      name: throne.name,
      vote: isYes ? "yes" : "no",
      score: weightedScore,
    });
  }

  // Normalize
  const total = totalWeightedYes + totalWeightedNo;
  const normalizedYes = total > 0 ? totalWeightedYes / total : 0.5;
  const normalizedNo = total > 0 ? totalWeightedNo / total : 0.5;
  const confidence = Math.abs(normalizedYes - normalizedNo) * 100 + 50;

  // Truth-density: ratio of strong agreements to total votes
  const strongVotes = throneVotes.filter((v) => v.score > 0.5);
  const truthDensity = strongVotes.length / Math.max(throneVotes.length, 1);

  // Disagreement severity
  const yesCount = throneVotes.filter((v) => v.vote === "yes").length;
  const noCount = throneVotes.filter((v) => v.vote === "no").length;
  let severity: ConsensusVerdict["disagreement_severity"];
  if (noCount === 0) severity = "unanimous";
  else if (noCount <= 2) severity = "strong";
  else if (noCount <= 4) severity = "moderate";
  else severity = "severe";

  // Mirror-Self KL divergence — real cross-entropy over throne confidence distributions.
  //
  // Model: treat the 12 thrones as two epistemic halves (first 6 vs last 6).
  // Compute the KL divergence KL(P ‖ Q) where P and Q are the per-throne
  // confidence score distributions (normalised to sum-to-1).
  // KL(P‖Q) = Σ p_i * log(p_i / q_i)  — uses natural log.
  // Symmetric variant: (KL(P‖Q) + KL(Q‖P)) / 2  (Jensen-Shannon inspired).
  const klDiv = _symmetricKL(
    throneVotes.slice(0, 6).map((v) => v.score),
    throneVotes.slice(6).map((v) => v.score),
  );

  // Disagreement NFT — fire-and-forget to Twelve-thrones Sui contract
  // (fail-open; if no TWELVE_THRONES_URL, log only)
  if (severity === "severe") {
    void _mintDisagreementNft(throneVotes, klDiv);
  }

  // Epistemic map
  const agreementZones = throneVotes
    .filter((v) => v.vote === "yes" && v.score > 0.3)
    .map((v) => v.name);
  const disagreementZones = throneVotes
    .filter((v) => v.vote === "no")
    .map((v) => v.name);
  const frontiers = throneVotes
    .filter((v) => v.vote === "abstain" || v.score < 0.2)
    .map((v) => `${v.name} (uncertain)`);

  const verdict: ConsensusVerdict = {
    verdict: normalizedYes > 0.5 ? "YES" : "NO",
    confidence: Math.min(99.0, confidence),
    weightedYes: parseFloat(normalizedYes.toFixed(3)),
    weightedNo: parseFloat(normalizedNo.toFixed(3)),
    disagreement_severity: severity,
    truth_density: parseFloat(truthDensity.toFixed(3)),
    mirror_self_kl: parseFloat(klDiv.toFixed(4)),
    epistemic_map: {
      agreement_zones: agreementZones,
      disagreement_zones: disagreementZones,
      knowledge_frontiers: frontiers,
    },
    status: "deterministic",
  };

  // KL divergence warning
  if (klDiv > 0.4) {
    console.log(`[Twelve Thrones] ⚠️ Mirror-Self KL divergence high: ${klDiv.toFixed(3)}`);
  }

  return await enrichWithRitual(verdict);
}

function buildVerdict(data: any, status: "live" | "deterministic" | "simulated"): ConsensusVerdict {
  return {
    verdict: data.verdict || "UNKNOWN",
    confidence: data.confidence || 50,
    weightedYes: data.weightedYes || 0.5,
    weightedNo: data.weightedNo || 0.5,
    disagreement_severity: data.disagreement?.severity || "moderate",
    truth_density: data.truth_density || 0,
    mirror_self_kl: data.mirror_self_kl || 0,
    epistemic_map: data.epistemic_map || {
      agreement_zones: [],
      disagreement_zones: [],
      knowledge_frontiers: [],
    },
    status,
  };
}

async function enrichWithRitual(verdict: ConsensusVerdict): Promise<ConsensusVerdict> {
  try {
    return await alignConsensus(verdict);
  } catch {
    return verdict;
  }
}

// ── KL divergence helpers ────────────────────────────────────────────────────

/** Normalise an array of non-negative scores to a probability distribution.
 *  Scores of 0 are clamped to ε to avoid log(0). */
function _normalise(scores: number[]): number[] {
  const EPS = 1e-9;
  const clamped = scores.map((s) => Math.max(s, EPS));
  const total   = clamped.reduce((a, b) => a + b, 0);
  return clamped.map((s) => s / total);
}

/** KL(P ‖ Q) = Σ p_i × ln(p_i / q_i) — base-e, finite for all p_i > 0, q_i > 0. */
function _kl(p: number[], q: number[]): number {
  return p.reduce((acc, pi, i) => {
    const qi = Math.max(q[i] ?? 1e-9, 1e-9);
    return acc + pi * Math.log(pi / qi);
  }, 0);
}

/** Symmetric KL: (KL(P‖Q) + KL(Q‖P)) / 2.
 *  Both arrays are normalised first; shorter array is zero-padded. */
function _symmetricKL(rawP: number[], rawQ: number[]): number {
  const len  = Math.max(rawP.length, rawQ.length);
  const pad  = (arr: number[]) => [...arr, ...Array(len - arr.length).fill(0)];
  const p    = _normalise(pad(rawP));
  const q    = _normalise(pad(rawQ));
  return parseFloat(((_kl(p, q) + _kl(q, p)) / 2).toFixed(6));
}

// ── Disagreement NFT ─────────────────────────────────────────────────────────

const TWELVE_THRONES_URL = process.env.TWELVE_THRONES_URL ?? '';

/** Mint a Disagreement NFT on Sui via the Twelve-thrones API.
 *  Fail-open — logs and returns, never throws. */
async function _mintDisagreementNft(
  throneVotes: Array<{ name: string; vote: string; score: number }>,
  klDiv: number,
): Promise<void> {
  const yesCount = throneVotes.filter((v) => v.vote === 'yes').length;
  const noCount  = throneVotes.filter((v) => v.vote === 'no').length;
  console.log(
    `[Twelve Thrones] ⚠️ SEVERE DISAGREEMENT — Yes:${yesCount} No:${noCount} KL:${klDiv.toFixed(4)}`
  );
  if (!TWELVE_THRONES_URL) return;
  try {
    await fetch(`${TWELVE_THRONES_URL}/api/nft/disagreement`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kl_divergence: klDiv,
        yes_count:     yesCount,
        no_count:      noCount,
        throne_votes:  throneVotes.map((v) => ({ name: v.name, vote: v.vote, score: v.score })),
        timestamp:     new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (e) {
    console.warn(`[Twelve Thrones] Disagreement NFT mint failed (fail-open): ${e}`);
  }
}
