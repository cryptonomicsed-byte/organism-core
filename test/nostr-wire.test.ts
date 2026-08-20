/**
 * test/nostr-wire.test.ts
 *
 * Run: npx tsx test/nostr-wire.test.ts
 *
 * The first two tests are the load-bearing ones. A NIP-01 id is sha256 over
 * canonical JSON and the signature is over that id, so if serialization drifts
 * from the other implementations every event this module builds is rejected
 * ecosystem-wide — and nothing else here would notice. The slug tests guard the
 * same class of failure one layer up: a slug minipae refuses produces an engram
 * no minipae client can address.
 */

import assert from 'node:assert/strict';

import {
  KIND_AGENT_ENGRAM,
  KIND_CLAIM,
  buildClaim,
  buildEngram,
  buildSlug,
  buildUnsignedEvent,
  canonicalSerialize,
  eventId,
  isCrucible,
  isPublishable,
  normalizeSlugSegment,
  validateSlug,
} from '../bridge/nostr-wire';

const PUBKEY = 'a'.repeat(64);
let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

console.log('nostr-wire\n');

// === Serialization: agreement with Rust, Julia and Python ===

test('event id matches the cross-language vector for Yorùbá content', () => {
  // Pinned against the value independently computed in Rust, Julia, and Python
  // with ensure_ascii=False. Python's DEFAULT yields
  // f5ceda251451b3571736436644e34ca50eca23ad68ea3e067934e5f8668c2337 instead —
  // that is the bug this vector exists to catch.
  assert.equal(
    eventId({
      pubkey: PUBKEY,
      created_at: 1700000000,
      kind: 30174,
      tags: [],
      content: 'Òrìṣà Ògún',
    }),
    'e24b148552d35adf425c92e2e701ee3be6b4c86dbfd5fa2cc84a4c922250ac3b',
  );
});

test('non-ASCII is serialized raw, never \\u-escaped', () => {
  const s = canonicalSerialize({
    pubkey: PUBKEY,
    created_at: 1700000000,
    kind: 30174,
    tags: [],
    content: 'Òrìṣà Ògún',
  });
  assert.ok(s.includes('Òrìṣà Ògún'));
  assert.ok(!s.includes('\\u'));
});

test('canonical form has NIP-01 field order and no whitespace', () => {
  assert.equal(
    canonicalSerialize({
      pubkey: PUBKEY,
      created_at: 1700000000,
      kind: 30174,
      tags: [['d', 'abc']],
      content: 'x',
    }),
    `[0,"${PUBKEY}",1700000000,30174,[["d","abc"]],"x"]`,
  );
});

test('id changes when any signed field changes', () => {
  const base = {
    pubkey: PUBKEY,
    created_at: 1700000000,
    kind: 30174,
    tags: [] as string[][],
    content: 'x',
  };
  const id = eventId(base);
  assert.notEqual(id, eventId({ ...base, content: 'y' }));
  assert.notEqual(id, eventId({ ...base, created_at: 1700000001 }));
  assert.notEqual(id, eventId({ ...base, kind: 47001 }));
  assert.notEqual(id, eventId({ ...base, tags: [['d', 'a']] }));
});

// === Kinds ===

test('every kind this module emits is publishable', () => {
  assert.ok(isPublishable(KIND_AGENT_ENGRAM));
  assert.ok(isPublishable(KIND_CLAIM));
  assert.ok(!isPublishable(31337));
});

test('isPublishable does not claim the relay rejects other kinds', () => {
  // The relay accepts far more than this module emits — kind 1, 7, 30023,
  // 30315 and much of Buzz's vocabulary. false means "not ours", never
  // "refused". Conflating those over-restricted an earlier revision of the
  // Rust, JS and Julia implementations.
  assert.ok(!isPublishable(7));
  assert.ok(!isPublishable(1));
});

test('Crucible reserves 47000-47999 and nothing outside it', () => {
  assert.ok(isCrucible(47001));
  assert.ok(isCrucible(47999));
  assert.ok(!isCrucible(48000));
  assert.ok(!isCrucible(KIND_AGENT_ENGRAM));
});

test('an unadmitted kind throws before an event is built', () => {
  assert.throws(
    () => buildUnsignedEvent({ pubkey: PUBKEY, kind: 31337, content: '{}' }),
    /not one this module publishes under/,
  );
});

test('a malformed pubkey is rejected before an id is computed', () => {
  assert.throws(
    () => buildUnsignedEvent({ pubkey: 'nope', kind: KIND_CLAIM, content: '{}' }),
    /64 hex characters/,
  );
  assert.throws(
    () => buildUnsignedEvent({ pubkey: 'z'.repeat(64), kind: KIND_CLAIM, content: '{}' }),
    /64 hex characters/,
  );
});

// === Slugs ===

test('slug validation matches minipae grammar', () => {
  assert.ok(validateSlug('mem/organism/breath/one'));
  assert.ok(!validateSlug('mem/organism/Breath'), 'capitals rejected');
  assert.ok(!validateSlug('mem/organism/ọjọ́'), 'diacritics rejected');
  assert.ok(!validateSlug('mem/organism//x'), 'empty segments rejected');
  assert.ok(!validateSlug('organism/breath'), 'must start with mem/');
  assert.ok(!validateSlug(`mem/organism/${'x'.repeat(65)}`), 'segments cap at 64 bytes');
});

test('a Yorùbá name still yields a slug minipae accepts', () => {
  const slug = buildSlug('organism', 'breath', 'Ọ̀rúnmìlà-Ìwúre');
  assert.equal(slug, 'mem/organism/breath/orunmila-iwure');
  assert.ok(validateSlug(slug));
});

test('normalisation folds diacritics and case', () => {
  assert.equal(normalizeSlugSegment('Ọ̀rúnmìlà'), 'orunmila');
  assert.equal(normalizeSlugSegment('Ọjọ́ Ẹtì'), 'ojo-eti');
  assert.equal(normalizeSlugSegment('Earth + Metal'), 'earth-metal');
});

test('a segment that normalises to nothing fails loudly', () => {
  assert.throws(() => normalizeSlugSegment('!!!'), /normalises to nothing/);
  assert.throws(() => normalizeSlugSegment(''), /normalises to nothing/);
});

// === Event shapes ===

test('an unsigned event is complete except for sig', () => {
  const e = buildUnsignedEvent({
    pubkey: PUBKEY,
    kind: KIND_CLAIM,
    content: '{}',
    createdAt: 1700000000,
  });
  for (const f of ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content']) {
    assert.ok(f in e, `missing ${f}`);
  }
  assert.ok(!('sig' in e), 'this module holds no keys and must not fabricate a sig');
  assert.equal(e.id, eventId(e));
});

test('an engram carries the d and p tags NIP-AE requires', () => {
  const e = buildEngram({
    pubkey: PUBKEY,
    ownerPubkey: PUBKEY,
    dTag: 'deadbeef',
    content: '{"organ":"nex"}',
    extraTags: [['organ', 'nex']],
    createdAt: 1700000000,
  });
  const names = e.tags.map((t) => t[0]);
  assert.ok(names.includes('d'));
  assert.ok(names.includes('p'));
  assert.ok(names.includes('organ'));
  assert.equal(e.kind, KIND_AGENT_ENGRAM);
});

test('an engram refuses a raw slug in place of an HMACd d tag', () => {
  // minipae hashes the slug so a relay operator cannot enumerate what an organ
  // stores. This module has no key to compute the HMAC, so omitting it must
  // fail loudly rather than silently leak.
  assert.throws(
    () =>
      buildEngram({
        pubkey: PUBKEY,
        ownerPubkey: PUBKEY,
        dTag: '',
        content: '{}',
      }),
    /must be HMACd by the key owner/,
  );
});

test('a claim without a falsifier is refused rather than emitted', () => {
  assert.throws(
    () => buildClaim({ pubkey: PUBKEY, statement: 's', falsifier: '' }),
    /requires a falsifier/,
  );
});

test('a claim carries its falsifier and half-life', () => {
  const e = buildClaim({
    pubkey: PUBKEY,
    statement: 'the breath completed end to end',
    falsifier: 'sha256:abc',
    createdAt: 1700000000,
  });
  assert.equal(e.kind, KIND_CLAIM);
  assert.ok(e.tags.some((t) => t[0] === 'falsifier' && t[1] === 'sha256:abc'));
  assert.equal(JSON.parse(e.content).half_life_secs, 86400);
});

test('Yorùbá content round-trips through an engram body intact', () => {
  // Normalisation applies to slugs, never to content: the name a reader wants
  // must survive.
  const body = JSON.stringify({ orisha: 'Ọ̀rúnmìlà', ritual: 'ọjọ́-rú' });
  const e = buildEngram({
    pubkey: PUBKEY,
    ownerPubkey: PUBKEY,
    dTag: 'abc',
    content: body,
    createdAt: 1700000000,
  });
  const decoded = JSON.parse(e.content);
  assert.equal(decoded.orisha, 'Ọ̀rúnmìlà');
  assert.equal(decoded.ritual, 'ọjọ́-rú');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
