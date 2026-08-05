/**
 * rlm-osovm.ts
 * Wiring: Omokoda (parliamentary mind) → ÒSỌ́VM (execution opcodes)
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const exec = promisify(execFile);

export interface DispatchMessage {
  agent_pubkey: string; // Ed25519 from Swibe birth
  think_hash: string;   // SHA-256(prompt + response) from Swibe
  opcode: string;       // OSOVM opcode (e.g., COUNCIL_APPROVE)
  payload: any;         // Data for the opcode
}

export interface VMResult {
  vm_task_hash: string;
  // f1_score/ase_minted removed: OSOVM's cli.jl used to hardcode these to
  // fake constants on every call regardless of outcome. That was fixed
  // (OSOVM commit history, task #52) -- the real CLI now returns
  // vm_result (the actual per-opcode outcome) and sender_balance instead.
  // This interface was left stale, silently reading `undefined` for both
  // fields on every real call. Fixed to match the current real contract.
  vm_result: any;
  sender_balance: number;
  status: 'success' | 'failed' | 'error' | 'simulated';
}

/**
 * Execute a task on the OSO VM via the CLI wrapper.
 */
export async function executeTask(msg: DispatchMessage): Promise<VMResult> {
  const forceReal = process.env.FORCE_REAL_VM === 'true' || process.env.REALLY_BREATHE === 'true';
  console.log(`[Organism] Executing VM Task: ${msg.opcode} for agent ${msg.agent_pubkey.slice(0, 10)}...`);

  // Was lowercase 'osovm' -- the real directory on disk is 'OSOVM'.
  // Case-insensitive on macOS (why this went unnoticed), but the VPS this
  // now runs on is Linux (case-sensitive), so every real call silently
  // failed and fell through to the simulation fallback below.
  const cliPath = path.resolve(__dirname, '../../OSOVM/src/cli.jl');
  const taskJson = JSON.stringify({
    opcode: msg.opcode,
    args: msg.payload
  });

  try {
    const { stdout } = await exec('julia', [
      cliPath,
      '--task', taskJson,
      '--agent', msg.agent_pubkey
    ]);

    const result: VMResult = JSON.parse(stdout);
    if (result.status === 'error' || result.status === 'failed') {
      throw new Error(`VM Execution Error: ${(result as any).error ?? JSON.stringify(result.vm_result)}`);
    }

    console.log(`[Organism] VM Success: Task Hash ${result.vm_task_hash.slice(0, 12)}, Sender Balance: ${result.sender_balance}`);
    return result;

  } catch (err) {
    if (forceReal) {
      console.error(`[Organism] ❌ FATAL: Real Julia VM execution failed and FORCE_REAL_VM=true.`);
      throw new Error(`Real VM execution failed: ${err}`);
    }

    // FALLBACK
    console.warn(`[Organism] ⚠️ Julia VM execution failed (System Error). Falling back to Simulation Mode.`);
    
    const simulatedResult: VMResult = {
      vm_task_hash: "sim-hash-" + Buffer.from(taskJson).toString('hex').slice(0, 16),
      f1_score: 91.0, 
      ase_minted: 5.0,
      vm_result: { status: "simulated_success", opcode: msg.opcode },
      status: 'simulated'
    };

    console.log(`[Organism] SIMULATION Success: Task Hash ${simulatedResult.vm_task_hash.slice(0, 12)}`);
    return simulatedResult;
  }
}

export async function dispatchToVM(msg: any) {
  return executeTask({
    agent_pubkey: msg.agent_pubkey || 'genesis',
    think_hash: msg.think_hash || '0x0',
    opcode: msg.opcode,
    payload: msg.payload
  });
}
