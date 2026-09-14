# NIP-31 — Embodiment, Spatial Mining, and Device Binding

> **Status: Draft · CC0 · Compatible with: Nostr NIP-01, NIP-32, NIP-33, NIP-17/44, minipae (NIP-AE 30174), OSOVM receipts, ip-layer (31900/1901/1902)**

## Abstract

This NIP defines three application event-kind ranges that the Ọmọ Kọ́dà
sovereign-agent ecosystem needs but had not yet specified:

- **Embodiment session** (31000–31003) — the pairing protocol by which an agent
  temporarily inhabits or co-pilots an external body (drone, robot, IoT).
- **Spatial mining receipt** (31010) — a proof-of-work record for environment
  capture / delta reconstruction in the OSOVM spatial economy.
- **Device binding** (31020) — the record binding an agent's npub to a physical
  device (and optionally a TEE attestation).

All three are ordinary signed Nostr events. Identity is always an **npub**
(NIP-06); SuiNS/settlement addresses are optional attributes, never the root.

---

## 1. Embodiment Session (31000–31003)

The agent is the **offerer** (holds the root npub and its long-term key). The
**body** is a drone/robot/IoT node running a minimal companion runtime that
holds only a device keypair — never the agent's nsec.

### Kind 31000 — Session Offer (agent → body)

Parameterized-replaceable on `d` (session id).

**Required tags**
- `d` — session id (hex or UUID)
- `state` — `OFFERED`
- `p` — the body's device pubkey (the offer target)
- `expiration` — unix timestamp after which the offer lapses

**Optional tags**
- `t` — repeatable; requested capabilities (e.g. `camera`, `motors`, `gps`)
- `constraint` — repeatable `key:value` strings (e.g. `geofence:..., max_speed:2`)
- `session_key` — the agent's ephemeral session pubkey for this session
- `deposit` — optional payment/deposit pointer

**Content** — JSON:
```json
{
  "agent": "<npub>",
  "capabilities": ["camera", "telemetry"],
  "constraints": {"geofence": "poly...", "max_speed_m_s": 2.0, "ttl_s": 600},
  "data_policy": "local-only | selective | public"
}
```

### Kind 31001 — Session Accept (body → agent)

Parameterized-replaceable on `d` (same session id as the offer).

**Required tags**
- `d` — session id (must match the offer)
- `state` — `ACCEPTED` (or `REJECTED`)
- `p` — the agent's pubkey
- `session_key` — the body's ephemeral session pubkey

**Content** — JSON:
```json
{
  "body": "<device pubkey>",
  "accepted_capabilities": ["camera", "telemetry"],
  "endpoints": {"command": "tcp://...", "telemetry": "tcp://..."},
  "challenge": "<nonce for mutual auth>"
}
```

### Kind 31002 — Session Heartbeat (ephemeral, NOT replaceable)

Periodic liveness + telemetry during an active session. Each heartbeat is its
own event (no `d` tag).

**Required tags**
- `d`-less; instead: `session` — the session id
- `p` — the peer pubkey

**Content** — JSON: `{"state": "ACTIVE", "ts": ..., "telemetry": {...}}`

### Kind 31003 — Session End + Final Receipt

Parameterized-replaceable on `d` (session id). Published by the agent (or
co-signed).

**Required tags**
- `d` — session id
- `state` — `ENDED`
- `p` — the body pubkey

**Content** — JSON:
```json
{
  "started_at": 1700000000,
  "ended_at": 1700000600,
  "work_summary_hash": "<sha256 of the work log>",
  "receipt_refs": ["<event ids of spatial/work receipts produced>"]
}
```

**Verification rules**
1. Every event's `sig` must verify against its `pubkey`.
2. A `31001`/`31003` must reference a `31000` with the same `d`.
3. The body may only publish `31001`, `31002`, `31003`; the agent may publish
   all four. A body publishing a `31000` is invalid (bodies don't offer).
4. Session keys (`session_key` tags) are ephemeral and MUST NOT be the agent's
   root key. The agent SHOULD sign via NIP-46 so the body never sees the nsec.

---

## 2. Spatial Mining Receipt (31010)

Parameterized-replaceable on `d` (receipt id). A proof-of-work record that the
agent mined/updated a spatial environment delta.

**Required tags**
- `d` — receipt id
- `L`/`l` — NIP-32 labels: `spatial/mining`, `work/receipt`
- `location` — area/tile identifier
- `base_map` — reference to the base map the delta was measured against
- `x` — SHA-256 of the delta payload (NIP-94-style content hash)

**Optional tags**
- `privacy` — `local` | `selective` | `public`
- `attestation` — reference to an optional TEE attestation (Nautilus) if the
  score was computed in an enclave
- `reward` — optional payment/reward claim pointer

**Content** — JSON:
```json
{
  "location": "tile:...",
  "base_map": "hivemapper:...",
  "delta_hash": "<sha256>",
  "scores": {"quality": 0.91, "coverage": 0.7, "novelty": 0.6},
  "sensors": ["camera", "depth"],
  "privacy": "selective",
  "reward_claim": "optional pointer"
}
```

**Verification rules**
1. `x` MUST be the SHA-256 of the delta payload the receipt claims.
2. `scores` MUST be in `[0, 1]`.
3. An `attestation` reference, if present, MUST resolve to a verifiable enclave
   quote (this is the one guarantee that stays on-chain via Nautilus/Sui).

---

## 3. Device Binding (31020)

Parameterized-replaceable on `d` (device fingerprint). Binds an agent's npub to
the hardware that hosts its primary body.

**Required tags**
- `d` — device fingerprint (e.g. SHA-256 of a hardware ID + software image hash)
- `p` — the agent npub being bound
- `created_at` — binding timestamp (also the event's own `created_at`)

**Optional tags**
- `attestation` — optional TEE hardware-attestation reference
- `owner` — optional owner npub (human) with recovery authority

**Content** — JSON:
```json
{
  "agent": "<npub>",
  "device_fingerprint": "<sha256>",
  "software_image_hash": "<sha256>",
  "attestation": "optional enclave quote ref",
  "owner_binding": "optional owner npub"
}
```

**Verification rules**
1. `d` MUST equal the device fingerprint declared in the content.
2. The event MUST be signed by the agent npub (the device claims no identity of
   its own beyond the fingerprint).
3. Recovery/migration is authorized by the `owner` pubkey or the BIPON39
   mnemonic, never by the device alone.

---

## 4. Kind Registry (additions to ENDGAME §9)

| Kind | Meaning | Replaceable | Repo |
|---|---|---|---|
| `31000` | Embodiment session offer | `d` (session id) | agent-phone |
| `31001` | Embodiment session accept/reject | `d` | agent-phone |
| `31002` | Embodiment session heartbeat | no | agent-phone |
| `31003` | Embodiment session end + receipt | `d` | agent-phone |
| `31010` | Spatial mining receipt | `d` (receipt id) | OSOVM |
| `31020` | Device binding / attestation | `d` (fingerprint) | agent-phone |

---

## 5. Namespaces & engrams

These events are the *wire record*. Their structured memory counterparts live
in minipae engrams under:

- `mem/embodiment/{session_id}` — the negotiated session contract
- `mem/spatial/{receipt_id}` — the spatial receipt, linked to the IP Root
- `mem/phone/device` — the device binding (see agent-phone `mem/phone/*`)
