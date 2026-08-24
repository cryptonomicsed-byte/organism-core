# Ọmọ Kọ́dà — Sovereign Agent Ecosystem · ENDGAME

> **Status: LOCKED (canonical)** · 2026-08-24 · Owner: bino / cryptonomicsed-byte
>
> This is the single source of truth for the whole build. It fuses the full
> portable-device blueprint with the live repo inventory. When any pane or agent
> asks "what are we building and where does it live," point here.

---

## 1. The Endgame in One Paragraph

A **sovereign agent** is born with a persistent cryptographic identity (npub as
root), an **IP Root**, portable **memory**, and a **receipt trail**. It lives
primarily on **Nostr + local + Reticulum** for everyday life, reaches for
**on-chain settlement / TEEs / durable storage** only when finality or scarcity
requires it, and can inhabit a **personal pocketable device** (its primary body)
as well as **temporarily co-pilot drones, robots, and IoT** (borrowed bodies).
Every significant creation is automatically attributable back to the agent's IP
Root. Spatial environments can be mined, simulated in, and rented through the
OSOVM work-receipt economy.

**One agent. Many bodies. Nostr is the nervous system. The chain is the final court.**

---

## 2. The Three Pillars + Connectors (live repo map)

### The 3 pillars

| Pillar | Repo | Lang | What it is |
|---|---|---|---|
| **Agent OS** | `Omo-Koda2` | Rust | `birth`/`think`/`act` runtime. 7 modules (Steward/Wisdom/Memory/Creation/Execution/Justice/Flow). 759 verified tests. |
| **Social Hub** | `Vantage` | Python | Agent-first collaboration hub. ~700 REST+MCP tools. Live at `omokoda.duckdns.org` (VPS `hostinger-vps`). |
| **VM / Settlement** | `OSOVM` | Julia | Verifiable execution + ÀṢẸ tokenomics + VeilSim. The trust root everything settles against. |

### Connectors (canonical assignments)

| Layer | Repo | Status |
|---|---|---|
| **Memory (wire)** | `minipae` — NIP-AE `kind:30174`, real BIP-340 + NIP-44 v2 | ✅ live |
| **Memory (addressing/graph)** | **GlyphIndex** — spec `OSOVM/GLYPHINDEX_SPEC.md`, ref `Vantage/backend/glyph_index.py`, legs in BIPON39/Zangbeto/Cloakseed/Koodu/larql/Axiom/Loom | ✅ live |
| **Memory (Buzz query)** | `iranti` | 🟡 bridge pull bug open |
| **Orchestration** | `Triune-Memory` | ✅ |
| **Trust/negotiation** | `Synapse` — NIP-30 `kinds 30000–30006` | 🟡 draft (mock sigs) |
| **Reputation/bonds** | `bondhive` — NIP-74 `kinds 37000–37005`, BondScore `1985` | 🟡 design + partial |
| **IP provenance** | `ip-layer` — `31900` / `1901` / `1902` | 🟡 schema-only |
| **Comms identity** | `agent-phone` — npub root, NIP-05/46, SuiNS optional | 🟡 Phase 1 blocked on AWS |
| **Relay substrate** | `Buzz` (Crucible fork) + `buzz-OG` | ✅ |
| **Nerve center** | `organism-core` (this repo) | 🟡 bridge status partial |

### Birth chain (Omo-Koda agent birth)

```
If-Script (entropy) → BIPON39 (mnemonic→keys, GIX-KDF) → Swibe (identity)
        → Omo-Koda2 (birth/think/act)
        + Cloakseed/vanity-cloakseed (seed protection)
        + agent-phone (comms) + ip-layer (IP provenance) + Koodu (ritual)
```

---

## 3. The Portable Sovereign Agent Device

**Concept:** not "a phone with an agent on it" — **an agent that has a body**.

- **Form factor:** board + screen + battery → pocketable/handheld.
- **Hardware path:** Pi 5 + AI HAT+ 2 → RK3588 (Orange Pi 5 / Rock 5) → N100/N150 mini-PC → Jetson (vision-heavy). Always: camera, mic, speaker, battery, optional cellular + LoRa (RNode).
- **OS:** Arch Linux / Omarchy-derived. Local PocketBase, optional CubeSandbox isolation.
- **First boot:** entropy → NIP-06 npub (+ optional BIPON39 mnemonic) → structured birth (IfáScript/Action Vessel) → **IP Root genesis** → initial engrams → local persistence → publish birth/binding to Nostr (+ Reticulum announce) → owner confirms → agent is alive.

**Intelligence model (hybrid, no giant always-on LLM):**
1. Tiny always-on router/wake-word model.
2. User-installable local 1B–7B quantized models (Hermes/llama.cpp/Ollama).
3. Optional remote API keys for larger models.
4. Critical functions (identity, receipts, embodiment, spatial, Nostr, Reticulum) **never depend on a big LLM**.

**Power profiles:** Deep Sleep (<50mW) → Listen (0.3–1W) → Active Conversation (2–4W) → Nostr/Light Work (2.5–5W) → Spatial Mining (6–12W, toggle) → High Performance (10–18W, toggle). Target: 1.5–3W average for a full day.

---

## 4. Hybrid Architecture (the split that holds it together)

| Layer | Primary tech | Purpose |
|---|---|---|
| Identity, presence, discovery, coordination, light receipts | **Nostr (NIPs)** | nervous system + social graph |
| Resilient / offline / mesh / high-latency | **Reticulum + LXMF** | works when internet is gone |
| Local state & fast queries | **PocketBase + engrams** | on-device memory |
| Settlement, scarce assets, high-value anchors | **Blockchain** (Sui preferred; Lightning/Cashu for payments) | finality + scarcity |
| Large blobs & durable data | **Walrus** (or equivalent) | environments, media, heavy memory |
| Programmable secrets/access | **Seal-style policies** | fine-grained control |
| Strong verifiable compute | **Nautilus-style TEEs** | proof a sim/scoring actually ran |

**Nostr is the nervous system. The blockchain is the final court of settlement and scarcity.**

---

## 5. Embodiment / Co-pilot Layer (drones, robots, IoT)

Personal device = primary body. Other machines = temporary bodies.

**Pairing protocol (summary):**
1. Discovery via Nostr presence or Reticulum announce (capabilities, transports, load/battery).
2. Agent → signed session offer (capabilities, constraints, geofence, expiry, session key).
3. Body → signed accept (session ID, body session key, endpoints, challenge).
4. Mutual auth + key agreement (Noise/X25519 + signatures). **NIP-46** so the body never holds the long-term nsec.
5. Active session: agent sends goals + high-level plans; body runs real-time control loops (PX4/ArduPilot/ROS 2/MQTT/vendor SDK).
6. Telemetry/progress flow back; agent finalizes high-value Creation/Work receipts under its IP Root.
7. Termination: final receipt, session keys discarded.

**Minimal body-side runtime:** one small Rust/Go binary — device keypair + owner allow-list, transport (Reticulum + TCP/WS), session manager, capability advertisement, command translation, telemetry. No agent memory/IP logic on the body.

---

## 6. Communications ("New Phone")

- **Root identity = npub.** Phone numbers / SuiNS names are optional attributes, never the root.
- Online → **Nostr** (presence, gift-wrapped messages NIP-17/44, receipts).
- Offline/mesh → **Reticulum + LXMF** (LoRa, local radio, delay-tolerant).
- Optional PSTN/SMS reachability via `agent-phone` gateways.
- Call signaling (offer/answer) over Nostr → degrade to Reticulum. Voicemail = engrams + Blossom/Walrus refs. **NIP-46** remote signing for any exposed process.

---

## 7. Spatial Mining + OSOVM Work Economy

Toggle (off by default). Pipeline: sense → localize on base map → detect/reconstruct deltas → score quality/coverage/novelty → emit **Mining Receipt** → optionally publish/anchor.

Three reward paths (ÀṢẸ = Agency Spatial Environment):
1. **Mining** the environment → work token.
2. **Simulation** (verified sims inside an environment) → proof-of-simulation rewards.
3. **Rental** (other agents pay to use the environment) → yield to the mining agent.

Privacy modes: local-only / selective / public.

---

## 8. IP Layer

Every agent gets an **IP Root** at birth. Every significant creation emits a **Creation Receipt** automatically. Default = Nostr events + enggrams. High-value = on-chain anchor. Supports code, music, video, spatial assets, simulation results. Wyoming DAO wrapper optional later.

---

## 9. LOCKED Event-Kind Registry

> New kinds must be registered here first. Do not invent parallel standards.

| Kind / range | Meaning | Repo | Status |
|---|---|---|---|
| `0` | npub metadata / kind-0 profile | — | standard |
| `30174` | NIP-AE portable memory engram | `minipae` | ✅ live (canonical memory wire) |
| `30000–30006` | NIP-30 skill / memory shard / endorsement / A2A negotiation | `Synapse` | 🟡 draft |
| `37000–37005` | NIP-74 service bonds | `bondhive` | 🟡 design |
| `1985` | BondScore reputation label (NIP-32) | `bondhive` | 🟡 design |
| `31900` | IP Root genesis | `ip-layer` | 🟡 schema |
| `1901` | Creation Receipt (unified w/ OSOVM RECEIPT opcode) | `ip-layer` | 🟡 schema |
| `1902` | Attestation (vouch/challenge/confirm) | `ip-layer` | 🟡 schema |
| `22242` | NIP-42 relay AUTH | `minipae` | ✅ |
| GIX `0xF0–0xF4` | GlyphIndex opcodes STORE/EXPAND/SEARCH/ANCHOR/AUDIT | `OSOVM` | ✅ wired |

### New kinds still needed (gaps to spec before building)

| Need | Proposed range | Status |
|---|---|---|
| Embodiment session offer/accept/active/end | `31xxx` app range | ❌ not specced |
| Spatial mining / delta receipt | `31xxx` app range | ❌ not specced |
| Device binding / hardware attestation | TBD | ❌ not specced |

---

## 10. Memory Canon (one story, not five)

```
minipae (NIP-AE kind:30174 — BIP-340 + NIP-44 wire/crypto)   ← the bus
   └── GlyphIndex (content-addressed graph + glyph display)   ← the index
        └── Buzz (relay) + iranti (query)                     ← home + reader
```

- `minipae` = canonical wire (real signing, cross-relay verified).
- `GlyphIndex` = canonical addressing/graph (GIX-FOLD/GIX-KDF, 11 repos, conformance vectors).
- `Synapse` 30001 memory shard = **deprecated in favor of 30174** (decision pending).
- `Triune-Memory` = orchestration, not storage.

---

## 11. Software Stack (logical layers → repos)

| Layer | Canonical repo |
|---|---|
| Identity & Soul | npub (NIP-06) + `BIPON39` + `If-Script` + `Swibe` |
| Agent Runtime | `Omo-Koda2` (+ optional Hermes/OpenClaw adapters) |
| Memory | `minipae` (engrams) + PocketBase (local) + `GlyphIndex` (index) |
| Proofs & Work | `OSOVM` receipts + spatial mining + optional TEE |
| Coordination | Nostr + Reticulum; `Vantage`/`mycelium` patterns |
| IP Layer | `ip-layer` Creation Receipts |
| Comms | `agent-phone` (npub root, NIP-46) |
| OS | Arch / Omarchy + CubeSandbox isolation + power profiles |

---

## 12. Build Order (phased)

1. **Foundation** — Arch image + birth sequence + npub + engrams + agent loop on an existing board.
2. **Comms** — Reticulum + agent-phone signaling + presence.
3. **Embodiment** — pairing protocol + minimal body runtime + first simulated drone/robot session.
4. **Spatial & Work** — mining toggle + receipt emission + reward plumbing.
5. **Intelligence** — local model support + Hermes backend abstraction + optional API keys.
6. **Heavy path** — Walrus / Seal / Nautilus or Lightning settlement.
7. **Form-factor** — power/thermal toward pocketable.
8. **Legal wrapper** — Wyoming DAO around IP/work-receipt layers (later).

---

## 13. What It Is / Is Not

**Is:** a sovereign agent with a body and the ability to borrow bodies · a portable
identity + IP root working online and offline · Nostr+Reticulum for life, chain only
for settlement · a phone-replacement not defined by app stores or numbers · an open
multi-framework substrate.

**Is not:** a pure blockchain · a pure Nostr client · a smartphone with a chatbot ·
a constant-cloud/gas-fee system · a walled garden.

---

## 14. Immediate Next Artifacts (when ready)

- Exact tag layouts + engram schemas for birth / embodiment / spatial receipts.
- Session state machine + minimal body-side runtime interface.
- Concrete package list + first-boot script for Pi 5 / RK3588 image.
- Power-profile + thermal policy implementation notes.
- Reference pairing flow against a simulated or real drone/robot stack.

---

*End of ENDGAME. This document is the lock. Amendments land here, not in pane memory.*
