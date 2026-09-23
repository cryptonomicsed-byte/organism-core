/**
 * bridge/event-bus.ts — Universal Event Bus
 *
 * Normalises events arriving from every world (Nostr, Sui, Freenet, Mesh,
 * DIP, Web2 webhooks) into a single UniversalEvent shape before they reach
 * If-Script / ActionVessel classification.
 *
 * Design constraints:
 *   - No key material here. Signing lives in the component that holds the key
 *     (same rule as nostr-wire.ts).
 *   - No network I/O. This module transforms shapes; callers wire transport.
 *   - Fail-open on unknown payloads: unknown fields are forwarded in metadata
 *     rather than dropped. If-Script's Rhythm vessel handles unrecognised kinds.
 *   - action_kind strings in NormalizedEvent are the same vocabulary consumed
 *     by vessel-classifier.ts::classifyAction(). Keep them in sync.
 *
 * Worlds model (from UNIVERSAL_AGENT_ARCHITECTURE):
 *   nostr   — Nostr relay events (kind numbers as keys)
 *   sui     — Sui MoveEvent / transaction effects
 *   freenet — Freenet mutable-state change notifications
 *   mesh    — Meshtastic offline mesh packets
 *   dip     — DIP envelopes (Rust DipEnvelope type)
 *   web2    — Generic HTTP webhooks from external services
 */

import { classifyAction } from './vessel-classifier';

// ── World names ───────────────────────────────────────────────────────────────

export type WorldName = 'nostr' | 'sui' | 'freenet' | 'mesh' | 'dip' | 'web2';

// ── Canonical event shape ─────────────────────────────────────────────────────

/**
 * The single envelope that flows through the bus regardless of origin world.
 *
 * `kind` uses world-native notation: 'nostr:1', 'sui:MoveEvent', 'dip:envelope'.
 * This lets consumers filter by world cheaply (`kind.startsWith('nostr:')`)
 * without parsing payload.
 *
 * `normalized` is the pre-computed If-Script-ready projection. Consumers that
 * only need to route to a vessel read `normalized.action_kind` rather than
 * inspecting `payload`.
 */
export interface UniversalEvent {
  world: WorldName;
  /** UURI string identifying the source node or agent. */
  source: string;
  /** Sovereign agent_id if the event is attributed to a specific agent. */
  agent_id?: string;
  /** World-native event kind, e.g. 'nostr:1', 'sui:MoveEvent', 'dip:envelope'. */
  kind: string;
  /** Raw world-native payload, preserved verbatim. */
  payload: unknown;
  /** Unix milliseconds. */
  timestamp: number;
  normalized: NormalizedEvent;
}

/**
 * World-agnostic projection used by If-Script / vessel routing.
 *
 * `action_kind` maps directly to vessel-classifier.ts::classifyAction().
 * Unknown kinds produce 'RHYTHM' (Rhythm vessel = fallback cadence).
 */
export interface NormalizedEvent {
  /** Uppercase action kind string — vocabulary shared with vessel-classifier. */
  action_kind: string;
  /** The acting entity (pubkey, agent_id, address — world-dependent). */
  actor?: string;
  /** The subject/target of the action (e.g. contract address, agent_id). */
  subject?: string;
  /** Numeric value if the action involves a quantity (ASE, stake, etc.). */
  value?: number;
  /** Remaining fields forwarded without loss. */
  metadata: Record<string, unknown>;
}

// ── Wire types from other worlds ──────────────────────────────────────────────
// These are minimal structural mirrors of the Rust/TypeScript types that live
// in their respective repos. Only the fields consumed here are listed.

/** Minimal NIP-01 signed event. Full type lives in nostr-wire.ts. */
export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;   // unix seconds
  kind: number;
  tags: string[][];
  content: string;
}

/** Minimal Sui MoveEvent shape from the Sui JSON-RPC. */
export interface SuiMoveEvent {
  type: string;          // e.g. "0xabc::ase_token::Transfer"
  sender: string;        // hex address
  packageId?: string;
  transactionModule?: string;
  bcs?: string;
  parsedJson?: Record<string, unknown>;
  timestampMs?: number;
}

/**
 * DipEnvelope — mirrors the Rust DipEnvelope in sovereign-stack/dip/src/envelope.rs.
 * Only the fields stable enough to rely on across versions are listed here.
 */
export interface DipEnvelope {
  envelope_id: string;
  sender_did: string;
  recipient_did?: string;
  adapter: string;       // e.g. "nostr", "a2a", "meshtastic", "libp2p"
  payload_kind: string;
  payload: unknown;
  timestamp: number;     // unix seconds
  signature?: string;
}

/** Generic HTTP webhook body — caller normalises field names before passing in. */
export interface WebhookPayload {
  event_type: string;
  actor_id?: string;
  subject_id?: string;
  value?: number;
  source?: string;
  timestamp?: number;
  data?: Record<string, unknown>;
}

/** Meshtastic mesh packet (minimal). */
export interface MeshtasticPacket {
  from: number;          // node number
  to: number;
  portnum: string;       // e.g. "TEXT_MESSAGE_APP", "TELEMETRY_APP"
  payload: string | Record<string, unknown>;
  rxSnr?: number;
  rxRssi?: number;
  hopLimit?: number;
  timestamp?: number;    // unix seconds
}

// ── Nostr kind → action_kind table ───────────────────────────────────────────
// Nostr kinds used by the sovereign ecosystem (from nostr-wire.ts + ecosystem spec).

const NOSTR_KIND_TO_ACTION: Record<number, string> = {
  0:     'GENESIS',         // kind 0 = agent profile / metadata
  1:     'THINK',           // kind 1 = short text / agent thought
  4:     'CONSENT_SIGN',    // kind 4 = encrypted DM (consent-bearing message)
  7:     'RECEIPT_EMIT',    // kind 7 = reaction / acknowledgment
  9735:  'RECEIPT_EMIT',    // zap receipt → economic acknowledgment
  22242: 'AUTHORIZE',       // NIP-42 relay auth
  30174: 'MEMORY_WRITE',    // NIP-AE agent engram
  31020: 'RECEIPT_EMIT',    // WitnessAttestation (Witness repo kind)
  31030: 'RECEIPT_EMIT',    // ObservationBundle (Witness repo kind)
  47001: 'CONSENT_SIGN',    // Crucible claim
  47002: 'ACK',             // Crucible attestation
};

// ── Bridge functions ──────────────────────────────────────────────────────────

/**
 * Normalise a NIP-01 Nostr event into a UniversalEvent.
 *
 * action_kind is derived from the kind number table above; unknown kinds fall
 * back to RHYTHM. The raw kind number is forwarded in metadata.nostr_kind so
 * consumers can dispatch on it without re-inspecting payload.
 */
export function nostrEventToUniversal(event: NostrEvent): UniversalEvent {
  const action_kind = NOSTR_KIND_TO_ACTION[event.kind] ?? 'RHYTHM';

  // Extract 'p' tag (subject pubkey) if present.
  const pTag = event.tags.find((t) => t[0] === 'p');
  const subject = pTag?.[1];

  // Extract 'e' tag (referenced event) for receipt-like events.
  const eTag = event.tags.find((t) => t[0] === 'e');

  return {
    world:     'nostr',
    source:    event.pubkey,
    agent_id:  event.pubkey,
    kind:      `nostr:${event.kind}`,
    payload:   event,
    timestamp: event.created_at * 1000,
    normalized: {
      action_kind,
      actor:   event.pubkey,
      subject,
      metadata: {
        nostr_kind:  event.kind,
        nostr_id:    event.id,
        referenced:  eTag?.[1],
        content_len: event.content.length,
      },
    },
  };
}

/**
 * Normalise a Sui MoveEvent into a UniversalEvent.
 *
 * The Move type string is mapped to an action_kind via a keyword scan so new
 * contract types are covered without an exhaustive table. Exact matches win
 * over keyword matches.
 */
export function suiEventToUniversal(event: SuiMoveEvent): UniversalEvent {
  const action_kind = suiTypeToActionKind(event.type);
  const tsMs = event.timestampMs ?? Date.now();

  // Attempt to extract a numeric value from parsedJson (covers ASE transfers, stakes).
  const value = extractNumericField(event.parsedJson, ['amount', 'value', 'stake', 'quantity']);

  // Subject = contract address extracted from the fully-qualified type string.
  const subject = event.packageId ?? event.type.split('::')[0];

  return {
    world:     'sui',
    source:    event.sender,
    agent_id:  undefined,   // caller enriches if they have an agent→address index
    kind:      `sui:${event.type}`,
    payload:   event,
    timestamp: tsMs,
    normalized: {
      action_kind,
      actor:   event.sender,
      subject,
      value,
      metadata: {
        sui_type:   event.type,
        module:     event.transactionModule,
        parsed:     event.parsedJson,
      },
    },
  };
}

/**
 * Normalise a DipEnvelope into a UniversalEvent.
 *
 * payload_kind (set by the Rust DipRouter) carries the ecosystem-level intent;
 * the adapter field tells us the transport. We map payload_kind directly to
 * action_kind (uppercased), falling back to RHYTHM for unknown kinds.
 *
 * DIP envelopes that carry ARP receipts (payload_kind "arp_receipt") map to
 * RECEIPT_EMIT so the vessel classifier routes them to the Receipt vessel.
 */
export function dipEnvelopeToUniversal(envelope: DipEnvelope): UniversalEvent {
  const action_kind = dipPayloadKindToAction(envelope.payload_kind);

  return {
    world:     'dip',
    source:    envelope.sender_did,
    agent_id:  undefined,   // DIDs are node identities; caller maps if needed
    kind:      `dip:${envelope.payload_kind}`,
    payload:   envelope,
    timestamp: envelope.timestamp * 1000,
    normalized: {
      action_kind,
      actor:   envelope.sender_did,
      subject: envelope.recipient_did,
      metadata: {
        envelope_id:  envelope.envelope_id,
        adapter:      envelope.adapter,
        payload_kind: envelope.payload_kind,
        signed:       envelope.signature !== undefined,
      },
    },
  };
}

/**
 * Normalise a generic HTTP webhook into a UniversalEvent.
 *
 * Web2 adapters vary wildly; this function applies the same vocabulary table
 * as vessel-classifier.ts so any event_type string from the caller's adapter
 * is honoured. Unknown types produce RHYTHM.
 */
export function web2WebhookToUniversal(webhook: WebhookPayload): UniversalEvent {
  const action_kind = classifyAction(webhook.event_type).toUpperCase();

  return {
    world:     'web2',
    source:    webhook.source ?? 'web2',
    agent_id:  webhook.actor_id,
    kind:      `web2:${webhook.event_type}`,
    payload:   webhook,
    timestamp: (webhook.timestamp ?? Math.floor(Date.now() / 1000)) * 1000,
    normalized: {
      action_kind,
      actor:   webhook.actor_id,
      subject: webhook.subject_id,
      value:   webhook.value,
      metadata: { ...(webhook.data ?? {}) },
    },
  };
}

/**
 * Normalise a Meshtastic mesh packet into a UniversalEvent.
 *
 * Mesh packets use portnum strings as action signals. Telemetry is a Loop tick;
 * text messages are Attention (agent thoughts surfaced from offline); position
 * updates feed the VCP/Spatial Twin layer as Execution.
 */
export function meshtasticPacketToUniversal(packet: MeshtasticPacket): UniversalEvent {
  const action_kind = meshnumToActionKind(packet.portnum);
  const tsMs = (packet.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;

  return {
    world:     'mesh',
    source:    String(packet.from),
    agent_id:  undefined,
    kind:      `mesh:${packet.portnum}`,
    payload:   packet,
    timestamp: tsMs,
    normalized: {
      action_kind,
      actor:   String(packet.from),
      subject: String(packet.to),
      metadata: {
        portnum: packet.portnum,
        snr:     packet.rxSnr,
        rssi:    packet.rxRssi,
        hops:    packet.hopLimit,
      },
    },
  };
}

// ── Bus class ─────────────────────────────────────────────────────────────────

type EventHandler = (event: UniversalEvent) => void;

/**
 * UniversalEventBus — in-process pub/sub hub.
 *
 * All bridge functions above produce UniversalEvents; publish them here and
 * every subscriber receives them in the same tick. The bus is synchronous and
 * in-process by design: transport (Nostr relay, WebSocket, HTTP) lives outside.
 *
 * Fail-open: a throwing handler is caught and logged; remaining handlers still
 * receive the event. Same contract as other fail-open points in the ecosystem.
 *
 * Usage:
 *   const bus = new UniversalEventBus();
 *   bus.subscribe(e => vesselClassify(e.normalized.action_kind));
 *   bus.publish(nostrEventToUniversal(rawEvent));
 */
export class UniversalEventBus {
  private readonly handlers: Set<EventHandler> = new Set();

  /** Register a handler to receive every event published to the bus. */
  subscribe(handler: EventHandler): void {
    this.handlers.add(handler);
  }

  /** Unregister a previously subscribed handler. */
  unsubscribe(handler: EventHandler): void {
    this.handlers.delete(handler);
  }

  /** Publish a pre-normalised UniversalEvent to all subscribers. */
  publish(event: UniversalEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        // fail-open: log and continue to next handler
        console.error('[event-bus] handler threw', err);
      }
    }
  }

  /**
   * Convenience: normalise a raw world payload and publish it in one call.
   *
   * `world` determines which bridge function is used. Pass a raw payload whose
   * shape matches the world's wire type. Unknown worlds fall through to
   * web2WebhookToUniversal with event_type='RHYTHM'.
   */
  publishRaw(world: WorldName, payload: unknown): void {
    let event: UniversalEvent;

    switch (world) {
      case 'nostr':
        event = nostrEventToUniversal(payload as NostrEvent);
        break;
      case 'sui':
        event = suiEventToUniversal(payload as SuiMoveEvent);
        break;
      case 'dip':
        event = dipEnvelopeToUniversal(payload as DipEnvelope);
        break;
      case 'mesh':
        event = meshtasticPacketToUniversal(payload as MeshtasticPacket);
        break;
      case 'web2':
      case 'freenet':
      default:
        event = web2WebhookToUniversal(payload as WebhookPayload);
        break;
    }

    this.publish(event);
  }

  /** Number of active subscribers. Useful for testing. */
  get subscriberCount(): number {
    return this.handlers.size;
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Map a Sui MoveEvent type string to an action_kind.
 *
 * Tries an exact-suffix match first (fastest path for known contracts), then
 * falls through to a keyword scan. Unknown → RHYTHM.
 */
function suiTypeToActionKind(moveType: string): string {
  const lower = moveType.toLowerCase();

  // Exact suffix matches for ecosystem contracts.
  const exactSuffix: Array<[string, string]> = [
    ['::ase_token::Transfer',       'TRANSFER'],
    ['::ase_token::Mint',           'TOC_MINT'],
    ['::ase_token::Burn',           'SEAL_VAULT'],
    ['::council_nft::Mint',         'GENESIS'],
    ['::council_nft::Transfer',     'MIGRATION'],
    ['::tile_governance::Staked',   'CONSENT_SIGN'],
    ['::tile_governance::Unstaked', 'RECEIPT_EMIT'],
    ['::agent_dnft::BirthEvent',    'AGENT_BIRTH'],
    ['::agent_dnft::EvolveEvent',   'SOUL_EVOLVE'],
    ['::agent_dnft::ForkEvent',     'FORK'],
    ['::sim_receipt::Submitted',    'PROOF_OF_SIM'],
    ['::wallet::Deposit',           'RECEIPT_EMIT'],
    ['::wallet::Withdraw',          'TRANSFER'],
  ];

  for (const [suffix, kind] of exactSuffix) {
    if (moveType.endsWith(suffix)) return kind;
  }

  // Keyword scan — catches new contracts whose names follow naming conventions.
  if (lower.includes('birth') || lower.includes('genesis')) return 'GENESIS';
  if (lower.includes('fork')  || lower.includes('evolve'))  return 'FORK';
  if (lower.includes('mint'))                                return 'TOC_MINT';
  if (lower.includes('burn')  || lower.includes('archive')) return 'SEAL_VAULT';
  if (lower.includes('stake') || lower.includes('consent')) return 'CONSENT_SIGN';
  if (lower.includes('transfer') || lower.includes('migrate')) return 'MIGRATE';
  if (lower.includes('receipt') || lower.includes('ack'))   return 'RECEIPT_EMIT';
  if (lower.includes('sim')   || lower.includes('proof'))   return 'SIMULATION_RUN';
  if (lower.includes('vote')  || lower.includes('proposal')) return 'CONSENT_SIGN';

  return 'RHYTHM';
}

/**
 * Map a DIP envelope payload_kind to an action_kind.
 *
 * payload_kind strings are set by the Rust DipRouter and are lower_snake_case.
 * We uppercase and check the vessel-classifier vocabulary; specific overrides
 * for ecosystem-specific kinds come first.
 */
function dipPayloadKindToAction(payloadKind: string): string {
  const overrides: Record<string, string> = {
    'arp_receipt':        'RECEIPT_EMIT',
    'vcp_command':        'TOOL_CALL',
    'vcp_session_open':   'CONSENT_SIGN',
    'vcp_session_close':  'RECEIPT_EMIT',
    'agent_message':      'THINK',
    'agent_birth':        'AGENT_BIRTH',
    'swarm_signal':       'SWARM_SIGNAL',
    'sim_result':         'SIMULATION_RUN',
    'witness_bundle':     'RECEIPT_EMIT',
    'heartbeat':          'HEARTBEAT',
    'peer_announce':      'MESH_BROADCAST',
    'gossip':             'MESH_BROADCAST',
    'capability_grant':   'CAPABILITY_GRANT',
    'capability_revoke':  'RESTRAINT',
  };

  if (overrides[payloadKind] !== undefined) return overrides[payloadKind];

  // Fall back to the vessel-classifier vocabulary (uppercased kind).
  return classifyAction(payloadKind.toUpperCase()).toUpperCase();
}

/**
 * Map a Meshtastic portnum string to an action_kind.
 */
function meshnumToActionKind(portnum: string): string {
  const mapping: Record<string, string> = {
    'TEXT_MESSAGE_APP':    'THINK',
    'REMOTE_HARDWARE_APP': 'TOOL_CALL',
    'POSITION_APP':        'JOB_EXECUTE',
    'NODEINFO_APP':        'AGENT_BIRTH',
    'ROUTING_APP':         'MESH_BROADCAST',
    'ADMIN_APP':           'AUTHORIZE',
    'TELEMETRY_APP':       'HEARTBEAT',
    'TRACEROUTE_APP':      'MESH_BROADCAST',
    'DETECTION_SENSOR_APP':'JOB_EXECUTE',
    'PAXCOUNTER_APP':      'HEARTBEAT',
    'STORE_FORWARD_APP':   'MEMORY_WRITE',
    'RANGE_TEST_APP':      'LOOP_TICK',
  };

  return mapping[portnum] ?? 'RHYTHM';
}

/**
 * Extract the first defined numeric field from a parsed JSON object.
 * Returns undefined if none of the candidate keys are present or are non-numeric.
 */
function extractNumericField(
  obj: Record<string, unknown> | undefined,
  keys: string[],
): number | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && isFinite(val)) return val;
    if (typeof val === 'string') {
      const parsed = Number(val);
      if (isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}
