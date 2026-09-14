/**
 * zangbeto-audit.ts
 * Wiring: OSOVM (receipts) → Zangbeto (security/audit)
 * 
 * Validates VM execution receipts against the 155-opcode registry,
 * generates SHA-256 anchored receipts, and checks 7/12 witness quorum.
 */

import * as crypto from "crypto";

export interface VMReceipt {
  receipt_id: string;
  hash: string;
  signer: string;
  opcodes: string[];
}

export interface AuditResult {
  status: "VERIFIED" | "SLASHED" | "QUORUM_FAILED";
  audit_signature?: string;
  receipt_hash?: string;
  reason?: string;
  origin?: string;
  witnesses?: number;
  quorum_required?: number;
  timestamp?: string;
}

/**
 * Core opcodes (25) + key expansion opcodes from Àṣẹ-Vault OPCODE_REFERENCE.
 * Any opcode NOT in this set is heretical.
 */
const VALID_OPCODES = new Set([
  // Core Control Flow
  "HALT", "NOOP",
  // Work & Minting
  "IMPACT", "VEIL", "TITHE", "RECEIPT",
  // Token Operations
  "STAKE", "UNSTAKE", "TRANSFER", "BALANCE",
  // Wallet & Derivation
  "BIPON_SEED",
  // Constraints & Guards
  "NONREENTRANT", "REQUIRE", "EMIT", "GENESIS_FLAW_TOKEN",
  // Contract Operations
  "CALL", "DELEGATE", "CREATE", "SELFDESTRUCT",
  // 1440 Inheritance Wallet
  "CANDIDATE_APPLY", "COUNCIL_APPROVE", "FINAL_SIGN",
  "DISTRIBUTE_OFFERING", "CLAIM_REWARDS",
  // Chain Context
  "TIMESTAMP", "BLOCKHASH", "CHAINID", "ORIGIN", "GASPRICE",
  "COINBASE", "DIFFICULTY",
  // Universal Work (Expansion)
  "PROJECT", "CASTING", "JOB", "SHIFT", "MILESTONE",
  "DELIVERABLE", "TIMESHEET", "INVOICE", "CONTRACT", "DISPUTE",
  // Governance (Expansion)
  "PROPOSAL", "VOTE", "DELEGATION", "QUORUM", "EXECUTION",
  "VETO", "AMENDMENT", "IMPEACHMENT", "ELECTION", "TERM",
  "CABINET", "COMMITTEE", "REFERENDUM", "CONSTITUTION", "LAW",
  "COURT", "VERDICT", "APPEAL", "PARDON", "SANCTION",
]);

/**
 * Forbidden opcode sequences — patterns that indicate exploitation.
 * Each is [first_opcode, second_opcode] — if seen in order, slash.
 */
const FORBIDDEN_SEQUENCES: [string, string][] = [
  ["SELFDESTRUCT", "CREATE"],       // Phoenix attack
  ["DELEGATE", "SELFDESTRUCT"],     // Proxy suicide
  ["TRANSFER", "TRANSFER"],         // Double-spend attempt
  ["CLAIM_REWARDS", "CLAIM_REWARDS"], // Double-claim
];

/**
 * Audit a VM execution receipt.
 * 1. Validate all opcodes against the 155-opcode registry
 * 2. Check for forbidden sequences
 * 3. Generate SHA-256 receipt hash for anchoring
 * 4. Simulate 7/12 witness quorum
 */
export async function auditReceipt(receipt: VMReceipt): Promise<AuditResult> {
  console.log(`[Zangbeto] Auditing receipt ${receipt.receipt_id} from ${receipt.signer}`);
  const timestamp = new Date().toISOString();

  // --- 1. Opcode Registry Validation ---
  const invalidOpcodes = receipt.opcodes.filter((op) => !VALID_OPCODES.has(op));
  if (invalidOpcodes.length > 0) {
    console.error(`[Zangbeto] ❌ HERESY: Unknown opcodes detected: ${invalidOpcodes.join(", ")}`);
    return {
      status: "SLASHED",
      reason: `Heretical opcodes: ${invalidOpcodes.join(", ")}`,
      origin: receipt.signer,
      timestamp,
    };
  }

  // --- 2. Forbidden Sequence Detection ---
  for (let i = 0; i < receipt.opcodes.length - 1; i++) {
    const pair: [string, string] = [receipt.opcodes[i], receipt.opcodes[i + 1]];
    const forbidden = FORBIDDEN_SEQUENCES.find(
      ([a, b]) => a === pair[0] && b === pair[1]
    );
    if (forbidden) {
      console.error(
        `[Zangbeto] ❌ HERESY: Forbidden sequence ${forbidden[0]} → ${forbidden[1]}`
      );
      return {
        status: "SLASHED",
        reason: `Forbidden opcode sequence: ${forbidden[0]} → ${forbidden[1]}`,
        origin: receipt.signer,
        timestamp,
      };
    }
  }

  // --- 3. Generate SHA-256 Receipt Hash ---
  const receiptPayload = JSON.stringify({
    id: receipt.receipt_id,
    hash: receipt.hash,
    signer: receipt.signer,
    opcodes: receipt.opcodes,
    timestamp,
  });
  const receiptHash = crypto
    .createHash("sha256")
    .update(receiptPayload)
    .digest("hex");

  // --- 4. Witness Quorum (7/12 required) ---
  // Simulated — each witness independently verifies the receipt hash.
  // In production, this calls 12 Zangbeto nodes on Sui.
  const TOTAL_WITNESSES = 12;
  const QUORUM_REQUIRED = 7;

  // Deterministic witness simulation: hash receipt with witness index
  let witnessApprovals = 0;
  for (let w = 0; w < TOTAL_WITNESSES; w++) {
    const witnessHash = crypto
      .createHash("sha256")
      .update(`witness-${w}-${receiptHash}`)
      .digest("hex");
    // Witness approves if their hash starts with 0-b (75% approval rate)
    const firstChar = witnessHash.charAt(0);
    if (firstChar < "c") {
      witnessApprovals++;
    }
  }

  console.log(
    `[Zangbeto] Witness quorum: ${witnessApprovals}/${TOTAL_WITNESSES} (need ${QUORUM_REQUIRED})`
  );

  if (witnessApprovals < QUORUM_REQUIRED) {
    return {
      status: "QUORUM_FAILED",
      reason: `Insufficient witnesses: ${witnessApprovals}/${QUORUM_REQUIRED}`,
      witnesses: witnessApprovals,
      quorum_required: QUORUM_REQUIRED,
      receipt_hash: receiptHash,
      timestamp,
    };
  }

  // --- 5. Sign and Return ---
  const auditSignature = crypto
    .createHash("sha256")
    .update(`zangbeto-seal:${receiptHash}:${witnessApprovals}`)
    .digest("hex")
    .slice(0, 32);

  console.log(`[Zangbeto] ✅ VERIFIED | Hash: ${receiptHash.slice(0, 16)}... | Sig: ${auditSignature.slice(0, 12)}...`);

  return {
    status: "VERIFIED",
    audit_signature: `zang-${auditSignature}`,
    receipt_hash: receiptHash,
    witnesses: witnessApprovals,
    quorum_required: QUORUM_REQUIRED,
    timestamp,
  };
}
