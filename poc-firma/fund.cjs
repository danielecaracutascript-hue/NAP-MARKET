const fs = require('fs');
const { lib, NETWORK, buildDescriptor } = require('./common.cjs');
const { rpc } = require('./rpc.cjs');
const { Output } = lib;

(async () => {
  const index = Number(process.argv[2]);
  const amount = Number(process.argv[3]);
  const desc = buildDescriptor();
  const addr = new Output({ descriptor: desc, index, network: NETWORK }).getAddress();
  const txid = await rpc('sendtoaddress', [addr, amount], 'miner');
  const mineTo = await rpc('getnewaddress', [], 'miner');
  await rpc('generatetoaddress', [1, mineTo]);
  const tx = await rpc('gettransaction', [txid, true, true], 'miner');
  const vout = tx.decoded.vout.find((v) => v.scriptPubKey.address === addr);
  const sats = Math.round(vout.value * 1e8);
  fs.writeFileSync(`escrow-${index}.json`, JSON.stringify({ index, address: addr, txid, vout: vout.n, sats, txHex: tx.hex }, null, 2));
  console.log(`Escrow ${index} finanziato: ${addr}`);
  console.log(`  txid ${txid}  vout ${vout.n}  sats ${sats}`);
})().catch((e) => { console.error('ERRORE:', e.message); process.exit(1); });
