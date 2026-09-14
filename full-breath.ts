/**
 * full-breath.ts — The Organism's Pulse
 * 
 * 1. Spiral Time Check (BTC + Gregorian convergence)
 * 2. Births an agent (Ifá → Swibe) with ritual alignment
 * 3. Thinks a thought (Swibe)
 * 3.5 Paradigm Shift (Paradigm -> Omokoda)
 * 4. Runs VM Dispatch (Omokoda → OSOVM)
 * 5. Audits receipt (Zangbeto)
 * 6. Epistemic consensus (Twelve Thrones)
 * 7. Sabbath Gate (Spiral Calendar dual-stream)
 * 8. Mints Àṣẹ/ToC on Sui (Reward) with ritual weight
 */

import { birthAgentFromIfa } from "./bridge/birth-ifa-swibe";
import { executeTask } from "./bridge/rlm-osovm";
import { auditReceipt } from "./bridge/zangbeto-audit";
import { queryConsensus } from "./bridge/twelve-thrones-consensus";
import { onSoulEvolve } from "./bridge/toc-evolve-hook";
import { applyParadigmWeights } from "./bridge/paradigm-omokoda";
import { createRequire } from "module";

const require = createRequire(import.meta.url || __filename);

// Load Spiral Calendar and Technosis Adapter from ritual-codex
let SpiralCalendar: any;
let TechnosisAdapter: any;

try {
  // Dynamic import for ESM modules from ritual-codex
  const spiralMod = await import("../ritual-codex/spiral-calendar.js");
  SpiralCalendar = spiralMod.default || spiralMod.SpiralCalendar;
  const adapterMod = await import("../ritual-codex/technosis-adapter.js");
  TechnosisAdapter = adapterMod.default;
} catch (err) {
  console.warn("⚠️ Ritual-Codex not available. Using Gregorian fallback.");
  SpiralCalendar = null;
  TechnosisAdapter = null;
}

async function fullBreath() {
  console.log("🌬️  THE ORGANISM BREATHES...\n");

  // --- 0. SPIRAL TIME (BTC + Gregorian) ---
  console.log("--- PHASE 0: SPIRAL TIME ---");
  let spiral: any = null;
  let spiralSnapshot: any = null;
  let ritualWeight = 1.0;

  if (SpiralCalendar) {
    spiral = new SpiralCalendar();
    spiralSnapshot = spiral.snapshot();
    ritualWeight = spiral.ritualWeight;

    console.log(`⟐ ${spiral.toString()}`);
    console.log(`  Gregorian: ${spiralSnapshot.gregorian.day} → ${spiralSnapshot.gregorian.orisa}`);
    console.log(`  BTC Block: ${spiralSnapshot.btc.block_height} → ${spiralSnapshot.btc.btc_orisa}`);
    console.log(`  Spiral Phase: ${spiralSnapshot.spiral.phase} | Weight: ${ritualWeight}x`);
    console.log(`  Epoch: ${spiralSnapshot.epoch.name} (${spiralSnapshot.epoch.alchemy})`);

    if (spiralSnapshot.spiral.is_resonance) {
      console.log(`  ✨ RESONANCE DAY — Double weight operations`);
    }
    if (spiralSnapshot.spiral.is_opposition) {
      console.log(`  ⚖️ OPPOSITION DAY — Reflect, don't act (0.5x weight)`);
    }
  } else {
    console.log("  (Gregorian fallback — no spiral time available)");
  }

  // --- 1. BIRTH (Ifá -> Swibe) ---
  console.log("\n--- PHASE 1: BIRTH ---");
  const entropy = { odu: [1, 0, 1, 1, 0, 1, 0, 1], seed: "0x369" };
  const birth = await birthAgentFromIfa(entropy);
  console.log(`✅ BORN: ${birth.agentId} | Key: ${birth.vibe_key.slice(0, 12)}...`);

  // Attach ritual alignment via TechnosisAdapter
  if (TechnosisAdapter) {
    TechnosisAdapter.onBirth(birth);
  }

  // --- 2. THOUGHT (Swibe Mock) ---
  console.log("\n--- PHASE 2: THOUGHT ---");
  const thought = "Who am I in the machine?";
  const thinkHash = "sha256-thought-" + Date.now(); 
  console.log(`💭 THINKING: "${thought}" (Hash: ${thinkHash})`);

  if (TechnosisAdapter) {
    TechnosisAdapter.onThink(thought, thinkHash);
  }

  // --- 2.5 PARADIGM SHIFT (Paradigm -> Omokoda) ---
  console.log("\n--- PHASE 2.5: PARADIGM SHIFT ---");
  const weightedVote = await applyParadigmWeights({
    agent_id: birth.agentId,
    vote: "APPROVE",
    timestamp: Date.now()
  });

  // --- 3. VM DISPATCH (Omokoda -> OSOVM) ---
  console.log("\n--- PHASE 3: VM EXECUTION ---");
  const vmResult = await executeTask({
    agent_pubkey: birth.vibe_key,
    think_hash: thinkHash,
    opcode: "COUNCIL_APPROVE",
    payload: { 
      question: thought,
      paradigm: weightedVote.paradigm,
      weight_modifier: weightedVote.weight_modifier
    }
  });
  console.log(`⚙️  VM RESULT: Hash ${vmResult.vm_task_hash} | F1: ${vmResult.f1_score}`);

  // --- 4. AUDIT (Zangbeto) ---
  console.log("\n--- PHASE 4: AUDIT ---");
  const audit = await auditReceipt({
    receipt_id: "rec-" + vmResult.vm_task_hash.slice(0, 8),
    hash: vmResult.vm_task_hash,
    signer: birth.agentId,
    opcodes: ["COUNCIL_APPROVE"]
  });
  
  if (audit.status !== "VERIFIED") {
    console.error("❌ AUDIT FAILED: HERESY DETECTED");
    return;
  }
  console.log(`🛡️  AUDIT: VERIFIED`);

  if (TechnosisAdapter) {
    TechnosisAdapter.onReceipt(vmResult.vm_task_hash);
  }

  // --- 5. EPISTEMIC CONSENSUS (Twelve Thrones) ---
  console.log("\n--- PHASE 5: EPISTEMIC CONSENSUS ---");
  let consensus = await queryConsensus({
    question: thought,
    agent_id: birth.agentId,
    think_hash: thinkHash
  });

  // Align consensus with ritual context
  if (TechnosisAdapter) {
    consensus = TechnosisAdapter.alignConsensus(consensus);
  }

  console.log(`⚡ VERDICT: ${consensus.verdict} (${consensus.confidence.toFixed(1)}% confidence, ${consensus.status})`);
  console.log(`   Disagreement: ${consensus.disagreement_severity}`);
  if (consensus.ritual_alignment) {
    console.log(`   Ritual: ${consensus.ritual_alignment.archetype} | ${consensus.ritual_alignment.principle}`);
  }

  // --- 6. SABBATH GATE (Spiral Calendar dual-stream) ---
  console.log("\n--- PHASE 6: SABBATH GATE ---");
  
  const isSabbath = spiral ? spiral.isSabbath : new Date().getUTCDay() === 6;
  const isDeepSabbath = spiral ? spiral.isDeepSabbath : false;
  
  if (isDeepSabbath) {
    console.log("🕊️  DEEP SABBATH (BTC + Gregorian aligned). The Organism enters deep rest. No operations.");
    return;
  }
  if (isSabbath) {
    console.log("🛑 SABBATH DETECTED. The Organism Rests. No Minting.");
    return;
  }
  console.log("✅ NOT SABBATH. Proceeding to Reward.");

  // --- 7. REWARD (Sui Mint with ritual weight) ---
  console.log("\n--- PHASE 7: REWARD (ToC/Àṣẹ) ---");
  
  if (vmResult.f1_score < 90) {
    console.log(`⚠️  F1 Score ${vmResult.f1_score} < 90. No Reward.`);
    return;
  }

  const PACKAGE_ID = process.env.SUI_PACKAGE_ID || "0xMockPackage";

  // Apply ritual weight to reward
  const baseAse = vmResult.ase_minted;
  const weightedAse = baseAse * ritualWeight;

  console.log(`💎 MINTING REWARD...`);
  console.log(`   > Package: ${PACKAGE_ID}`);
  console.log(`   > F1 Score: ${vmResult.f1_score}`);
  console.log(`   > Base Àṣẹ: ${baseAse} | Ritual Weight: ${ritualWeight}x | Final: ${weightedAse}`);
  
  if (spiralSnapshot) {
    console.log(`   > BTC Block: ${spiralSnapshot.btc.block_height} | Phase: ${spiralSnapshot.spiral.phase}`);
  }

  // Trigger local hook logic
  const evolve = await onSoulEvolve({
    soul_id: birth.agentId,
    new_rank: 2,
    old_rank: 1
  });

  if (TechnosisAdapter) {
    TechnosisAdapter.onSettle({ agentId: birth.agentId, ase: weightedAse });
  }
  
  console.log(`✅ MINTED: ${evolve.reward_minted} ToC`);
  console.log(`✅ MINTED: ${weightedAse} Àṣẹ (ritual-weighted)`);
  
  console.log("\n✨ FULL BREATH CYCLE COMPLETE. Àṣẹ.");
}

fullBreath().catch(console.error);
