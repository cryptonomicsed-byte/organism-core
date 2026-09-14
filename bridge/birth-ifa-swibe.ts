/**
 * birth-ifa-swibe.ts
 * Wiring: IfáScript (entropy) → Swibe (identity/birth)
 * 
 * Calls the IfáScript Rust binary to cast cowries and generate
 * a cryptographically-seeded agent identity from 256 Odù patterns.
 * Falls back to deterministic JS if the binary is unavailable.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as crypto from "crypto";

const exec = promisify(execFile);

export interface IfaEntropy {
  odu: number[]; // 8 binary bits (binary pattern)
  seed: string;  // Hex seed from entropy-generator
}

export interface BirthResult {
  agentId: string;
  vibe_key: string;
  status: "BORN" | "BORN_FALLBACK";
  odu_name?: string;
  odu_archetype?: string;
  odu_index?: number;
  interpretation_type?: string;
  orisha?: string[];
  intent?: string;
}

/**
 * Birth an agent using IfáScript's Rust entropy engine.
 * The binary casts 8 cowries using NIST beacon + ChaCha20 fallback,
 * maps to one of 256 Odù patterns, and derives a keypair seed.
 */
export async function birthAgentFromIfa(
  entropy: IfaEntropy,
  intent?: string
): Promise<BirthResult> {
  const birthIntent = intent || `sovereign-birth-${Date.now()}`;
  const forceReal = process.env.FORCE_REAL_IFA === "true" || process.env.REALLY_BREATHE === "true";

  console.log(`[Organism] Casting cowries with intent: "${birthIntent}"`);

  // Try the real IfáScript Rust binary first
  const binaryPath = path.resolve(__dirname, "../../Ifascript/target/release/ifascript");
  const debugPath = path.resolve(__dirname, "../../Ifascript/target/debug/ifascript");

  for (const binPath of [binaryPath, debugPath]) {
    try {
      const { stdout } = await exec(binPath, ["cast", "--intent", birthIntent]);
      const result = JSON.parse(stdout.trim());

      console.log(`[Organism] IfáScript LIVE: Odù ${result.odu.name} (${result.odu.archetype})`);
      console.log(`[Organism]   Index: ${result.odu.index} | Binary: ${result.odu.binary}`);
      console.log(`[Organism]   Oríṣà: ${result.odu.orisha?.join(", ") || "N/A"}`);
      console.log(`[Organism]   Source: ${result.odu.interpretation_type}`);

      return {
        agentId: `agent-${result.entropy.keypair_seed.slice(2, 18)}`,
        vibe_key: result.entropy.keypair_seed.slice(2), // Remove 0x prefix
        status: "BORN",
        odu_name: result.odu.name,
        odu_archetype: result.odu.archetype,
        odu_index: result.odu.index,
        interpretation_type: result.odu.interpretation_type,
        orisha: result.odu.orisha,
        intent: birthIntent,
      };
    } catch {
      // Try next binary path
      continue;
    }
  }

  // If we get here, binary is not available
  if (forceReal) {
    console.error("[Organism] ❌ FATAL: IfáScript binary not found and FORCE_REAL_IFA=true.");
    throw new Error("IfáScript binary not available");
  }

  // Deterministic JS fallback using provided entropy
  console.warn("[Organism] ⚠️ IfáScript binary not available. Using JS entropy fallback.");

  const odu_binary = entropy.odu.join("");
  const combined = odu_binary + entropy.seed + birthIntent;

  // SHA-256 for keypair seed (deterministic)
  const hash = crypto.createHash("sha256").update(combined).digest("hex");

  // Domain-separated second hash for the keypair
  const keypairSeed = crypto
    .createHash("sha256")
    .update(`ifascript-keypair-v1:${hash}${birthIntent}`)
    .digest("hex");

  console.log(
    `[Organism] JS Fallback: Odu pattern ${odu_binary} → seed ${hash.slice(0, 16)}...`
  );

  return {
    agentId: `agent-${keypairSeed.slice(0, 16)}`,
    vibe_key: keypairSeed,
    status: "BORN_FALLBACK",
    odu_index: parseInt(odu_binary, 2),
    intent: birthIntent,
  };
}
