import { dispatchToVM } from '../bridge/rlm-osovm';

async function main() {
  try {
    const result = await dispatchToVM({
      agent_pubkey: 'organism-core-e2e-test',
      think_hash: '0xTEST',
      opcode: 'NOT_A_REAL_OPCODE',
      payload: {},
    });
    console.log('UNEXPECTED SUCCESS:', JSON.stringify(result, null, 2));
    process.exit(1);
  } catch (err) {
    console.log('EXPECTED FAILURE SURFACED:', String(err).slice(0, 200));
    console.log('PASS: real failure is not masked as simulated success');
  }
}

main();
