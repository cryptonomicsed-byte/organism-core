import { dispatchToVM } from '../bridge/rlm-osovm';

async function main() {
  const result = await dispatchToVM({
    agent_pubkey: 'organism-core-e2e-test',
    think_hash: '0xTEST',
    opcode: 'BALANCE',
    payload: {},
  });
  console.log('RESULT:', JSON.stringify(result, null, 2));
  if (result.status === 'simulated') {
    console.error('FAIL: still simulated, real call did not happen');
    process.exit(1);
  }
  console.log('PASS: real live call succeeded');
}

main();
