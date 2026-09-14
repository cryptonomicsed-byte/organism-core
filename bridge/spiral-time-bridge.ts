/**
 * spiral-time-bridge.ts
 * Wiring: Ritual-Codex (sacred time) → Organism (all phases)
 * 
 * Bridges the Spiral Calendar (BTC Time + Gregorian convergence)
 * and TechnosisAdapter into the organism's nervous system.
 * Every phase of full-breath can query sacred time state.
 */

let SpiralCalendar: any = null;
let TechnosisAdapter: any = null;
let spiralInstance: any = null;

// Lazy-load the ESM modules from ritual-codex
async function ensureLoaded() {
  if (SpiralCalendar !== null) return;

  try {
    const spiralMod = await import("../../ritual-codex/spiral-calendar.js");
    SpiralCalendar = spiralMod.default || spiralMod.SpiralCalendar;
    const adapterMod = await import("../../ritual-codex/technosis-adapter.js");
    TechnosisAdapter = adapterMod.default;
    spiralInstance = new SpiralCalendar();
    console.log("[SpiralBridge] ✅ Ritual-Codex loaded");
  } catch (err) {
    console.warn("[SpiralBridge] ⚠️ Ritual-Codex unavailable. Gregorian fallback active.");
    SpiralCalendar = false; // Mark as attempted
  }
}

/**
 * Returns the full spiral calendar snapshot (BTC + Gregorian + convergence).
 */
export async function getSpiralSnapshot(): Promise<any> {
  await ensureLoaded();
  if (!spiralInstance) {
    return {
      gregorian: { day: new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() },
      spiral: { phase: "N/A", ritual_weight: 1.0, is_sabbath: new Date().getUTCDay() === 6 },
      btc: { block_height: 0 },
      fallback: true,
    };
  }
  return spiralInstance.snapshot();
}

/**
 * Returns the ritual weight multiplier for Àṣẹ operations.
 * Resonance = 2x, Normal = 1x, Opposition = 0.5x, Sabbath = 0.
 */
export async function getRitualWeight(): Promise<number> {
  await ensureLoaded();
  if (!spiralInstance) return 1.0;
  return spiralInstance.ritualWeight;
}

/**
 * Whether either BTC or Gregorian time says it's Sabbath.
 */
export async function isSabbath(): Promise<boolean> {
  await ensureLoaded();
  if (!spiralInstance) return new Date().getUTCDay() === 6;
  return spiralInstance.isSabbath;
}

/**
 * Whether BOTH BTC and Gregorian agree on Sabbath (deep rest).
 */
export async function isDeepSabbath(): Promise<boolean> {
  await ensureLoaded();
  if (!spiralInstance) return false;
  return spiralInstance.isDeepSabbath;
}

/**
 * Returns the active Òrìṣà archetypes for consciousness alignment.
 * On Resonance days, returns { mode: 'unified', primary: 'Ṣàngó' }.
 * On other days, returns { mode: 'dialogue', gregorian: ..., btc: ..., tension: ... }.
 */
export async function getActiveArchetypes(): Promise<any> {
  await ensureLoaded();
  if (!spiralInstance) {
    const dayIndex = new Date().getUTCDay();
    const orisa = [
      "Èṣù-Ẹ̀légbára", "Ṣàngó", "Ọṣun",
      "Ọ̀rúnmìlà", "Ọya", "Ògún", "Ọbàtálá"
    ];
    return { mode: "unified", primary: orisa[dayIndex] };
  }
  return spiralInstance.activeArchetypes;
}

/**
 * Returns the TechnosisAdapter plugin contract for Swibe hooks.
 * { onBirth, onThink, onReceipt, onSettle }
 */
export async function getPluginContract(): Promise<any> {
  await ensureLoaded();
  if (!TechnosisAdapter) {
    return {
      onBirth: () => {},
      onThink: () => {},
      onReceipt: () => {},
      onSettle: () => {},
    };
  }
  return TechnosisAdapter.toPluginContract();
}

/**
 * Aligns a consensus result with ritual context.
 */
export async function alignConsensus(consensusResult: any): Promise<any> {
  await ensureLoaded();
  if (!TechnosisAdapter) return consensusResult;
  return TechnosisAdapter.alignConsensus(consensusResult);
}

/**
 * Returns the current BTC block height (estimated).
 */
export async function getBTCBlockHeight(): Promise<number> {
  await ensureLoaded();
  if (!spiralInstance) return 0;
  return spiralInstance.btc.blockHeight;
}

/**
 * Returns the current halving epoch metadata.
 */
export async function getEpoch(): Promise<any> {
  await ensureLoaded();
  if (!spiralInstance) return { name: "Unknown", alchemy: "Unknown" };
  return spiralInstance.btc.epoch;
}
